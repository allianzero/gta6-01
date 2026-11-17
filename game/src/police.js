// The Palmira Bay Police Department: a wanted level from 0 to 5 stars, police
// cars that chase and ram, and officers on foot who shoot — and bust the player
// if they get close enough on foot. Heat cools when the player stays clean and
// out of sight.

import { POLICE, WORLD, WORLD_W, WORLD_H, CAR } from './config.js';
import { makeRng, range } from './rng.js';
import { clamp, dist, lerp, angleApproach, angleDiff, TAU } from './util.js';
import { makeCar, damageCar } from './vehicles.js';
import { nearestStreetCoord, randomStreetPoint, collideCity } from './city.js';
import { spawnSparks } from './vehicles.js';

export function makeCop(x, y) {
  return {
    x, y,
    angle: 0,
    speed: POLICE.copSpeed,
    health: 50,
    maxHealth: 50,
    shootCooldown: 0,
    bustHold: 0,
    dead: false,
    walkPhase: 0,
  };
}

/** Spawn a police car at a street point near the player, off-screen if possible. */
function spawnPoliceCar(G) {
  const rng = G.policeRng;
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 10; tries++) {
    const pt = randomStreetPoint(rng);
    const d = dist(pt.x, pt.y, G.player.x, G.player.y);
    if (d > 520 && d < 1400) {
      x = pt.x;
      y = pt.y;
      break;
    }
    x = pt.x;
    y = pt.y;
  }
  const car = makeCar(x, y, 0, '#2b4acb', 'police');
  car.driver = 'police';
  car.cruise = POLICE.carTopSpeed;
  car.health = 120;
  car.maxHealth = 120;
  G.cars.push(car);
  return car;
}

function spawnCop(G) {
  const p = G.player;
  const a = Math.random() * TAU;
  const x = clamp(p.x + Math.cos(a) * 420, 40, WORLD_W - 40);
  const y = clamp(p.y + Math.sin(a) * 420, 40, WORLD.beachY - 40);
  const cop = makeCop(x, y);
  G.cops.push(cop);
  return cop;
}

export function wantedStars(G) {
  return G.player.wanted;
}

export function updatePolice(G, dt) {
  const p = G.player;
  const wanted = p.wanted;

  // Siren follows the wanted level.
  G.sound.siren(wanted > 0);

  // Keep the hunting force at the right size for the wanted level.
  const policeCars = G.cars.filter((c) => c.kind === 'police' && !c.dead);
  const wantCars = POLICE.carsByStars[Math.min(wanted, POLICE.maxStars)];
  const wantCops = POLICE.copsByStars[Math.min(wanted, POLICE.maxStars)];
  if (wanted > 0) {
    if (policeCars.length < wantCars && Math.random() < dt * 1.2) spawnPoliceCar(G);
    const liveCops = G.cops.filter((c) => !c.dead).length;
    if (liveCops < wantCops && Math.random() < dt * 1.5) spawnCop(G);
  }

  // Police cars hunt.
  for (const car of policeCars) {
    updatePoliceCar(G, car, dt);
  }

  // Officers on foot hunt.
  for (const cop of G.cops) {
    if (cop.dead) continue;
    updateCop(G, cop, dt);
  }
  if (G.cops.length > 12) G.cops = G.cops.filter((c) => !c.dead).slice(-8);

  // Wanted decay: stay clean and unseen and the heat cools off.
  if (wanted > 0) {
    const timeSinceCrime = G.time - p.lastCrimeAt;
    const nearestPolice = nearestPoliceDist(G);
    if (timeSinceCrime > POLICE.coolDown && nearestPolice > 500) {
      p.coolTimer += dt;
      if (p.coolTimer >= POLICE.coolTick) {
        p.coolTimer = 0;
        p.wanted = Math.max(0, p.wanted - 1);
        if (p.wanted === 0) {
          // The heat is off: the force stands down.
          for (const car of G.cars) if (car.kind === 'police') car.dead = true;
          G.cops = [];
        }
      }
    } else {
      p.coolTimer = 0;
    }
  }
}

function nearestPoliceDist(G) {
  let best = Infinity;
  for (const car of G.cars) {
    if (car.kind !== 'police' || car.dead) continue;
    best = Math.min(best, dist(car.x, car.y, G.player.x, G.player.y));
  }
  for (const cop of G.cops) {
    if (cop.dead) continue;
    best = Math.min(best, dist(cop.x, cop.y, G.player.x, G.player.y));
  }
  return best;
}

