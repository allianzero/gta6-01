// The world: one object holding everything, and the per-frame update that ties
// the systems together — the player on foot or in a car, traffic, pedestrians,
// police, missions, combat and the camera.

import { WORLD, WORLD_W, WORLD_SEED, PLAYER, CAR, TRAFFIC, PEDS, POLICE } from './config.js';
import { makeRng } from './rng.js';
import { clamp, dist, TAU } from './util.js';
import { generateCity, collideCity } from './city.js';
import { Sound } from './audio.js';
import { makeCar, spawnTraffic, updateTraffic, updatePlayerCar, collideCars, nearestCar } from './vehicles.js';
import { spawnPeds, updatePeds, killPed } from './pedestrians.js';
import { updatePolice } from './police.js';
import { startMission, updateMissions } from './missions.js';
import { playerShoot, updateBullets, updatePickups, updateParticles } from './combat.js';
import { loadSave, writeSave, defaultSave } from './save.js';

export function createGame() {
  const save = loadSave() || defaultSave();
  const city = generateCity(WORLD_SEED);
  const G = {
    time: 0,
    seed: WORLD_SEED,
    city,
    rng: makeRng(WORLD_SEED + 31),
    trafficRng: makeRng(WORLD_SEED + 77),
    pedRng: makeRng(WORLD_SEED + 913),
    policeRng: makeRng(WORLD_SEED + 517),
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    pickups: [],
    floaters: [],
    events: [],
    mission: null,
    sound: new Sound(),
    camera: { x: 0, y: 0, zoom: 1, shake: 0 },
    mode: 'title', // title | playing | paused | wasted | busted | complete
    save,
    stats: {
      shotsFired: 0, pedsDown: 0, copsDown: 0, cashEarned: 0,
      missionsDone: save.missionsDone, carsStolen: save.carsStolen,
    },
    saveTimer: 0,
    titleTime: 0,
    shotMode: null,
  };
  G.player = makePlayer(G, save);
  return G;
}

function makePlayer(G, save) {
  // Start on the promenade by the beach, facing the city.
  const start = { x: WORLD_W / 2, y: WORLD.beachY - 120 };
  const player = {
    x: start.x, y: start.y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    maxHealth: PLAYER.maxHealth,
    armor: 0,
    onFoot: true,
    car: null,
    cash: save.cash,
    wanted: 0,
    lastCrimeAt: -999,
    coolTimer: 0,
    fireCooldown: 0,
    invulnerable: 0,
    walkPhase: 0,
    // Raising the heat: stars, capped at 5; resets the cool-down clock.
    addHeat(stars) {
      if (stars > 0) {
        this.wanted = Math.min(POLICE.maxStars, this.wanted + stars);
        this.lastCrimeAt = G.time;
        this.coolTimer = 0;
        if (this.wanted > (G.save.bestWanted || 0)) G.save.bestWanted = this.wanted;
      }
    },
  };
  return player;
}

/** (Re)build the living city around the player: traffic, peds, a starter car. */
export function populateWorld(G) {
  G.cars = [];
  G.peds = [];
  G.cops = [];
  G.bullets = [];
  G.particles = [];
  G.pickups = [];
  G.floaters = [];
  G.events = [];
  spawnTraffic(G, TRAFFIC.count);
  spawnPeds(G, PEDS.count);
  // A parked car on the street by the start, so the first job is never far away.
  const parked = makeCar(G.player.x + 200, 3900 + 30, 0, '#e63946', 'traffic');
  parked.axis = 'h';
  parked.dir = 1;
  parked.street = 3900;
  parked.cruise = 0;
  parked.speed = 0;
  G.cars.push(parked);
  // Health and armour pickups scattered near the start.
  G.pickups.push(
    { x: G.player.x + 120, y: G.player.y - 60, kind: 'health', amount: 0, life: 600, bob: 0 },
    { x: G.player.x - 140, y: G.player.y - 40, kind: 'armor', amount: 0, life: 600, bob: 0 },
  );
}

/** Start a fresh run: reset the player, the city life and mission one. */
export function startNewGame(G) {
  const save = G.save;
  G.player = makePlayer(G, save);
  G.mission = null;
  G.time = 0;
  G.camera.shake = 0;
  populateWorld(G);
  G.mode = 'playing';
  startMission(G, 0);
}

/** Continue from the save: cash and missions done carry over. */
export function continueGame(G) {
  startNewGame(G);
  const done = Math.min(G.save.missionsDone, 5);
  if (done > 0) {
    // Skip finished missions: jump straight to the next job.
    G.mission = null;
    startMission(G, done);
  }
}

