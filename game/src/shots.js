// Palmira Bay — screenshot staging: ?shot=start|drive|chase|mission puts the
// live game into a fixed, readable scene for the entry's screenshots.
// The game itself renders everything; this only chooses the setup.
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { spawnEnemy } from './combat.js';

export function applyShot(G, shot) {
  const p = G.player;
  if (shot === 'start') {
    G.state = 'menu';
    G.menuSel = 0;
    return;
  }
  G.state = 'playing';
  if (shot === 'drive') {
    p.x = 900; p.y = 1320; p.angle = 0; // right-hand eastbound lane
    const car = makeCar('sport', 900, 1320, 0, {}); // Vortex GT, right lane
    car.speed = 180;
    G.cars.push(car);
    p.inCar = car;
    p.cash = 1240;
    G.camera.x = p.x - G.vw / 2;
    G.camera.y = p.y - G.vh / 2;
    G.toast('Driving the Vortex GT down the Neon Strip.');
    return;
  }
  if (shot === 'chase') {
    p.x = 900; p.y = 1320; p.angle = 0; // right-hand eastbound lane
    const car = makeCar('sport', 900, 1320, 0, {}); // getaway car, right lane
    car.speed = 240;
    G.cars.push(car);
    p.inCar = car;
    p.wanted = 3;
    p.cash = 3120;
    for (let i = 0; i < 3; i++) {
      const cop = makeCar('cop', 900 - 150 - i * 110, 1320 + (i % 2) * 56 - 28, 0, {}); // PBPD in pursuit
      cop.isCop = true;
      cop.speed = 380;
      G.cars.push(cop);
    }
    G.camera.x = p.x - G.vw / 2;
    G.camera.y = p.y - G.vh / 2;
    G.toast('WANTED 3★ — the PBPD is on your tail!');
    return;
  }
  if (shot === 'mission') {
    p.x = 560; p.y = 2128; p.angle = -0.6;
    p.cash = 860;
    p.weapon = 'pistol';
    if (!p.weapons.includes('pistol')) p.weapons.push('pistol');
    p.ammo.pistol = 24;
    G.missions.index = 3;
    startMission(G);
    // walk to the docks step, then spawn the Vipers for the fight
    G.missions.step = 1;
    G.missions.stepText = 'Take out the Vipers (4 left)';
    G.missions.killsLeft = 4;
    for (let i = 0; i < 4; i++) spawnEnemy(G, 470 + (i % 2) * 110 - 55, 2128 + Math.floor(i / 2) * 80 - 40, i === 3 ? 'boss' : 'thug');
    G.camera.x = p.x - G.vw / 2;
    G.camera.y = p.y - G.vh / 2;
    G.toast('MISSION: Payback — clear the Vipers at the South Docks.');
    return;
  }
  G.state = 'menu';
}