function updatePoliceCar(G, car, dt) {
  const p = G.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const desired = Math.atan2(ty - car.y, tx - car.x);
  const d = dist(car.x, car.y, tx, ty);

  // Steer toward the player; reverse briefly when wedged against a building.
  const pos = { x: car.x, y: car.y };
  const beforeX = car.x;
  const beforeY = car.y;
  if (car.reverseTime > 0) {
    car.reverseTime -= dt;
    car.angle = angleApproach(car.angle, desired + Math.PI, 3 * dt);
    car.speed = lerp(car.speed, -180, dt * 4);
  } else {
    car.angle = angleApproach(car.angle, desired, 2.6 * dt);
    const target = d > 260 ? POLICE.carTopSpeed : POLICE.carTopSpeed * 0.8;
    car.speed = lerp(car.speed, target, dt * 1.8);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  pos.x = car.x;
  pos.y = car.y;
  const hitWall = collideCity(pos, 24, G.city);
  car.x = pos.x;
  car.y = pos.y;
  const moved = dist(beforeX, beforeY, car.x, car.y);
  if (hitWall && Math.abs(car.speed) > 120) {
    car.stuckTime += dt;
    if (car.stuckTime > 0.9) {
      car.reverseTime = 0.8;
      car.stuckTime = 0;
    }
  } else {
    car.stuckTime = Math.max(0, car.stuckTime - dt);
  }
  void moved;
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;

  // Ram the player's car: damage on contact.
  if (p.car && !p.car.dead) {
    const dd = dist(car.x, car.y, p.car.x, p.car.y);
    if (dd < 48) {
      const rel = Math.abs(car.speed) + Math.abs(p.car.speed);
      if (rel > 240 && car.ramCooldown !== true) {
        damageCar(G, p.car, 8);
        damageCar(G, car, 4);
        car.ramCooldown = true;
        setTimeout(() => { car.ramCooldown = false; }, 900);
        G.camera.shake = Math.min(9, rel / 80);
        G.sound.thud(0.5);
        spawnSparks(G, (car.x + p.car.x) / 2, (car.y + p.car.y) / 2, 6);
      }
    }
  }
}

function updateCop(G, cop, dt) {
  const p = G.player;
  const d = dist(cop.x, cop.y, p.x, p.y);
  const desired = Math.atan2(p.y - cop.y, p.x - cop.x);
  cop.angle = angleApproach(cop.angle, desired, 4 * dt);

  if (p.onFoot) {
    // On foot, the player can be busted: hold still near an officer too long.
    if (d < 30) {
      cop.bustHold += dt;
      if (cop.bustHold >= POLICE.bustTime) {
        G.events.push('busted');
      }
    } else {
      cop.bustHold = 0;
    }
  }

  // Close the distance, then shoot.
  let speed = POLICE.copSpeed;
  if (d < 200) speed = 0;
  const pos = { x: cop.x, y: cop.y };
  pos.x += Math.cos(cop.angle) * speed * dt;
  pos.y += Math.sin(cop.angle) * speed * dt;
  collideCity(pos, 11, G.city);
  cop.x = pos.x;
  cop.y = pos.y;
  cop.walkPhase += dt * speed * 0.08;

  cop.shootCooldown -= dt;
  if (d < POLICE.shootRange && cop.shootCooldown <= 0 && p.wanted >= 2) {
    cop.shootCooldown = 0.9 + Math.random() * 0.7;
    // An officer's shot: inaccurate at range, deadly up close.
    const spread = 0.14 + d / 2400;
    const a = desired + (Math.random() - 0.5) * 2 * spread;
    G.bullets.push({
      x: cop.x, y: cop.y, angle: a,
      speed: 780, range: POLICE.shootRange + 80, travelled: 0,
      damage: 9, friendly: false, life: 1.2,
    });
    G.sound.gunshot();
    G.particles.push({
      x: cop.x + Math.cos(a) * 18, y: cop.y + Math.sin(a) * 18,
      vx: 0, vy: 0, life: 0.08, maxLife: 0.08, size: 9, color: '#ffd23f', kind: 'flash',
    });
  }
}
