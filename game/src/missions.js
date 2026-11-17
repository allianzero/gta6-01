// Missions and story: six jobs for Marco "Rook" Santana, from his first stolen
// car to the King of Palmira. Each mission is a list of steps — go somewhere,
// steal a car, collect packages, survive the heat, outrun a timer, or take out
// a rival crew — with a cash reward at the end.

import { MISSIONS } from './config.js';
import { makeRng, range } from './rng.js';
import { dist, formatTime } from './util.js';
import { randomStreetPoint, randomSidewalkPoint } from './city.js';

const STORY = {
  intro: 'Palmira Bay, 2026. Marco "Rook" Santana is back in town with nothing but a burner phone and a debt. Six jobs stand between him and the crown.',
  outro: 'The crown is yours, Rook. Palmira Bay belongs to the King now — free roam, no more jobs, just the city.',
};

export function missionCount() {
  return MISSIONS.length;
}

export function missionName(index) {
  return MISSIONS[index] ? MISSIONS[index].name : 'Free Roam';
}

export function missionReward(index) {
  return MISSIONS[index] ? MISSIONS[index].reward : 0;
}

/** Build the step list for a mission, with markers picked from a seeded rng. */
function buildSteps(G, index) {
  const rng = makeRng(G.seed + 5000 + index * 1013);
  const p = G.player;
  const far = () => {
    let pt = randomStreetPoint(rng);
    for (let tries = 0; tries < 12 && dist(pt.x, pt.y, p.x, p.y) < 900; tries++) {
      pt = randomStreetPoint(rng);
    }
    return pt;
  };
  const near = () => {
    let pt = randomSidewalkPoint(rng);
    for (let tries = 0; tries < 12 && dist(pt.x, pt.y, p.x, p.y) < 500; tries++) {
      pt = randomSidewalkPoint(rng);
    }
    return pt;
  };

  switch (index) {
    case 0: {
      const marina = far();
      return [
        { type: 'enterCar', text: 'Steal a car — walk up to one and press E' },
        { type: 'goto', x: marina.x, y: marina.y, radius: 110, text: 'Drive to the Marina' },
      ];
    }
    case 1: {
      const alley = near();
      const hotel = far();
      return [
        { type: 'goto', x: alley.x, y: alley.y, radius: 70, text: 'Pick up the package in the alley' },
        { type: 'goto', x: hotel.x, y: hotel.y, radius: 110, text: 'Deliver the package to the hotel' },
      ];
    }
    case 2:
      return [
        { type: 'wanted', stars: 2, text: 'The cops are on to you — get spotted' },
        { type: 'survive', seconds: 45, text: 'Lose the heat: survive 45 seconds' },
      ];
    case 3: {
      const stops = [far(), far(), far()];
      return [
        { type: 'collect', count: 3, stops, collected: 0, text: 'Collect the three drops' },
      ];
    }
    case 4: {
      const hideout = far();
      return [
        { type: 'wanted', stars: 3, text: 'Grab a car — the cops are already coming' },
        { type: 'timedGoto', x: hideout.x, y: hideout.y, radius: 110, seconds: 100, text: 'Reach the hideout before the timer runs out' },
      ];
    }
    case 5: {
      const crew = near();
      const party = far();
      return [
        { type: 'eliminate', count: 4, at: crew, text: 'Take out the rival crew (4 gunners)' },
        { type: 'goto', x: party.x, y: party.y, radius: 110, text: 'Reach the rooftop party' },
      ];
    }
    default:
      return [];
  }
}

export function startMission(G, index) {
  const steps = buildSteps(G, index);
  G.mission = {
    index,
    stepIndex: 0,
    steps,
    active: true,
    failed: false,
    failTimer: 0,
    timer: 0,
    enemies: [],
    banner: null,
  };
  const step = steps[0];
  if (step) enterStep(G, step);
  showBanner(G, `MISSION ${index + 1}: ${missionName(index)}`, step ? step.text : '');
}

