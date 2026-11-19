// Palmira Bay — story missions: five chapters for Rosa's crew, from a first
// stolen sedan to the Coral Bank score. Each mission is a small state machine.
import { dist } from './util.js';
import { spawnEnemy } from './combat.js';
import { addWanted, clearWanted } from './police.js';
import { nearestCar } from './vehicles.js';

export const STORY_INTRO = 'Rosa needs a driver. Palmira Bay is yours — take it, one job at a time.';
export const MISSION_DEFS = [
  {
    id: 'm1', title: 'First Wheels', giver: 'Rosa',
    brief: 'Rosa needs wheels. Steal any parked car and bring it to the Mango Motel.',
    reward: 200, steps: [
      { type: 'stealCar', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', x: 700, y: 2100, r: 90, text: 'Drive the car to the Mango Motel' },
    ],
  },
  {
    id: 'm2', title: 'Courier Run', giver: 'Rosa',
    brief: 'A package for the Coral Crown Casino. Fast, quiet, no cops. 90 seconds.',
    reward: 350, steps: [
      { type: 'goto', x: 1560, y: 180, r: 90, text: 'Deliver the package to the Coral Crown Casino', timer: 90 },
    ],
  },
  {
    id: 'm3', title: 'Heat Wave', giver: 'Dante',
    brief: 'Dante rattled the PBPD. Lose a 3-star wanted level — hide, don\'t fight.',
    reward: 400, steps: [
      { type: 'heat', stars: 3, text: 'Survive the heat, then lose the cops (3 stars)' },
      { type: 'loseHeat', text: 'Lose the wanted level completely' },
    ],
  },
  {
    id: 'm4', title: 'Payback', giver: 'Rosa',
    brief: 'The Vipers jumped our courier at the docks. Clear them out — all four.',
    reward: 600, steps: [
      { type: 'goto', x: 500, y: 2200, r: 110, text: 'Reach the South Docks' },
      { type: 'kill', count: 4, text: 'Take out the Vipers (4 left)' },
    ],
  },
  {
    id: 'm5', title: 'The Big Score', giver: 'Rosa',
    brief: 'Coral Bank, noon. Grab the cash, then shake a 3-star chase to the pier.',
    reward: 1500, steps: [
      { type: 'goto', x: 1750, y: 1150, r: 90, text: 'Reach the Coral Bank' },
      { type: 'grab', text: 'Grab the cash (press E at the bank doors)' },
      { type: 'goto', x: 3300, y: 1400, r: 100, text: 'Escape to Bayview Pier with the cash' },
    ],
  },
];
export function createMissions() {
  return { index: 0, active: null, step: 0, timer: 0, killsLeft: 0, done: [], failed: false };
}
export function currentMission(missions) {
  return MISSION_DEFS[missions.index] || null;
}
export function startMission(G) {
  const def = currentMission(G.missions);
  if (!def || G.missions.active) return;
  G.missions.active = def;
  G.missions.step = 0;
  G.missions.timer = 0;
  G.missions.killsLeft = 0;
  G.missions.failed = false;
  enterStep(G, def.steps[0]);
  G.toast('MISSION: ' + def.title + ' — ' + def.brief);
  G.playSfx('mission');
}
function enterStep(G, step) {
  if (!step) return;
  if (step.type === 'heat') addWanted(G, step.stars, 'Dante rattled the PBPD');
  if (step.type === 'kill') {
    G.missions.killsLeft = step.count;
    const cx = 500, cy = 2200;
    for (let i = 0; i < step.count; i++) spawnEnemy(G, cx + (i % 2) * 90 - 45, cy + Math.floor(i / 2) * 80 - 40, i === 3 ? 'boss' : 'thug');
  }
  if (step.timer) G.missions.timer = step.timer;
  G.missions.stepText = step.text;
}
export function updateMissions(G, dt) {
  const M = G.missions;
  if (!M.active) return;
  const def = M.active;
  const step = def.steps[M.step];
  if (!step) { completeMission(G); return; }
  const p = G.player;
  if (step.timer) {
    M.timer -= dt;
    if (M.timer <= 0) { failMission(G, 'Out of time!'); return; }
  }
  switch (step.type) {
    case 'stealCar':
      if (p.inCar) nextStep(G);
      break;
    case 'goto': {
      const x = p.inCar ? p.inCar.x : p.x;
      const y = p.inCar ? p.inCar.y : p.y;
      if (dist(x, y, step.x, step.y) < step.r) nextStep(G);
      break;
    }
    case 'heat':
      if (p.wanted >= step.stars) nextStep(G);
      break;
    case 'loseHeat':
      if (p.wanted === 0) nextStep(G);
      break;
    case 'kill': {
      const left = G.enemies.filter((e) => !e.dead).length;
      M.killsLeft = left;
      M.stepText = 'Take out the Vipers (' + left + ' left)';
      if (left === 0) nextStep(G);
      break;
    }
    case 'grab':
      if (M.grabbed) nextStep(G);
      break;
    default: break;
  }
}
export function nextStep(G) {
  const M = G.missions;
  M.step++;
  const def = M.active;
  if (M.step >= def.steps.length) { completeMission(G); return; }
  enterStep(G, def.steps[M.step]);
  G.playSfx('pickup');
}
export function missionMarker(G) {
  const M = G.missions;
  if (!M.active) return null;
  const step = M.active.steps[M.step];
  if (!step || step.x === undefined) return null;
  return { x: step.x, y: step.y, r: step.r || 90 };
}
export function completeMission(G) {
  const M = G.missions;
  const def = M.active;
  G.player.cash += def.reward;
  G.player.missionsDone++;
  G.player.respect += 20;
  M.done.push(def.id);
  M.active = null;
  M.index++;
  G.toast('MISSION COMPLETE: ' + def.title + ' — +' + def.reward + '$');
  G.playSfx('cash');
  G.banner = { title: 'MISSION COMPLETE', sub: def.title + '  •  +' + def.reward + '$', t: 3 };
  if (M.index >= MISSION_DEFS.length) {
    G.banner = { title: 'PALMIRA BAY IS YOURS', sub: 'All five chapters done. Free roam, bray — the city never sleeps.', t: 5 };
  }
}
export function failMission(G, why) {
  const M = G.missions;
  M.active = null;
  M.failed = true;
  G.toast('MISSION FAILED: ' + why + ' — talk to Rosa to retry.');
  G.playSfx('fail');
  G.banner = { title: 'MISSION FAILED', sub: why, t: 3 };
  clearWanted(G);
}
export function missionGiverPos(G) {
  const def = currentMission(G.missions);
  if (!def) return null;
  return { x: 1450, y: 1250, name: def.giver };
}
