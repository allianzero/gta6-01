// Combat: the player's pistol, enemy fire, and the pickups scattered around the
// city (cash, health, armour). Bullets are simple rays stepped each frame.

import { COMBAT, WORLD_W, WORLD_H } from './config.js';
import { dist, TAU } from './util.js';
import { hitsBuilding } from './city.js';
import { damageCar, spawnSparks } from './vehicles.js';
import { killPed } from './pedestrians.js';
import { damageEnemy } from './missions.js';

/** Fire the player's pistol toward a world point. */
export function playerShoot(G, wx, wy) {
  const p = G.player;
  if (p.fireCooldown > 0 || !p.onFoot) return;
  p.fireCooldown = COMBAT.fireCooldown;
  const angle = Math.atan2(wy - p.y, wx - p.x);
  G.bullets.push({
    x: p.x + Math.cos(angle) * 20, y: p.y + Math.sin(angle) * 20,
    angle, speed: COMBAT.bulletSpeed, range: COMBAT.bulletRange,
    travelled: 0, damage: COMBAT.bulletDamage, friendly: true, life: 1,
  });
  G.sound.gunshot();
  G.particles.push({
    x: p.x + Math.cos(angle) * 22, y: p.y + Math.sin(angle) * 22,
    vx: 0, vy: 0, life: 0.07, maxLife: 0.07, size: 10, color: '#ffd23f', kind: 'flash',
  });
  p.addHeat(0); // Shooting is a crime only when it hits something or is seen.
  G.stats.shotsFired = (G.stats.shotsFired || 0) + 1;
}

export function updateBullets(G, dt) {
  const p = G.player;
  for (const b of G.bullets) {
    const step = b.speed * dt;
    b.x += Math.cos(b.angle) * step;
    b.y += Math.sin(b.angle) * step;
    b.travelled += step;
    b.life -= dt;
    if (b.life <= 0 || b.travelled > b.range) {
      b.dead = true;
      continue;
    }
    if (hitsBuilding(b.x, b.y, 2, G.city)) {
      spawnSparks(G, b.x, b.y, 3);
      b.dead = true;
      continue;
    }
    if (b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) {
      b.dead = true;
      continue;
    }
    if (b.friendly) {
      // Hit a pedestrian?
      for (const ped of G.peds) {
        if (ped.dead) continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 14) {
          killPed(G, ped, true);
          b.dead = true;
          break;
        }
      }
      if (b.dead) continue;
      // Hit an officer?
      for (const cop of G.cops) {
        if (cop.dead) continue;
        if (dist(b.x, b.y, cop.x, cop.y) < 14) {
          damageCop(G, cop, b.damage);
          b.dead = true;
          break;
        }
      }
      if (b.dead) continue;
      // Hit a rival gunner?
      if (G.mission && G.mission.enemies) {
        for (const e of G.mission.enemies) {
          if (e.dead) continue;
          if (dist(b.x, b.y, e.x, e.y) < 14) {
            damageEnemy(G, e, b.damage);
            b.dead = true;
            break;
          }
        }
      }
      if (b.dead) continue;
      // Hit a car?
      for (const car of G.cars) {
        if (car.dead) continue;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
        if (Math.abs(along) < 34 && Math.abs(side) < 20) {
          damageCar(G, car, b.damage);
          spawnSparks(G, b.x, b.y, 4);
          if (car.kind === 'police') p.addHeat(1);
          b.dead = true;
          break;
        }
      }
    } else {
      // Enemy fire: only the player can be hit.
      if (p.onFoot && dist(b.x, b.y, p.x, p.y) < 13) {
        damagePlayer(G, b.damage, 'shot');
        b.dead = true;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
}

export function damageCop(G, cop, amount) {
  cop.health -= amount;
  if (cop.health <= 0) {
    cop.dead = true;
    G.stats.copsDown = (G.stats.copsDown || 0) + 1;
    G.player.addHeat(1);
    for (let i = 0; i < 8; i++) {
      G.particles.push({
        x: cop.x, y: cop.y,
        vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160,
        life: 0.4, maxLife: 0.4, size: 3, color: '#c0392b', kind: 'spark',
      });
    }
  }
}

/** Hurt the player; armour absorbs first. */
export function damagePlayer(G, amount, cause) {
  const p = G.player;
  if (p.invulnerable > 0 || G.mode !== 'playing') return;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  p.invulnerable = 0.35;
  G.camera.shake = Math.max(G.camera.shake, 4);
  if (p.health <= 0) {
    p.health = 0;
    G.events.push(cause === 'busted' ? 'busted' : 'wasted');
  }
}

/** Pickups: cash, health kits and armour, bobbing on the ground. */
export function spawnPickup(G, x, y, kind, amount) {
  G.pickups.push({ x, y, kind, amount, life: 60, bob: Math.random() * TAU });
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    pk.life -= dt;
    pk.bob += dt * 3;
    if (pk.life <= 0) {
      pk.dead = true;
      continue;
    }
    const d = dist(pk.x, pk.y, p.x, p.y);
    if (d < 30) {
      if (pk.kind === 'cash') {
        p.cash += pk.amount;
        G.stats.cashEarned = (G.stats.cashEarned || 0) + pk.amount;
        G.sound.blip(990, 0.12, 0.3);
        G.floaters.push({ x: pk.x, y: pk.y - 10, text: `+$${pk.amount}`, color: '#7dff9b', life: 1 });
      } else if (pk.kind === 'health') {
        p.health = Math.min(p.maxHealth, p.health + 50);
        G.sound.blip(660, 0.15, 0.3);
        G.floaters.push({ x: pk.x, y: pk.y - 10, text: '+50 HEALTH', color: '#3ddc74', life: 1 });
      } else if (pk.kind === 'armor') {
        p.armor = Math.min(100, p.armor + 50);
        G.sound.blip(520, 0.15, 0.3);
        G.floaters.push({ x: pk.x, y: pk.y - 10, text: '+50 ARMOUR', color: '#7fb8ff', life: 1 });
      }
      pk.dead = true;
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.dead);
}

export function updateParticles(G, dt) {
  for (const pt of G.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.kind === 'fire') {
      pt.vx *= 1 - 2.2 * dt;
      pt.vy *= 1 - 2.2 * dt;
      pt.size = Math.max(1, pt.size - dt * 14);
    } else if (pt.kind === 'smoke') {
      pt.vy -= 12 * dt;
      pt.size += dt * 10;
    } else if (pt.kind === 'spark') {
      pt.vx *= 1 - 3 * dt;
      pt.vy *= 1 - 3 * dt;
    }
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
  for (const f of G.floaters) {
    f.life -= dt;
    f.y -= 34 * dt;
  }
  G.floaters = G.floaters.filter((f) => f.life > 0);
}
