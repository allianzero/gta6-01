// Palmira Bay — the PBPD: the wanted system and police who chase, ram and
// bust the player. Heat rises with crime and cools when you lay low.
import { MAX_WANTED, WANTED_DECAY, COP_RESPAWN } from './config.js';
import { makeCar } from './vehicles.js';
import { clamp, dist, angleTo, turnToward } from './util.js';
import { randomRoadSpot } from './world.js';
import { makeRng } from './rng.js';

export function addWanted(G, stars, reason) {
  const p = G.player;
  const before = p.wanted;
  p.wanted = clamp(p.wanted + stars, 0, MAX_WANTED);
  p.wantedTimer = 0;
  if (p.wanted > before) {
    G.toast('WANTED ' + p.wanted + '★ — ' + reason);
    if (p.wanted >= 2) G.playSfx('siren');
  }
}
export function wantedTargetCops(wanted) {
  return wanted === 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted === 3 ? 3 : wanted === 4 ? 4 : 6;
}
export function spawnCop(G) {
  const rng = makeRng(G.seed + 7000 + G.copsSpawned * 31);
  const s = randomRoadSpot(rng);
  const p = G.player;
  const dx = p.x - s.x, dy = p.y - s.y;
  if (dx * dx + dy * dy < 500 * 500) { s.x = clamp(p.x + 600, 40, G.worldW - 40); s.y = clamp(p.y - 400, 40, G.worldH - 40); }
  const cop = makeCar('cop', s.x, s.y, angleTo(s.x, s.y, p.x, p.y), { traffic: false, driver: true });
  cop.speed = 200;
  cop.isCop = true;
  G.cars.push(cop);
  G.copsSpawned++;
  return cop;
}
export function updatePolice(G, dt) {
  const p = G.player;
  if (p.wanted > 0 && !p.dead) {
    p.wantedTimer += dt;
    if (p.wantedTimer > WANTED_DECAY && G.recentCrimeT <= 0) {
      p.wanted--;
      p.wantedTimer = 0;
      G.toast(p.wanted === 0 ? 'You lost the heat. Clean... for now.' : 'Heat cooling down: ' + p.wanted + '★');
    }
  }
  G.recentCrimeT = Math.max(0, G.recentCrimeT - dt);
  const cops = G.cars.filter((c) => c.isCop && !c.dead);
  const want = p.dead ? 0 : wantedTargetCops(p.wanted);
  G.copTimer -= dt;
  if (cops.length < want && G.copTimer <= 0) {
    spawnCop(G);
    G.copTimer = COP_RESPAWN;
  }
  for (const cop of cops) {
    updateCopCar(G, cop, dt);
  }
  if (p.wanted > 0 && p.inCar) {
    for (const cop of cops) {
      if (dist(cop.x, cop.y, p.x, p.y) < 60 && Math.abs(cop.speed) > 40) {
        cop.speed *= 0.4;
        p.inCar.speed *= 0.6;
        p.inCar.hp -= 2;
        G.playSfx('crash');
        G.addShake(4);
      }
    }
  }
  if (!p.inCar && p.wanted > 0) {
    for (const cop of cops) {
      if (dist(cop.x, cop.y, p.x, p.y) < 34) {
        bustPlayer(G);
        break;
      }
    }
  }
}
function updateCopCar(G, cop, dt) {
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const d = dist(cop.x, cop.y, px, py);
  const target = Math.atan2(py - cop.y, px - cop.x);
  const wantSpeed = d > 700 ? 380 : d > 120 ? 340 : 220;
  cop.speed += clamp(wantSpeed - cop.speed, -300 * dt, 240 * dt);
  cop.angle = turnToward(cop.angle, target, dt * 2.6);
  cop.x += Math.cos(cop.angle) * cop.speed * dt;
  cop.y += Math.sin(cop.angle) * cop.speed * dt;
  cop.sirenT = (cop.sirenT || 0) - dt;
  if (cop.sirenT <= 0 && d < 700) { G.playSfx('siren'); cop.sirenT = 1.4; }
  if (p.wanted === 0) {
    cop.isCop = false;
    cop.traffic = true;
    cop.speed = 120;
  }
}
export function bustPlayer(G) {
  const p = G.player;
  p.busted = true;
  p.wanted = 0;
  p.cash = Math.max(0, p.cash - 150);
  p.hp = 60;
  G.state = 'busted';
  G.stateTimer = 0;
  G.playSfx('busted');
  for (const c of G.cars) if (c.isCop) { c.isCop = false; c.traffic = true; }
}
export function clearWanted(G) {
  G.player.wanted = 0;
  G.player.wantedTimer = 0;
  for (const c of G.cars) if (c.isCop) { c.isCop = false; c.traffic = true; }
}
