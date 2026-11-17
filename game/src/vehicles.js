// Cars: the player's arcade driving, and the traffic that fills Palmira Bay.
// Traffic cars drive on the right-hand lane of a street and turn at
// intersections; the player's car uses a simple drift-friendly arcade model.

import { CAR, TRAFFIC, WORLD, WORLD_W, CAR_COLORS } from './config.js';
import { makeRng, range, pick } from './rng.js';
import { clamp, lerp, angleApproach, angleDiff, dist, TAU } from './util.js';
import { streetCenters, nearestStreetCoord, randomStreetPoint, collideCity } from './city.js';

let nextCarId = 1;

export function makeCar(x, y, angle, color, kind) {
  return {
    id: nextCarId++,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    color,
    kind, // 'traffic' | 'police' | 'player'
    driver: kind === 'traffic' ? 'traffic' : null,
    health: CAR.maxHealth,
    maxHealth: CAR.maxHealth,
    cruise: range(Math.random, TRAFFIC.cruiseMin, TRAFFIC.cruiseMax),
    axis: 'h',
    dir: 1,
    street: 0,
    turning: false,
    targetAngle: angle,
    stuckTime: 0,
    reverseTime: 0,
    dead: false,
    smoke: 0,
  };
}

/** A traffic car placed on a random street, already in its lane. */
export function spawnTrafficCar(G, rng) {
  const centers = streetCenters();
  const horizontal = rng() < 0.5;
  const street = pick(rng, centers);
  const dir = rng() < 0.5 ? 1 : -1;
  const along = range(rng, 300, WORLD_W - 300);
  const lane = 30;
  const x = horizontal ? along : street + (dir > 0 ? lane : -lane);
  const y = horizontal ? street + (dir > 0 ? lane : -lane) : along;
  const angle = horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  const car = makeCar(x, y, angle, pick(rng, CAR_COLORS), 'traffic');
  car.axis = horizontal ? 'h' : 'v';
  car.dir = dir;
  car.street = street;
  car.cruise = range(rng, TRAFFIC.cruiseMin, TRAFFIC.cruiseMax);
  car.speed = car.cruise;
  return car;
}

export function spawnTraffic(G, count) {
  const rng = makeRng(G.seed + 77);
  for (let i = 0; i < count; i++) {
    let car = null;
    for (let tries = 0; tries < 12 && !car; tries++) {
      const c = spawnTrafficCar(G, rng);
      const nearPlayer = dist(c.x, c.y, G.player.x, G.player.y) < 320;
      const nearOther = G.cars.some((o) => dist(o.x, o.y, c.x, c.y) < 120);
      if (!nearPlayer && !nearOther) car = c;
    }
    if (car) G.cars.push(car);
  }
}

/** Lane centre for a car on `street`, travelling `dir` along `axis`. */
function laneCoord(street, axis, dir) {
  return street + (dir > 0 ? 30 : -30);
}

/** Heading for axis + direction. */
function headingFor(axis, dir) {
  if (axis === 'h') return dir > 0 ? 0 : Math.PI;
  return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
}