function updatePlayerOnFoot(G, dt, input) {
  const p = G.player;
  const axes = input.axes();
  const running = input.down('ShiftLeft', 'ShiftRight');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const tx = axes.x * speed;
  const ty = axes.y * speed;
  p.vx = p.vx + (tx - p.vx) * Math.min(1, 12 * dt);
  p.vy = p.vy + (ty - p.vy) * Math.min(1, 12 * dt);
  if (axes.x === 0 && axes.y === 0) {
    p.vx *= Math.max(0, 1 - PLAYER.friction * dt);
    p.vy *= Math.max(0, 1 - PLAYER.friction * dt);
  }
  const pos = { x: p.x, y: p.y };
  pos.x += p.vx * dt;
  pos.y += p.vy * dt;
  collideCity(pos, PLAYER.radius, G.city);
  p.x = pos.x;
  p.y = pos.y;
  const moving = Math.hypot(p.vx, p.vy);
  p.walkPhase += dt * moving * 0.09;
  if (moving > 20) {
    p.angle = Math.atan2(p.vy, p.vx);
  }
  // Aim with the mouse (screen space -> world space, via the camera).
  const cam = G.camera;
  const wx = cam.x + (input.mouseX - G.viewW / 2) / cam.zoom;
  const wy = cam.y + (input.mouseY - G.viewH / 2) / cam.zoom;
  p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
  // Fire while the mouse is held.
  if (input.mouseDown) playerShoot(G, wx, wy);
  // Enter the nearest car.
  if (input.wasPressed('KeyE')) enterNearestCar(G);
}

function enterNearestCar(G) {
  const p = G.player;
  const car = nearestCar(G, p.x, p.y, PLAYER.enterRange);
  if (!car) return;
  if (car.kind === 'police' && car.driver === 'police') {
    G.floaters.push({ x: p.x, y: p.y - 24, text: 'OCCUPIED — POLICE', color: '#ff4747', life: 1.2 });
    return;
  }
  // Stealing a stranger's car: the driver flees on foot, and it is a crime.
  if (car.kind === 'traffic') {
    const rng = G.rng;
    const ped = {
      x: car.x + 30, y: car.y + 30, angle: rng() * TAU,
      speed: 150, shirt: '#e74c3c', skin: '#f1c27d',
      tx: car.x + 200, ty: car.y + 200, wait: 0,
      fleeing: true, fleeTime: 4, dead: false, hasCash: false, walkPhase: 0,
    };
    G.peds.push(ped);
    car.kind = 'player';
    p.addHeat(1);
    G.stats.carsStolen = (G.stats.carsStolen || 0) + 1;
    G.save.carsStolen = G.stats.carsStolen;
  }
  car.driver = 'player';
  p.car = car;
  p.onFoot = false;
  p.vx = 0;
  p.vy = 0;
  G.sound.blip(440, 0.08, 0.2);
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  p.car = null;
  p.onFoot = true;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
  const pos = { x: p.x, y: p.y };
  collideCity(pos, PLAYER.radius, G.city);
  p.x = pos.x;
  p.y = pos.y;
  p.angle = car.angle;
  p.vx = 0;
  p.vy = 0;
}

/** Running someone over in a car is a crime — and it is also messy. */
function checkRunOvers(G) {
  const p = G.player;
  if (!p.car || p.car.dead) return;
  const car = p.car;
  if (car.speed < 150) return;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (dist(ped.x, ped.y, car.x, car.y) < 34) {
      killPed(G, ped, true);
    }
  }
  for (const cop of G.cops) {
    if (cop.dead) continue;
    if (dist(cop.x, cop.y, car.x, car.y) < 34) {
      cop.dead = true;
      G.stats.copsDown = (G.stats.copsDown || 0) + 1;
      p.addHeat(1);
    }
  }
}

export function updateGame(G, dt, input) {
  const p = G.player;
  G.time += dt;

  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);

  if (p.onFoot) {
    updatePlayerOnFoot(G, dt, input);
  } else if (p.car && !p.car.dead) {
    updatePlayerCar(G, p.car, dt, input);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    if (input.wasPressed('KeyE')) exitCar(G);
  } else {
    p.onFoot = true;
    p.car = null;
  }

  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);
  updateParticles(G, dt);
  collideCars(G);
  checkRunOvers(G);

  // The engine follows the car; the siren follows the wanted level.
  const driving = !p.onFoot && p.car && !p.car.dead;
  G.sound.engine(driving ? clamp(p.car.speed / CAR.topSpeed, 0, 1) : 0, driving);

  // Camera: follow the player, ease the zoom out while driving fast.
  const targetZoom = driving ? clamp(1.05 - p.car.speed / 2400, 0.72, 0.95) : 1;
  G.camera.zoom += (targetZoom - G.camera.zoom) * Math.min(1, 2 * dt);
  G.camera.x += (p.x - G.camera.x) * Math.min(1, 6 * dt);
  G.camera.y += (p.y - G.camera.y) * Math.min(1, 6 * dt);
  G.camera.shake = Math.max(0, G.camera.shake - dt * 26);

  // Autosave every 15 seconds of play.
  G.saveTimer += dt;
  if (G.saveTimer > 15) {
    G.saveTimer = 0;
    G.save.cash = p.cash;
    G.save.playSeconds = (G.save.playSeconds || 0) + 15;
    writeSave(G.save);
  }
}

/** Handle one-frame events the update pushed (busted, wasted, all done). */
export function drainEvents(G) {
  const events = G.events.splice(0, G.events.length);
  for (const e of events) {
    if (e === 'busted') {
      G.mode = 'busted';
      G.save.bustedCount = (G.save.bustedCount || 0) + 1;
      G.save.cash = Math.max(0, Math.floor(G.player.cash * 0.8));
      G.player.cash = G.save.cash;
      writeSave(G.save);
    } else if (e === 'wasted') {
      G.mode = 'wasted';
      G.save.wastedCount = (G.save.wastedCount || 0) + 1;
      writeSave(G.save);
    } else if (e === 'allMissionsDone') {
      G.mode = 'complete';
    }
  }
}
