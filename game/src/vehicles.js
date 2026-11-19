// Palmira Bay — vehicles: traffic cars, the player's ride, driving physics
// and car theft. Traffic follows the road grid and stops for jams.
import { CAR_DEFS } from './config.js';
import { makeRng, rngChoice, rngRange } from './rng.js';
import { clamp, dist, angleDiff, turnToward } from './util.js';
import { randomRoadSpot, nearestRoadPoint } from './world.js';

let carId = 1;
export function makeCar(defId, x, y, angle, opts) {
  const def = CAR_DEFS.find((d) => d.id === defId) || CAR_DEFS[0];
  return {
    id: carId++, defId: def.id, name: def.name, color: (opts && opts.color) || def.color,
    x, y, angle, speed: 0, w: def.w, h: def.h,
    maxSpeed: def.speed, accel: def.accel, grip: def.grip,
    traffic: !!(opts && opts.traffic), parked: !!(opts && opts.parked),
    driver: !!(opts && opts.driver), hp: 100, dead: false,
    target: null, waitT: 0, honkT: 0, brake: false, siren: defId === 'cop',
    route: null, routeI: 0,
  };
}
export function spawnTraffic(G, n) {
  const rng = makeRng(G.seed + 500 + G.trafficSpawned);
  for (let i = 0; i < n; i++) {
    const s = randomRoadSpot(rng);
    const def = rngChoice(rng, ['sedan', 'sedan', 'taxi', 'sport', 'truck', 'muscle']);
    const c = makeCar(def, s.x, s.y, s.angle, { traffic: true, driver: true });
    c.speed = rngRange(rng, 60, 120);
    G.cars.push(c);
  }
  G.trafficSpawned += n;
}
export function spawnParked(G, n) {
  const rng = makeRng(G.seed + 900);
  for (let i = 0; i < n; i++) {
    const s = randomRoadSpot(rng);
    const near = nearestRoadPoint(s.x, s.y);
    const px = near.x + (near.horizontal ? 0 : 34);
    const py = near.y + (near.horizontal ? 34 : 0);
    const def = rngChoice(rng, ['sedan', 'taxi', 'sport', 'truck', 'muscle']);
    G.cars.push(makeCar(def, px, py, near.horizontal ? 0 : Math.PI / 2, { parked: true }));
  }
}
export function nearestCar(G, x, y, maxD) {
  let best = null; let bd = maxD * maxD;
  for (const c of G.cars) {
    if (c.dead) continue;
    const d = dist(c.x, c.y, x, y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function carAhead(G, car, look) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < look && side < 30) return o;
  }
  return null;
}
export function updateTrafficCar(G, car, dt) {
  if (!car.route || car.routeI >= car.route.length) {
    const rng = makeRng(G.seed + car.id * 31 + Math.floor(G.time * 0.2));
    const dest = randomRoadSpot(rng);
    car.route = [dest];
    car.routeI = 0;
  }
  const dest = car.route[car.routeI];
  const ahead = carAhead(G, car, 70);
  let want = ahead ? 0 : 110;
  // Brake for a pedestrian stepping into the lane.
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const dx = ped.x - car.x, dy = ped.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < 80 && side < 26) { want = 0; break; }
  }
  car.speed += clamp(want - car.speed, -260 * dt, 130 * dt);
  const target = Math.atan2(dest.y - car.y, dest.x - car.x);
  car.angle = turnToward(car.angle, target, dt * 1.6);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (dist(car.x, car.y, dest.x, dest.y) < 60) car.routeI++;
  if (car.x < 30 || car.x > G.worldW - 30 || car.y < 30 || car.y > G.worldH - 30) {
    const s = randomRoadSpot(makeRng(G.seed + car.id + Math.floor(G.time)));
    car.x = s.x; car.y = s.y; car.angle = s.angle; car.route = null;
  }
}
export function updatePlayerCar(G, car, dt, throttle, steer) {
  const def = CAR_DEFS.find((d) => d.id === car.defId);
  const maxF = def.speed, maxR = -110;
  const accel = throttle > 0 ? def.accel : throttle < 0 ? def.accel * 0.8 : 0;
  car.speed += accel * throttle * dt;
  if (throttle === 0) car.speed -= car.speed * 1.4 * dt;
  if (G.input.keys.has(' ')) car.speed -= car.speed * 3.2 * dt;
  car.speed = clamp(car.speed, maxR, maxF);
  const turn = steer * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 90, 0, 1);
  car.angle += turn * def.grip * 0.55 * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 24, G.worldW - 24);
  car.y = clamp(car.y, 24, G.worldH - 24);
  for (const b of G.city.buildings) {
    if (car.x > b.x - 20 && car.x < b.x + b.w + 20 && car.y > b.y - 20 && car.y < b.y + b.h + 20) {
      if (Math.abs(car.speed) > 120) { car.hp -= 12; G.audio && G.playSfx('crash'); G.addShake(6); }
      car.speed *= -0.25;
      car.x -= Math.cos(car.angle) * 26;
      car.y -= Math.sin(car.angle) * 26;
    }
  }
}
export function stealCar(G, car) {
  const p = G.player;
  car.parked = false; car.traffic = false; car.driver = false;
  p.inCar = car;
  p.carsStolen++;
  G.playSfx('door');
  G.addWanted(1, 'Grand theft auto');
  G.toast('You stole the ' + car.name + '! The cops noticed.');
}