function updateTrafficCar(G, car, dt) {
  if (car.turning) {
    car.angle = angleApproach(car.angle, car.targetAngle, 2.4 * dt);
    car.speed = lerp(car.speed, car.cruise * 0.45, dt * 4);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (Math.abs(angleDiff(car.angle, car.targetAngle)) < 0.05) {
      car.angle = car.targetAngle;
      car.turning = false;
      // Snap onto the new lane so the car stays centred.
      if (car.axis === 'h') car.y = laneCoord(car.street, 'h', car.dir);
      else car.x = laneCoord(car.street, 'v', car.dir);
    }
    return;
  }

  // Car ahead in the same lane: slow down, stop if too close.
  let desired = car.cruise;
  const ahead = 90;
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < ahead + other.speed * 0.4 && side < 34) {
      desired = Math.min(desired, Math.max(0, (forward - TRAFFIC.followGap) * 2.2));
      if (forward < TRAFFIC.followGap * 0.75) desired = 0;
    }
  }
  // A pedestrian crossing right in front: brake.
  for (const p of G.peds) {
    if (p.dead) continue;
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < 70 && side < 30) desired = 0;
  }
  car.speed = lerp(car.speed, desired, dt * 3);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Safety net: a turn's arc can clip a building corner; push back onto the road.
  const pos = { x: car.x, y: car.y };
  collideCity(pos, 20, G.city);
  car.x = pos.x;
  car.y = pos.y;

  // At an intersection, maybe turn. The crossing street is the one nearest
  // the car's current position on the other axis.
  const along = car.axis === 'h' ? car.x : car.y;
  const crossCoord = car.axis === 'h' ? car.y : car.x;
  const nearestCross = nearestStreetCoord(crossCoord);
  const distToCross = Math.abs(crossCoord - nearestCross);
  const atEdge =
    along < WORLD.road + 140 ||
    along > WORLD_W - WORLD.road - 140;
  if (distToCross < 26 && car.speed > 40) {
    const mustTurn = atEdge;
    const rng = G.trafficRng;
    if (mustTurn || rng() < TRAFFIC.turnChance * dt * 60 * 0.12) {
      const newAxis = car.axis === 'h' ? 'v' : 'h';
      const newDir = rng() < 0.5 ? 1 : -1;
      // The crossing street becomes the car's new street.
      const newStreet = nearestCross;
      car.axis = newAxis;
      car.dir = newDir;
      car.street = newStreet;
      car.targetAngle = headingFor(newAxis, newDir);
      car.turning = true;
      return;
    }
  }
  // Ran past the last intersection heading for the edge: U-turn.
  // Streets run to WORLD_W; the outermost street centre is WORLD_W - 60.
  const maxAlong = WORLD_W - 20;
  if ((car.dir > 0 && along > maxAlong) || (car.dir < 0 && along < 20)) {
    car.dir = -car.dir;
    car.targetAngle = headingFor(car.axis, car.dir);
    car.turning = true;
  }
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.kind !== 'traffic' || car.dead) continue;
    updateTrafficCar(G, car, dt);
  }
}

/** The player's car: arcade throttle, steering and handbrake drift. */
export function updatePlayerCar(G, car, dt, input) {
  const axes = input.axes();
  const throttle = axes.y < 0 ? 1 : 0; // W / Up
  const braking = axes.y > 0 ? 1 : 0; // S / Down
  const steerInput = axes.x;
  const handbrake = input.down('Space');

  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const forwardSpeed = car.vx * forwardX + car.vy * forwardY;

  let accel = 0;
  if (throttle) accel += CAR.accel;
  if (braking) {
    accel += forwardSpeed > 30 ? -CAR.brake : -CAR.reverseAccel;
  }
  // Rolling drag.
  accel -= forwardSpeed * 0.55;

  const newForward = clamp(forwardSpeed + accel * dt, -CAR.reverseTop, CAR.topSpeed);
  // Steering bites harder the faster the car goes, up to a point.
  const steerAuthority = clamp(Math.abs(forwardSpeed) / 220, 0, 1);
  const steerRate = CAR.steer * steerAuthority * (handbrake ? 1.5 : 1);
  car.angle += steerInput * steerRate * dt * Math.sign(forwardSpeed || 1);

  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  // Velocity follows the heading with grip; the handbrake loosens it (drift).
  const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
  const targetVx = nx * newForward;
  const targetVy = ny * newForward;
  car.vx = lerp(car.vx, targetVx, clamp(grip * dt, 0, 1));
  car.vy = lerp(car.vy, targetVy, clamp(grip * dt, 0, 1));

  const pos = { x: car.x, y: car.y };
  pos.x += car.vx * dt;
  pos.y += car.vy * dt;
  const hitWall = collideCity(pos, 26, G.city);
  if (hitWall) {
    // A hard hit costs speed and health; a soft one just stops the car.
    const impact = Math.hypot(car.vx, car.vy);
    if (impact > 260) {
      damageCar(G, car, Math.min(24, (impact - 260) / 18));
      G.sound.thud(Math.min(0.7, impact / 900));
      G.camera.shake = Math.min(10, impact / 60);
      spawnSparks(G, pos.x, pos.y, 8);
    }
    car.vx *= 0.35;
    car.vy *= 0.35;
  }
  car.x = pos.x;
  car.y = pos.y;
  car.speed = Math.hypot(car.vx, car.vy);

  // Skid smoke when drifting hard or handbraking at speed.
  const lateral = Math.abs(-car.vx * ny + car.vy * nx);
  if ((handbrake && car.speed > 200) || lateral > 240) {
    if (Math.random() < 0.6) {
      G.particles.push({
        x: car.x - nx * 24, y: car.y - ny * 24,
        vx: -car.vx * 0.1, vy: -car.vy * 0.1,
        life: 0.6, maxLife: 0.6, size: 9, color: 'rgba(200,200,200,0.5)', kind: 'smoke',
      });
    }
  }
  if (car.health < 35 && Math.random() < dt * 8) {
    G.particles.push({
      x: car.x + (Math.random() - 0.5) * 20, y: car.y + (Math.random() - 0.5) * 20,
      vx: 0, vy: -30, life: 0.9, maxLife: 0.9, size: 7,
      color: 'rgba(60,60,60,0.7)', kind: 'smoke',
    });
  }
}

