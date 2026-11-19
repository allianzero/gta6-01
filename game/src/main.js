// Palmira Bay — main loop and game state: menu, playing, paused, wasted,
// busted. Wires every system together and owns saving.
import { WORLD_W, WORLD_H, WORLD_SEED, FIXED_DT, SAVE_KEY, GAME_TITLE, DAY_LENGTH } from './config.js';
import { clamp, dist } from './util.js';
import { createInput, isDown, wasPressed, endFrameInput, axisInput } from './input.js';
import { createAudio, initAudio, playSfx, updateMusic, setEngine, toggleMute } from './audio.js';
import { buildCity } from './world.js';
import { LANDMARKS, SHOPS, nearestShop } from './city.js';
import { createPlayer, updatePlayerOnFoot, saveData, loadData, addXp } from './entities.js';
import { spawnTraffic, spawnParked, nearestCar, updateTrafficCar, updatePlayerCar, stealCar } from './vehicles.js';
import { spawnPeds, updatePed, pedHitByCar, nearestPed } from './pedestrians.js';
import { addWanted, updatePolice, clearWanted } from './police.js';
import { playerShoot, playerPunch, updateBullets, updateEnemy, switchWeapon, giveWeapon, weaponOf } from './combat.js';
import { createMissions, startMission, updateMissions, missionMarker, missionGiverPos, currentMission, MISSION_DEFS } from './missions.js';
import { drawHud, roundRect } from './hud.js';
import { createCamera, updateCamera, drawWorld } from './render.js';
import { applyShot } from './shots.js';