export function showBanner(G, title, sub) {
  G.banner = { title, sub, until: G.time + 4 };
}

function enterStep(G, step) {
  const p = G.player;
  if (step.type === 'wanted') {
    p.wanted = Math.max(p.wanted, step.stars);
    p.lastCrimeAt = G.time;
    p.addHeat(0);
  }
  if (step.type === 'survive') {
    G.mission.timer = step.seconds;
  }
  if (step.type === 'timedGoto') {
    G.mission.timer = step.seconds;
  }
  if (step.type === 'collect') {
    spawnCollectMarker(G, step);
  }
  if (step.type === 'eliminate') {
    spawnCrew(G, step);
  }
}

function spawnCollectMarker(G, step) {
  const stop = step.stops[step.collected];
  if (!stop) return;
  G.pickups.push({
    x: stop.x, y: stop.y, kind: 'drop', amount: 0,
    life: 600, bob: 0, mission: true,
  });
}

function spawnCrew(G, step) {
  const rng = makeRng(G.seed + 9100 + G.mission.index);
  G.mission.enemies = [];
  for (let i = 0; i < step.count; i++) {
    const x = step.at.x + range(rng, -90, 90);
    const y = step.at.y + range(rng, -90, 90);
    G.mission.enemies.push({
      x, y, angle: rng() * Math.PI * 2,
      health: 60, shootCooldown: 0.5 + rng(), dead: false, walkPhase: 0,
    });
  }
}

function advanceStep(G) {
  const m = G.mission;
  m.stepIndex++;
  if (m.stepIndex >= m.steps.length) {
    completeMission(G);
    return;
  }
  const step = m.steps[m.stepIndex];
  enterStep(G, step);
  showBanner(G, missionName(m.index), step.text);
}

function completeMission(G) {
  const m = G.mission;
  const reward = missionReward(m.index);
  const p = G.player;
  p.cash += reward;
  G.stats.cashEarned = (G.stats.cashEarned || 0) + reward;
  G.stats.missionsDone = (G.stats.missionsDone || 0) + 1;
  G.save.cash = p.cash;
  G.save.missionsDone = m.index + 1;
  G.sound.jingle();
  showBanner(G, 'MISSION PASSED', `+$${reward.toLocaleString('en-US')} — ${missionName(m.index)}`);
  G.floaters.push({ x: p.x, y: p.y - 30, text: `+$${reward}`, color: '#7dff9b', life: 1.6 });
  m.active = false;
  m.completedAt = G.time;
  // The next job starts after a breath.
  m.nextAt = G.time + 3.5;
}

export function failMission(G, reason) {
  const m = G.mission;
  if (!m.active || m.failed) return;
  m.failed = true;
  m.failTimer = 3;
  showBanner(G, 'MISSION FAILED', reason);
  G.sound.blip(180, 0.4, 0.4);
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (!m) return;

  // Between missions: start the next one, or free roam after the last.
  if (!m.active) {
    if (m.nextAt && G.time >= m.nextAt) {
      m.nextAt = null;
      if (m.index + 1 < MISSIONS.length) {
        startMission(G, m.index + 1);
      } else if (!m.allDoneShown) {
        m.allDoneShown = true;
        showBanner(G, 'KING OF PALMIRA', STORY.outro);
        G.events.push('allMissionsDone');
      }
    }
    return;
  }
  if (m.failed) {
    m.failTimer -= dt;
    if (m.failTimer <= 0) {
      m.failed = false;
      startMission(G, m.index);
    }
    return;
  }

  const step = m.steps[m.stepIndex];
  if (!step) return;
  const p = G.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;

  switch (step.type) {
    case 'enterCar':
      if (p.car) advanceStep(G);
      break;
    case 'goto':
      if (dist(px, py, step.x, step.y) < step.radius) advanceStep(G);
      break;
    case 'timedGoto':
      m.timer -= dt;
      if (dist(px, py, step.x, step.y) < step.radius) advanceStep(G);
      else if (m.timer <= 0) failMission(G, 'Too slow — the hideout went cold.');
      break;
    case 'survive': {
      m.timer -= dt;
      if (m.timer <= 0 || p.wanted === 0) advanceStep(G);
      break;
    }
    case 'wanted':
      if (p.wanted >= step.stars) advanceStep(G);
      break;
    case 'collect': {
      // A drop is collected by walking or driving over its marker.
      const stop = step.stops[step.collected];
      if (stop && dist(px, py, stop.x, stop.y) < 60) {
        step.collected++;
        G.pickups = G.pickups.filter((pk) => !(pk.mission && pk.x === stop.x && pk.y === stop.y));
        G.sound.blip(990, 0.12, 0.3);
        G.floaters.push({ x: stop.x, y: stop.y - 10, text: `DROP ${step.collected}/3`, color: '#ffd23f', life: 1 });
        if (step.collected >= step.count) advanceStep(G);
        else spawnCollectMarker(G, step);
      }
      break;
    }
    case 'eliminate': {
      const alive = m.enemies.filter((e) => !e.dead).length;
      if (alive === 0) advanceStep(G);
      break;
    }
    default:
      break;
  }

  updateEnemies(G, dt);
}