/** Push overlapping cars apart and trade damage on hard hits. */
export function collideCars(G) {
  const cars = G.cars.filter((c) => !c.dead);
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 46;
      if (d >= min || d < 0.01) continue;
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
      const aSpeed = Math.hypot(a.vx, a.vy);
      const bSpeed = Math.hypot(b.vx, b.vy);
      const impact = rel + Math.abs(aSpeed - bSpeed) * 0.4;
      if (impact > 200) {
        const dmg = Math.min(18, (impact - 200) / 22);
        damageCar(G, a, dmg);
        damageCar(G, b, dmg);
        if (a.kind === 'player' || b.kind === 'player') {
          G.sound.thud(Math.min(0.6, impact / 1000));
          G.camera.shake = Math.min(8, impact / 70);
        }
        spawnSparks(G, (a.x + b.x) / 2, (a.y + b.y) / 2, 5);
      }
      // Trade a little velocity so the hit feels physical.
      const swap = 0.25;
      const avx = a.vx, avy = a.vy;
      a.vx = lerp(a.vx, b.vx, swap);
      a.vy = lerp(a.vy, b.vy, swap);
      b.vx = lerp(b.vx, avx, swap);
      b.vy = lerp(b.vy, avy, swap);
    }
  }
}

export function damageCar(G, car, amount) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    explodeCar(G, car);
  }
}

export function explodeCar(G, car) {
  car.dead = true;
  G.camera.shake = 14;
  G.sound.thud(0.9);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * TAU;
    const sp = 60 + Math.random() * 320;
    G.particles.push({
      x: car.x, y: car.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.7, maxLife: 1.2,
      size: 6 + Math.random() * 10,
      color: ['#ff9f1c', '#ff5714', '#ffd23f', '#555'][i % 4],
      kind: 'fire',
    });
  }
  for (let i = 0; i < 12; i++) {
    G.particles.push({
      x: car.x, y: car.y,
      vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60,
      life: 1.4 + Math.random(), maxLife: 2.4, size: 12 + Math.random() * 10,
      color: 'rgba(50,50,50,0.65)', kind: 'smoke',
    });
  }
  if (car.driver === 'player') {
    // The player is thrown out on foot, hurt but alive.
    const p = G.player;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + 40;
    p.y = car.y;
    p.health = Math.max(25, p.health - 30);
    p.angle = car.angle;
  }
  // A traffic car that burns out is replaced, so the streets stay full.
  if (car.kind === 'traffic') {
    setTimeout(() => {
      if (G.mode === 'playing') {
        const rng = makeRng((Math.random() * 1e9) | 0);
        const c = spawnTrafficCar(G, rng);
        G.cars.push(c);
      }
    }, 4000);
  }
}

export function spawnSparks(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = 80 + Math.random() * 220;
    G.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.25 + Math.random() * 0.25, maxLife: 0.5,
      size: 2 + Math.random() * 2, color: '#ffd23f', kind: 'spark',
    });
  }
}

/** The nearest drivable car to a point, within `range` pixels. */
export function nearestCar(G, x, y, rangePx) {
  let best = null;
  let bestD = rangePx;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
