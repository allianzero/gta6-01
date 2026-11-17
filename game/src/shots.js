// Screenshot presets: `?shot=start|drive|chase|mission` sets the game up in a
// fixed, seeded scene and warms the simulation up, so a screenshot shows the
// game actually being played — traffic moving, police chasing, a job in progress.

import { STEP } from './config.js';
import { clamp } from './util.js';
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { updateGame } from './world.js';

/** A fake input: still by default, holding the throttle when `driving`. */
function fakeInput(mouseX = 640, mouseY = 360, driving = false) {
  return {
    axes: () => (driving ? { x: 0, y: -1 } : { x: 0, y: 0 }),
    down: () => false,
    wasPressed: () => false,
    mouseDown: false,
    mouseX,
    mouseY,
    endFrame: () => {},
  };
}

function warmUp(G, frames, input) {
  for (let i = 0; i < frames; i++) {
    G.mode = 'playing';
    updateGame(G, STEP, input || fakeInput());
  }
}

/** Put the player in a car on a long straight street, already moving. */
function putPlayerInCar(G, x, y, angle, speed) {
  const p = G.player;
  // Find the parked car the world spawns by the start, or the nearest car.
  let car = G.cars.find((c) => c.kind === 'traffic' && c.cruise === 0);
  if (!car) car = G.cars.find((c) => c.kind === 'traffic');
  if (!car) return null;
  car.kind = 'player';
  car.driver = 'player';
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.vx = Math.cos(angle) * speed;
  car.vy = Math.sin(angle) * speed;
  car.speed = speed;
  car.health = 100;
  p.car = car;
  p.onFoot = false;
  p.x = x;
  p.y = y;
  p.angle = angle;
  G.camera.x = x;
  G.camera.y = y;
  G.camera.zoom = 0.85;
  return car;
}

function spawnPoliceNear(G, x, y, offsets) {
  for (const [dx, dy] of offsets) {
    const car = makeCar(x + dx, y + dy, Math.atan2(-dy, -dx), '#2b4acb', 'police');
    car.driver = 'police';
    car.cruise = 660;
    car.health = 120;
    car.maxHealth = 120;
    G.cars.push(car);
  }
}

export function applyShot(G, shot) {
  G.shotMode = shot;
  const p = G.player;

  if (shot === 'start') {
    // Title over a living city: traffic already moving around a busy crossroads.
    G.camera.x = 1980;
    G.camera.y = 1980;
    G.camera.zoom = 0.8;
    warmUp(G, 240);
    G.mode = 'title';
    G.camera.x = 1980;
    G.camera.y = 1980;
    return;
  }

  if (shot === 'drive') {
    startMission(G, 0);
    putPlayerInCar(G, 900, 2010, 0, 380);
    warmUp(G, 90, fakeInput(640, 360, true));
    return;
  }

  if (shot === 'chase') {
    startMission(G, 0);
    putPlayerInCar(G, 1500, 2010, 0, 420);
    p.addHeat(3);
    spawnPoliceNear(G, 1500, 2010, [[-420, -160], [-520, 120], [380, -220]]);
    warmUp(G, 150, fakeInput(640, 360, true));
    return;
  }

  if (shot === 'mission') {
    // Rook on foot, gun out, facing the rival crew at a crossroads.
    p.x = 1500;
    p.y = 1500;
    p.angle = Math.PI / 4;
    G.camera.x = 1500;
    G.camera.y = 1500;
    G.camera.zoom = 0.95;
    startMission(G, 5);
    // Bring the crew into view: lined up down the street east of the player.
    (G.mission.enemies || []).forEach((e, i) => {
      e.x = p.x + 190 + i * 58;
      e.y = p.y + 26 + (i % 2) * 34;
    });
    // Warm up so the crew opens fire and the scene is mid-action.
    warmUp(G, 45);
    // Aim at the nearest living gunner and fire a few shots.
    const enemy = (G.mission.enemies || []).find((e) => !e.dead);
    if (enemy) {
      const cam = G.camera;
      const sx = (enemy.x - cam.x) * cam.zoom + G.viewW / 2;
      const sy = (enemy.y - cam.y) * cam.zoom + G.viewH / 2;
      const input = fakeInput(clamp(sx, 0, G.viewW), clamp(sy, 0, G.viewH));
      input.mouseDown = true;
      warmUp(G, 8, input);
      input.mouseDown = false;
    }
    return;
  }

  // Unknown shot name: play normally from the title.
  G.mode = 'title';
}

export { fakeInput };
