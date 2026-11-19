// Palmira Bay — pedestrians: beach-goers, shoppers and workers who stroll
// the sidewalks, flee gunfire and panic when a car comes at them.
import { makeRng, rngChoice, rngRange, rngInt } from './rng.js';
import { clamp, dist, angleTo } from './util.js';
import { randomSidewalkSpot, resolveCircle, nearestRoadPoint } from './world.js';

const NAMES = ['Maya', 'Luis', 'Carmen', 'Diego', 'Sofia', 'Rosa', 'Tomas', 'Elena', 'Paco', 'Nina', 'Hugo', 'Lena'];
const SHIRTS = ['#e84f6a', '#4fa8e8', '#e8c94f', '#7ae84f', '#c97ae8', '#e88a4f', '#4fe8c9', '#f2f2f2'];
let pedId = 1;
export function makePed(G, x, y) {
  const rng = makeRng(G.seed + pedId * 97);
  const ped = {
    id: pedId++, name: rngChoice(rng, NAMES),
    x, y, angle: rng() * Math.PI * 2,
    speed: rngRange(rng, 28, 52), color: rngChoice(rng, SHIRTS),
    hp: 50, dead: false, panic: 0, fleeX: 0, fleeY: 0,
    target: null, waitT: rngRange(rng, 0, 3), cash: rngInt(rng, 5, 60),
    walkPhase: rng() * 6.28,
  };
  ped.target = pickTarget(G, ped);
  return ped;
}
function pickTarget(G, ped) {
  const s = randomSidewalkSpot(makeRng(G.seed + ped.id * 13 + Math.floor(G.time * 0.5)));
  return { x: s.x, y: s.y };
}
export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const s = randomSidewalkSpot(makeRng(G.seed + 3000 + i * 7 + G.pedsSpawned));
    G.peds.push(makePed(G, s.x, s.y));
  }
  G.pedsSpawned += n;
}
export function updatePed(G, ped, dt) {
  if (ped.dead) return;
  ped.walkPhase += dt * 8;
  ped.panic = Math.max(0, ped.panic - dt);
  const p = G.player;
  const threat = G.shotsFiredRecently > 0 || (p.inCar && Math.abs(p.inCar.speed) > 150 && dist(ped.x, ped.y, p.inCar.x, p.inCar.y) < 130);
  if (threat) ped.panic = 2;
  let tx, ty, spd;
  if (ped.panic > 0) {
    const a = angleTo(p.x, p.y, ped.x, ped.y);
    tx = ped.x + Math.cos(a) * 120;
    ty = ped.y + Math.sin(a) * 120;
    spd = 130;
  } else {
    if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 24) {
      ped.waitT -= dt;
      if (ped.waitT <= 0) { ped.target = pickTarget(G, ped); ped.waitT = rngRange(makeRng(ped.id * 7 + 1), 0, 2); }
      return;
    }
    tx = ped.target.x; ty = ped.target.y; spd = ped.speed;
  }
  const a = angleTo(ped.x, ped.y, tx, ty);
  ped.angle = a;
  ped.x += Math.cos(a) * spd * dt;
  ped.y += Math.sin(a) * spd * dt;
  ped.x = clamp(ped.x, 16, G.worldW - 16);
  ped.y = clamp(ped.y, 16, G.worldH - 16);
  resolveCircle(G.city, ped, 10);
}
export function pedHitByCar(G, ped, car) {
  if (ped.dead) return;
  ped.hp -= 60;
  ped.panic = 3;
  G.playSfx('crash');
  if (ped.hp <= 0) {
    ped.dead = true;
    G.player.kills++;
    G.addWanted(1, 'Pedestrian down');
    G.toast(ped.name + ' was hit. Witnesses called the PBPD.');
  }
}
export function nearestPed(G, x, y, maxD) {
  let best = null; let bd = maxD * maxD;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const d = dist(ped.x, ped.y, x, y);
    if (d < bd) { bd = d; best = ped; }
  }
  return best;
}
