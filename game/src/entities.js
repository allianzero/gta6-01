// Palmira Bay — the player and shared entity helpers: movement on foot,
// health, cash, respect and level progression.
import { clamp, dist } from './util.js';
import { PLAYER_START } from './config.js';
import { resolveCircle, isOnRoad } from './world.js';

export function createPlayer() {
  return {
    x: PLAYER_START.x, y: PLAYER_START.y, angle: PLAYER_START.angle,
    vx: 0, vy: 0, speed: 0,
    hp: 100, maxHp: 100,
    cash: 120, respect: 0, level: 1, xp: 0,
    wanted: 0, wantedTimer: 0,
    weapon: 'fists', weapons: ['fists'], ammo: { pistol: 0, smg: 0 },
    inCar: null, driving: false,
    punchCd: 0, shootCd: 0, hurtCd: 0,
    runStamina: 100, dead: false, busted: false,
    kills: 0, carsStolen: 0, missionsDone: 0,
  };
}
export function addXp(player, n) {
  player.xp += n;
  const need = player.level * 100;
  if (player.xp >= need) {
    player.xp -= need;
    player.level++;
    player.maxHp = Math.min(160, 100 + (player.level - 1) * 10);
    player.hp = player.maxHp;
    return true;
  }
  return false;
}
export function hurtPlayer(G, amount, source) {
  const p = G.player;
  if (p.hurtCd > 0 || p.dead || p.inCar) return;
  p.hp -= amount;
  p.hurtCd = 0.5;
  G.floaters.push({ x: p.x, y: p.y - 20, text: '-' + amount, color: '#ff5a4e', t: 0 });
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    G.state = 'wasted';
    G.stateTimer = 0;
  }
}
export function updatePlayerOnFoot(G, dt, ax, ay) {
  const p = G.player;
  const run = G.input.keys.has('Shift');
  const spd = run && p.runStamina > 0 ? 215 : 140;
  if (run && (ax || ay)) p.runStamina = Math.max(0, p.runStamina - dt * 18);
  else p.runStamina = Math.min(100, p.runStamina + dt * 12);
  const len = Math.hypot(ax, ay) || 1;
  const tx = (ax / len) * spd * (ax || ay ? 1 : 0);
  const ty = (ay / len) * spd * (ax || ay ? 1 : 0);
  p.vx += (tx - p.vx) * Math.min(1, dt * 12);
  p.vy += (ty - p.vy) * Math.min(1, dt * 12);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, 20, G.worldW - 20);
  p.y = clamp(p.y, 20, G.worldH - 20);
  resolveCircle(G.city, p, 13);
  if (Math.hypot(p.vx, p.vy) > 20) p.angle = Math.atan2(p.vy, p.vx);
  p.speed = Math.hypot(p.vx, p.vy);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  G.onRoad = isOnRoad(p.x, p.y);
}
export function nearestEntity(list, x, y, maxD) {
  let best = null; let bd = maxD * maxD;
  for (const e of list) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, x, y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
export function saveData(G) {
  const p = G.player;
  return {
    cash: p.cash, respect: p.respect, level: p.level, xp: p.xp,
    weapons: p.weapons, ammo: p.ammo, weapon: p.weapon,
    missionsDone: p.missionsDone, kills: p.kills, carsStolen: p.carsStolen,
    missionIndex: G.missions.index, x: p.x, y: p.y, day: G.dayT,
  };
}
export function loadData(G, d) {
  const p = G.player;
  p.cash = d.cash ?? 120; p.respect = d.respect ?? 0; p.level = d.level ?? 1; p.xp = d.xp ?? 0;
  p.weapons = d.weapons ?? ['fists']; p.ammo = d.ammo ?? { pistol: 0, smg: 0 };
  p.weapon = d.weapon ?? 'fists';
  p.missionsDone = d.missionsDone ?? 0; p.kills = d.kills ?? 0; p.carsStolen = d.carsStolen ?? 0;
  p.x = d.x ?? PLAYER_START.x; p.y = d.y ?? PLAYER_START.y;
  G.missions.index = d.missionIndex ?? 0;
  G.dayT = d.day ?? 0.3;
}