export function createGame(canvas) {
  const G = {
    canvas, ctx: canvas.getContext('2d'),
    vw: 1280, vh: 800,
    seed: WORLD_SEED, worldW: WORLD_W, worldH: WORLD_H,
    time: 0, dayT: 0.3, state: 'menu', stateTimer: 0,
    player: createPlayer(),
    city: buildCity(WORLD_SEED),
    landmarks: LANDMARKS,
    cars: [], peds: [], enemies: [], bullets: [], sparks: [], floaters: [], pickups: [],
    toasts: [], banner: null,
    missions: createMissions(),
    camera: createCamera(),
    input: createInput(canvas),
    audio: createAudio(),
    trafficSpawned: 0, pedsSpawned: 0, copsSpawned: 0, enemiesSpawned: 0,
    copTimer: 0, recentCrimeT: 0, shotsFiredRecently: 0,
    muzzle: 0, punchAnim: 0, shake: 0, onRoad: false,
    menuSel: 0, paused: false, savedMsg: '',
    shotMode: null, shotTimer: 0,
  };
  G.playSfx = (name) => playSfx(G.audio, name);
  G.addWanted = (stars, reason) => { addWanted(G, stars, reason); G.recentCrimeT = 4; };
  G.addShake = (n) => { G.camera.shake = Math.max(G.camera.shake, n); };
  G.toast = (text) => { G.toasts.push({ text, t: 4 }); if (G.toasts.length > 4) G.toasts.shift(); };
  G.missionMarker = () => missionMarker(G);
  G.saveGame = () => saveGame(G);
  G.loadGame = () => loadGame(G);
  spawnTraffic(G, 26);
  spawnParked(G, 18);
  spawnPeds(G, 40);
  seedPickups(G);
  return G;
}
function seedPickups(G) {
  G.pickups = [
    { x: 980, y: 540, kind: 'health', taken: false },
    { x: 2150, y: 740, kind: 'cash', taken: false, amount: 80 },
    { x: 1350, y: 1800, kind: 'weapon', taken: false, item: 'pistol', ammo: 24 },
    { x: 2650, y: 1550, kind: 'weapon', taken: false, item: 'smg', ammo: 60 },
    { x: 2350, y: 2150, kind: 'health', taken: false },
    { x: 3300, y: 1450, kind: 'cash', taken: false, amount: 150 },
  ];
}
export function saveGame(G) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData(G)));
    G.savedMsg = 'Game saved.';
    G.toast('Progress saved.');
    return true;
  } catch (e) { G.toast('Save failed.'); return false; }
}
export function loadGame(G) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { G.toast('No save found.'); return false; }
    loadData(G, JSON.parse(raw));
    G.toast('Save loaded. Welcome back to Palmira Bay.');
    return true;
  } catch (e) { G.toast('Save could not be loaded.'); return false; }
}
function resize(G) {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  G.canvas.width = Math.floor(w * dpr);
  G.canvas.height = Math.floor(h * dpr);
  G.canvas.style.width = w + 'px';
  G.canvas.style.height = h + 'px';
  G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  G.vw = w; G.vh = h;
}
export function startGame(G) {
  resize(G);
  window.addEventListener('resize', () => resize(G));
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    G.shotMode = shot;
    G.state = 'playing';
    applyShot(G, shot);
  }
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dtReal = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dtReal;
    let steps = 0;
    while (acc >= FIXED_DT && steps < 5) {
      update(G, FIXED_DT);
      acc -= FIXED_DT;
      steps++;
    }
    render(G);
    endFrameInput(G.input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
// Palmira Bay — main loop, part 2: per-frame update.
function update(G, dt) {
  G.time += dt;
  G.dayT = (G.dayT + dt / DAY_LENGTH) % 1;
  G.muzzle = Math.max(0, G.muzzle - dt);
  G.punchAnim = Math.max(0, G.punchAnim - dt);
  G.exitCooldown = Math.max(0, (G.exitCooldown || 0) - dt);
  G.shotsFiredRecently = Math.max(0, G.shotsFiredRecently - dt);
  for (const t of G.toasts) t.t -= dt;
  G.toasts = G.toasts.filter((t) => t.t > 0);
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  for (const s of G.sparks) s.t += dt;
  G.sparks = G.sparks.filter((s) => s.t < 0.35);
  for (const f of G.floaters) f.t += dt * 0.9;
  G.floaters = G.floaters.filter((f) => f.t < 1);
  updateMusic(G.audio);
  if (G.state === 'menu') { updateMenu(G, dt); return; }
  if (G.state === 'wasted' || G.state === 'busted') {
    G.stateTimer += dt;
    if (G.stateTimer > 1 && (wasPressed(G.input, 'Enter', ' ') || G.input.anyKey)) respawn(G);
    return;
  }
  if (wasPressed(G.input, 'p', 'Escape')) { G.paused = !G.paused; G.playSfx('click'); }
  if (wasPressed(G.input, 'm')) toggleMute(G.audio);
  if (G.paused) return;
  const p = G.player;
  if (wasPressed(G.input, 'F5')) saveGame(G);
  if (wasPressed(G.input, 'F9')) loadGame(G);
  updateMissions(G, dt);
  updatePolice(G, dt);
  // traffic + pedestrians keep the city alive
  for (const c of G.cars) {
    if (c.isCop || c === p.inCar || c.parked) continue;
    if (c.traffic) updateTrafficCar(G, c, dt);
  }
  for (const ped of G.peds) updatePed(G, ped, dt);
  for (const e of G.enemies) updateEnemy(G, e, dt);
  updateBullets(G, dt);
  // car vs pedestrian collisions (only at real speed — a bump is not a crime)
  for (const c of G.cars) {
    if (Math.abs(c.speed) < 140) continue;
    for (const ped of G.peds) {
      if (!ped.dead && dist(ped.x, ped.y, c.x, c.y) < 26) pedHitByCar(G, ped, c);
    }
  }
  // car vs car bumps: separate the bodies and share the speed, so a
  // rear-end shove pushes traffic aside instead of grinding both to a halt
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i], b = G.cars[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 34 && d > 0.01) {
        const push = (34 - d) / 2;
        const ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
        const shared = (a.speed + b.speed) / 2;
        a.speed = shared * 0.95;
        b.speed = shared * 0.95;
        if (Math.abs(a.speed) > 100 || Math.abs(b.speed) > 100) G.playSfx('crash');
      }
    }
  }
  // keep population topped up near the player
  if (G.cars.filter((c) => c.traffic).length < 20) spawnTraffic(G, 4);
  if (G.peds.filter((x) => !x.dead).length < 30) spawnPeds(G, 6);
  // player control
  if (p.inCar) updateDriving(G, dt);
  else updateOnFoot(G, dt);
  updateCamera(G, dt);
  // pickups
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    if (dist(px, py, pk.x, pk.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'health') { p.hp = Math.min(p.maxHp, p.hp + 40); G.toast('Health +40'); }
      if (pk.kind === 'cash') { p.cash += pk.amount; G.toast('Found $' + pk.amount); G.playSfx('cash'); }
      if (pk.kind === 'weapon') giveWeapon(G, pk.item, pk.ammo);
      if (pk.kind !== 'cash') G.playSfx('pickup');
    }
  }
  // mission giver / bank grab interaction
  if (wasPressed(G.input, 'e')) handleInteract(G);
  if (wasPressed(G.input, 'q')) switchWeapon(G, -1);
  if (wasPressed(G.input, '1')) { p.weapon = p.weapons[0] || 'fists'; }
  if (wasPressed(G.input, '2') && p.weapons[1]) p.weapon = p.weapons[1];
  if (wasPressed(G.input, '3') && p.weapons[2]) p.weapon = p.weapons[2];
  if (G.shotMode) {
    G.shotTimer += dt;
    if (G.shotTimer > 2.2) G.shotTimer = 2.2;
  }
}
function updateMenu(G, dt) {
  if (wasPressed(G.input, 'ArrowUp', 'w')) G.menuSel = (G.menuSel + 4) % 5;
  if (wasPressed(G.input, 'ArrowDown', 's')) G.menuSel = (G.menuSel + 1) % 5;
  if (wasPressed(G.input, 'Enter', ' ') || G.input.mousePressed) {
    initAudio(G.audio);
    const sel = G.menuSel;
    if (sel === 0) { G.state = 'playing'; G.playSfx('mission'); }
    else if (sel === 1) { loadGame(G); if (localStorage.getItem(SAVE_KEY)) G.state = 'playing'; }
    else if (sel === 2) { G.state = 'playing'; startMission(G); }
    else if (sel === 3) { G.state = 'howto'; }
    else if (sel === 4) { toggleMute(G.audio); }
  }
  if (G.state === 'howto' && wasPressed(G.input, 'Escape', 'Enter', ' ')) G.state = 'menu';
}
function respawn(G) {
  const p = G.player;
  p.dead = false; p.busted = false;
  p.hp = p.maxHp;
  p.x = 1450; p.y = 1250;
  p.inCar = null;
  clearWanted(G);
  G.state = 'playing';
  G.stateTimer = 0;
  G.toast('You wake up outside Rosa\'s apartment. The city waits.');
}
function updateDriving(G, dt) {
  const p = G.player;
  const car = p.inCar;
  const auto = G.shotMode === 'drive' || G.shotMode === 'chase';
  const throttle = auto ? 1 : (isDown(G.input, 'w', 'ArrowUp') ? 1 : 0) - (isDown(G.input, 's', 'ArrowDown') ? 1 : 0);
  const steer = auto ? 0 : (isDown(G.input, 'd', 'ArrowRight') ? 1 : 0) - (isDown(G.input, 'a', 'ArrowLeft') ? 1 : 0);
  updatePlayerCar(G, car, dt, throttle, steer);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  setEngine(G.audio, Math.abs(car.speed) / car.maxSpeed, true);
  if (wasPressed(G.input, 'h')) G.playSfx('horn');
  if (wasPressed(G.input, 'e')) {
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    G.exitCooldown = 0.35;
    G.playSfx('door');
    setEngine(G.audio, 0, false);
  }
  if (car.hp <= 0) {
    car.dead = true;
    p.inCar = null;
    G.addShake(10);
    G.playSfx('crash');
    G.toast('Your car is wrecked!');
  }
}
function updateOnFoot(G, dt) {
  const p = G.player;
  const ax = axisInput(G.input);
  updatePlayerOnFoot(G, dt, ax.x, ax.y);
  setEngine(G.audio, 0, false);
  // aim with mouse
  const wx = G.input.mouseX + G.camera.x;
  const wy = G.input.mouseY + G.camera.y;
  if (Math.hypot(wx - p.x, wy - p.y) > 30) p.angle = Math.atan2(wy - p.y, wx - p.x);
  if (G.input.mouseDown && p.weapon !== 'fists') playerShoot(G);
  if (G.input.mousePressed && p.weapon === 'fists') playerPunch(G);
  if (wasPressed(G.input, 'f')) playerPunch(G);
}
function handleInteract(G) {
  const p = G.player;
  if (G.exitCooldown > 0) return;
  const M = G.missions;
  // bank grab step
  if (M.active && M.active.steps[M.step] && M.active.steps[M.step].type === 'grab') {
    if (dist(p.x, p.y, 1750, 1150) < 110) {
      M.grabbed = true;
      p.cash += 800;
      G.addWanted(3, 'Bank robbery!');
      G.toast('You grabbed $800 from the Coral Bank vault!');
      G.playSfx('cash');
      return;
    }
  }
  // mission giver
  const giver = missionGiverPos(G);
  if (giver && !M.active && dist(p.x, p.y, giver.x, giver.y) < 90) {
    startMission(G);
    return;
  }
  // shops
  const shop = nearestShop(p.x, p.y);
  if (shop && dist(p.x, p.y, shop.x, shop.y) < 70) {
    if (shop.kind === 'food' && p.cash >= shop.price) {
      p.cash -= shop.price; p.hp = Math.min(p.maxHp, p.hp + shop.heal);
      G.toast(shop.name + ': ate well, HP +' + shop.heal);
      G.playSfx('pickup');
    } else if (shop.kind === 'guns' && p.cash >= shop.price) {
      p.cash -= shop.price;
      giveWeapon(G, shop.item, shop.item === 'pistol' ? 24 : 60);
    } else if (shop.kind === 'clinic' && p.cash >= shop.price) {
      p.cash -= shop.price; p.hp = p.maxHp;
      G.toast('Doc Marina patched you up. Full HP.');
      G.playSfx('pickup');
    } else if (shop.kind === 'paint' && p.inCar === null) {
      G.toast('Spray & Shine needs a car — drive one in!');
    } else {
      G.toast('Not enough cash for ' + shop.name + ' ($' + shop.price + ').');
    }
    return;
  }
  // enter / steal nearest car
  if (!p.inCar) {
    const car = nearestCar(G, p.x, p.y, 60);
    if (car) {
      if (car.parked || !car.driver) stealCar(G, car);
      else {
        car.driver = false; car.traffic = false;
        p.inCar = car;
        p.carsStolen++;
        G.addWanted(1, 'Carjacking in broad daylight');
        G.playSfx('door');
        G.toast('You yanked the driver out of the ' + car.name + '!');
      }
    }
  }
}
// Palmira Bay — main loop, part 3: rendering each screen state.
function render(G) {
  const ctx = G.ctx;
  ctx.clearRect(0, 0, G.vw, G.vh);
  if (G.state === 'menu') { renderMenu(G, ctx); return; }
  if (G.state === 'howto') { renderHowto(G, ctx); return; }
  drawWorld(G, ctx);
  if (G.state === 'playing' || G.state === 'wasted' || G.state === 'busted') drawHud(G, ctx, G.vw, G.vh);
  if (G.paused && G.state === 'playing') {
    ctx.fillStyle = 'rgba(5,8,16,0.72)';
    ctx.fillRect(0, 0, G.vw, G.vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94f';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', G.vw / 2, G.vh / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('P / Esc — resume    •    F5 — save    •    F9 — load    •    M — mute', G.vw / 2, G.vh / 2 + 12);
    ctx.fillText('Progress saves to this browser (localStorage).', G.vw / 2, G.vh / 2 + 42);
    ctx.textAlign = 'left';
  }
  if (G.state === 'wasted') overlayEnd(G, ctx, 'WASTED', 'The bay took you down. Press Enter to wake up at Rosa\'s.');
  if (G.state === 'busted') overlayEnd(G, ctx, 'BUSTED', 'The PBPD caught you. $150 bail paid. Press Enter to walk free.');
}
function overlayEnd(G, ctx, title, sub) {
  ctx.fillStyle = 'rgba(5,8,16,0.66)';
  ctx.fillRect(0, 0, G.vw, G.vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = title === 'WASTED' ? '#ff5a4e' : '#4f9fff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, G.vw / 2, G.vh / 2 - 10);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(sub, G.vw / 2, G.vh / 2 + 30);
  ctx.textAlign = 'left';
}
function renderMenu(G, ctx) {
  const vw = G.vw, vh = G.vh;
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#ff9a5a');
  grad.addColorStop(0.55, '#c94f7a');
  grad.addColorStop(1, '#2a1a4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
  ctx.save();
  ctx.fillStyle = 'rgba(255,220,120,0.9)';
  ctx.beginPath(); ctx.arc(vw - 180, 130, 62, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#1d3a4a';
  for (let i = 0; i < 3; i++) ctx.fillRect(60 + i * 190, vh - 190, 150, 190);
  ctx.fillStyle = '#ffd94f';
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) ctx.fillRect(78 + i * 190 + j * 34, vh - 170 + (j % 2) * 40, 16, 20);
  }
  ctx.fillStyle = '#0e2a3a';
  ctx.fillRect(0, vh - 60, vw, 60);
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 18;
  ctx.fillText('PALMIRA BAY', vw / 2, 210);
  ctx.shadowBlur = 0;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText('Sun, sand and trouble on the Coral Coast — an original open-world crime game', vw / 2, 252);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Rosa needs a driver. Steal cars, dodge the PBPD, run five story missions, own the bay.', vw / 2, 282);
  const items = ['▶  NEW GAME', '↻  CONTINUE (saved game)', '★  START FIRST MISSION', '?  HOW TO PLAY', '♪  SOUND: ' + (G.audio.muted ? 'OFF' : 'ON')];
  ctx.font = 'bold 22px system-ui, sans-serif';
  items.forEach((it, i) => {
    const y = 360 + i * 52;
    if (i === G.menuSel) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(ctx, vw / 2 - 240, y - 30, 480, 42, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd94f';
    } else ctx.fillStyle = '#fff';
    ctx.fillText(it, vw / 2, y);
  });
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('WASD / arrows — move & drive   •   E — enter car / talk / grab   •   Mouse — aim & shoot   •   F — punch', vw / 2, vh - 100);
  ctx.fillText('M — mute   •   P — pause   •   F5 save / F9 load   •   Progress auto-saves to this browser', vw / 2, vh - 76);
  ctx.textAlign = 'left';
}
function renderHowto(G, ctx) {
  const vw = G.vw, vh = G.vh;
  ctx.fillStyle = '#141a2a';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('HOW TO PLAY', vw / 2, 90);
  ctx.font = '17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const lines = [
    'ON FOOT — WASD / arrows to walk, Shift to run. Mouse aims, click shoots, F punches.',
    'DRIVING — Walk to any car, press E to steal it. W/S accelerate & brake, A/D steer, Space handbrake.',
    'WANTED — Crime raises your stars. Cops chase in cruisers; on foot they bust you. Lay low to cool off.',
    'MISSIONS — Walk to Rosa at the apartment (yellow marker) and press E, or press M in the menu.',
    '  Five chapters: First Wheels, Courier Run, Heat Wave, Payback and the Coral Bank score.',
    'MONEY — Earn cash from missions, pickups and taken-down gang members. Spend it at shops.',
    'SHOPS — Taco Luna & Burger Bay heal you, Ammo & Sons sells guns, Doc Marina heals fully.',
    'SAVE — F5 saves, F9 loads. Your cash, weapons, level and missions live in this browser.',
    'GOAL — Finish all five missions, then free-roam Palmira Bay as its new legend.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, 90, 150 + i * 42));
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94f';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('Press Enter or Esc to go back', vw / 2, vh - 60);
  ctx.textAlign = 'left';
}