/** The rival crew: armed, stationary-ish, shooting at the player. */
export function updateEnemies(G, dt) {
  const m = G.mission;
  if (!m || !m.enemies) return;
  const p = G.player;
  for (const e of m.enemies) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, p.x, p.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    e.shootCooldown -= dt;
    if (d < 380 && e.shootCooldown <= 0 && G.mode === 'playing') {
      e.shootCooldown = 0.8 + Math.random() * 0.8;
      const spread = 0.1 + d / 3000;
      const a = e.angle + (Math.random() - 0.5) * 2 * spread;
      G.bullets.push({
        x: e.x + Math.cos(a) * 18, y: e.y + Math.sin(a) * 18,
        angle: a, speed: 780, range: 460, travelled: 0,
        damage: 8, friendly: false, life: 1.2,
      });
      G.sound.gunshot();
    }
  }
}

/** Damage one of the mission's enemies; returns true when it died. */
export function damageEnemy(G, e, amount) {
  e.health -= amount;
  if (e.health <= 0 && !e.dead) {
    e.dead = true;
    for (let i = 0; i < 8; i++) {
      G.particles.push({
        x: e.x, y: e.y,
        vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160,
        life: 0.4, maxLife: 0.4, size: 3, color: '#c0392b', kind: 'spark',
      });
    }
    return true;
  }
  return false;
}

/** The current objective line for the HUD, or null in free roam. */
export function objectiveText(G) {
  const m = G.mission;
  if (!m || !m.active || m.failed) return null;
  const step = m.steps[m.stepIndex];
  if (!step) return null;
  let text = step.text;
  if (step.type === 'survive' || step.type === 'timedGoto') {
    text += ` — ${formatTime(m.timer)}`;
  }
  if (step.type === 'collect') {
    text += ` (${step.collected}/${step.count})`;
  }
  if (step.type === 'eliminate') {
    const alive = m.enemies.filter((e) => !e.dead).length;
    text += ` (${step.count - alive}/${step.count})`;
  }
  return text;
}

/** The world position the HUD arrow and minimap should point at, or null. */
export function objectiveMarker(G) {
  const m = G.mission;
  if (!m || !m.active || m.failed) return null;
  const step = m.steps[m.stepIndex];
  if (!step) return null;
  if (step.type === 'goto' || step.type === 'timedGoto') return { x: step.x, y: step.y };
  if (step.type === 'collect') {
    const stop = step.stops[step.collected];
    return stop ? { x: stop.x, y: stop.y } : null;
  }
  if (step.type === 'eliminate') {
    const alive = m.enemies.find((e) => !e.dead);
    return alive ? { x: alive.x, y: alive.y } : null;
  }
  return null;
}

export { STORY };
