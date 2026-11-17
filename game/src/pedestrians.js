// Pedestrians: Palmira Bay's residents, strolling the sidewalks. They wander,
// cross streets at intersections, and flee from gunfire, explosions and cars
// bearing down on them. A few carry cash the player can pick up when they drop it.

import { PEDS, WORLD, WORLD_W } from './config.js';
import { makeRng, range, pick } from './rng.js';
import { clamp, dist, TAU } from './util.js';
import { randomSidewalkPoint, nearestStreetCoord, collideCity } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1', '#fd79a8', '#00cec9'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: rng() * TAU,
    speed: range(rng, PEDS.walkMin, PEDS.walkMax),
    shirt: pick(rng, SHIRTS),
    skin: pick(rng, SKINS),
    // A wander target on a sidewalk; a new one is picked on arrival.
    tx: x, ty: y,
    wait: 0,
    fleeing: false,
    fleeTime: 0,
    dead: false,
    // Rarely, a ped drops cash when startled or hit.
    hasCash: rng() < 0.18,
  };
}

export function spawnPeds(G, count) {
  const rng = makeRng(G.seed + 913);
  for (let i = 0; i < count; i++) {
    let p = null;
    for (let tries = 0; tries < 10 && !p; tries++) {
      const pt = randomSidewalkPoint(rng);
      if (dist(pt.x, pt.y, G.player.x, G.player.y) > 300) p = makePed(pt.x, pt.y, rng);
    }
    if (p) {
      pickNewTarget(G, p, rng);
      G.peds.push(p);
    }
  }
}

function pickNewTarget(G, p, rng) {
  const pt = randomSidewalkPoint(rng);
  p.tx = pt.x;
  p.ty = pt.y;
  p.wait = 0;
}

export function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (p.dead) continue;
    if (dist(p.x, p.y, x, y) < radius) {
      p.fleeing = true;
      p.fleeTime = 2.5 + Math.random() * 2;
      // Drop cash when startled.
      if (p.hasCash) {
        p.hasCash = false;
        G.pickups.push({
          x: p.x, y: p.y, kind: 'cash', amount: 10 + Math.floor(Math.random() * 40),
          life: 25, bob: Math.random() * TAU,
        });
      }
    }
  }
}

export function updatePeds(G, dt) {
  const rng = G.pedRng;
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;
  const playerSpeed = G.player.car ? G.player.car.speed : 0;

  for (const p of G.peds) {
    if (p.dead) continue;
    let speed = p.speed;
    let tx = p.tx;
    let ty = p.ty;

    if (p.fleeing) {
      p.fleeTime -= dt;
      if (p.fleeTime <= 0) p.fleeing = false;
      // Run away from the player.
      const a = Math.atan2(p.y - py, p.x - px);
      tx = p.x + Math.cos(a) * 200;
      ty = p.y + Math.sin(a) * 200;
      speed = PEDS.fleeSpeed;
    } else if (p.wait > 0) {
      p.wait -= dt;
      continue;
    } else if (dist(p.x, p.y, p.tx, p.ty) < 14) {
      if (rng() < 0.3) {
        p.wait = 1 + rng() * 3;
      } else {
        pickNewTarget(G, p, rng);
      }
      continue;
    }

    // A car speeding at a ped makes them jump aside.
    if (playerSpeed > 300 && dist(p.x, p.y, px, py) < 110) {
      p.fleeing = true;
      p.fleeTime = 1.5;
    }

    const targetAngle = Math.atan2(ty - p.y, tx - p.x);
    let d = targetAngle - p.angle;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    p.angle += clamp(d, -3.5 * dt, 3.5 * dt);
    const pos = { x: p.x, y: p.y };
    pos.x += Math.cos(p.angle) * speed * dt;
    pos.y += Math.sin(p.angle) * speed * dt;
    pos.x = clamp(pos.x, 30, WORLD_W - 30);
    pos.y = clamp(pos.y, 30, WORLD.beachY - 30);
    collideCity(pos, 10, G.city);
    p.x = pos.x;
    p.y = pos.y;
    p.walkPhase = (p.walkPhase || 0) + dt * speed * 0.09;
  }

  // Keep the streets populated: respawn far from the player when one dies.
  if (G.peds.filter((p) => !p.dead).length < PEDS.count - 6) {
    const pt = randomSidewalkPoint(rng);
    if (dist(pt.x, pt.y, px, py) > 700) {
      const p = makePed(pt.x, pt.y, rng);
      pickNewTarget(G, p, rng);
      G.peds.push(p);
    }
  }
  // Prune the dead so the array stays short.
  if (G.peds.length > PEDS.count + 20) {
    G.peds = G.peds.filter((p) => !p.dead).slice(-PEDS.count);
  }
}

/** A ped hit by a bullet or a speeding car. */
export function killPed(G, p, byPlayer) {
  if (p.dead) return;
  p.dead = true;
  for (let i = 0; i < 8; i++) {
    G.particles.push({
      x: p.x, y: p.y,
      vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160,
      life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
      size: 3 + Math.random() * 3, color: '#c0392b', kind: 'spark',
    });
  }
  if (p.hasCash) {
    p.hasCash = false;
    G.pickups.push({
      x: p.x, y: p.y, kind: 'cash', amount: 15 + Math.floor(Math.random() * 35),
      life: 30, bob: 0,
    });
  }
  if (byPlayer) {
    G.stats.pedsDown = (G.stats.pedsDown || 0) + 1;
    G.player.addHeat(1);
    scarePeds(G, p.x, p.y, 320);
  }
}
