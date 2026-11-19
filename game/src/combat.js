// Palmira Bay — combat: fists, pistols and SMGs, bullets, muzzle flashes,
// gang enforcers who shoot back, and pickups.
import { WEAPONS } from './config.js';
import { dist, angleTo, clamp } from './util.js';
import { makeRng, rngRange } from './rng.js';
import { addXp } from './entities.js';

export function weaponOf(player) {
  return WEAPONS.find((w) => w.id === player.weapon) || WEAPONS[0];
}
export function switchWeapon(G, dir) {
  const p = G.player;
  const i = p.weapons.indexOf(p.weapon);
  const n = p.weapons[(i + dir + p.weapons.length) % p.weapons.length];
  p.weapon = n;
  G.playSfx('click');
}
export function playerShoot(G) {
  const p = G.player;
  const w = weaponOf(p);
  if (p.shootCd > 0) return;
  if (w.ammo > 0 && (p.ammo[w.id] || 0) <= 0) {
    G.toast('No ammo for the ' + w.name + ' — visit Ammo & Sons.');
    p.shootCd = 0.4;
    return;
  }
  p.shootCd = w.rate;
  if (w.ammo > 0) p.ammo[w.id]--;
  const a = p.angle;
  const spread = w.id === 'smg' ? 0.09 : 0.03;
  const ang = a + (Math.random() - 0.5) * spread * 2;
  G.bullets.push({
    x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
    vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620,
    dmg: w.damage, range: w.range, travelled: 0, fromPlayer: true,
  });
  G.muzzle = 0.06;
  G.playSfx('shot');
  G.addWanted(0, '');
  if (p.wanted < 1) { p.wanted = 1; G.toast('Shots fired! Someone called the PBPD.'); }
  G.recentCrimeT = 3;
  G.shotsFiredRecently = 1.5;
}
export function playerPunch(G) {
  const p = G.player;
  if (p.punchCd > 0) return;
  p.punchCd = 0.35;
  G.playSfx('punch');
  G.punchAnim = 0.2;
  const fx = p.x + Math.cos(p.angle) * 30;
  const fy = p.y + Math.sin(p.angle) * 30;
  for (const e of G.enemies) {
    if (!e.dead && dist(e.x, e.y, fx, fy) < 40) damageEnemy(G, e, 12, true);
  }
  for (const ped of G.peds) {
    if (!ped.dead && dist(ped.x, ped.y, fx, fy) < 36) {
      ped.hp -= 20; ped.panic = 3;
      if (ped.hp <= 0) { ped.dead = true; G.addWanted(1, 'Assault'); }
    }
  }
}
export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += Math.hypot(b.vx, b.vy) * dt;
    if (b.travelled > b.range) { b.dead = true; continue; }
    const hitB = G.city.buildings.find((bb) => b.x > bb.x && b.x < bb.x + bb.w && b.y > bb.y && b.y < bb.y + bb.h);
    if (hitB) { b.dead = true; G.sparks.push({ x: b.x, y: b.y, t: 0 }); continue; }
    if (b.fromPlayer) {
      for (const e of G.enemies) {
        if (!e.dead && dist(e.x, e.y, b.x, b.y) < 15) { damageEnemy(G, e, b.dmg, true); b.dead = true; break; }
      }
      if (b.dead) continue;
      for (const ped of G.peds) {
        if (!ped.dead && dist(ped.x, ped.y, b.x, b.y) < 12) {
          ped.hp -= b.dmg; ped.panic = 3;
          if (ped.hp <= 0) { ped.dead = true; G.addWanted(1, 'Civilian shot'); }
          b.dead = true; break;
        }
      }
    } else {
      const p = G.player;
      if (!p.dead && !p.inCar && dist(p.x, p.y, b.x, b.y) < 14) {
        b.dead = true;
        p.hp -= b.dmg;
        p.hurtCd = 0.4;
        G.floaters.push({ x: p.x, y: p.y - 20, text: '-' + b.dmg, color: '#ff5a4e', t: 0 });
        if (p.hp <= 0) { p.hp = 0; p.dead = true; G.state = 'wasted'; G.stateTimer = 0; }
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
}
export function damageEnemy(G, e, dmg, byPlayer) {
  e.hp -= dmg;
  G.floaters.push({ x: e.x, y: e.y - 18, text: '-' + dmg, color: '#ffd94f', t: 0 });
  G.sparks.push({ x: e.x, y: e.y, t: 0 });
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    if (byPlayer) {
      G.player.kills++;
      const gain = 25 + Math.floor(Math.random() * 30);
      G.player.cash += gain;
      addXp(G.player, 40);
      G.floaters.push({ x: e.x, y: e.y - 30, text: '+' + gain + '$', color: '#7ae84f', t: 0 });
      G.playSfx('cash');
    }
  }
}
export function spawnEnemy(G, x, y, kind) {
  const rng = makeRng(G.seed + G.enemiesSpawned * 53);
  const e = {
    x, y, angle: rng() * 6.28, hp: kind === 'boss' ? 160 : 70,
    kind: kind || 'thug', speed: rngRange(rng, 70, 100),
    shootCd: rngRange(rng, 0.5, 1.5), dead: false, state: 'guard',
    targetX: x, targetY: y,
  };
  G.enemies.push(e);
  G.enemiesSpawned++;
  return e;
}
export function updateEnemy(G, e, dt) {
  if (e.dead) return;
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const d = dist(e.x, e.y, px, py);
  e.shootCd -= dt;
  if (d < 380 && !p.dead) {
    e.state = 'attack';
    e.angle = angleTo(e.x, e.y, px, py);
    if (d > 160) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    }
    if (e.shootCd <= 0 && d < 340) {
      e.shootCd = e.kind === 'boss' ? 0.7 : 1.3;
      const a = e.angle + (Math.random() - 0.5) * 0.14;
      G.bullets.push({ x: e.x + Math.cos(a) * 18, y: e.y + Math.sin(a) * 18, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, dmg: 9, range: 340, travelled: 0, fromPlayer: false });
      G.playSfx('shot');
    }
  } else {
    e.state = 'guard';
    e.angle += dt * 0.4;
  }
}
export function giveWeapon(G, id, ammo) {
  const p = G.player;
  if (!p.weapons.includes(id)) p.weapons.push(id);
  p.ammo[id] = (p.ammo[id] || 0) + ammo;
  p.weapon = id;
  G.toast('Picked up: ' + WEAPONS.find((w) => w.id === id).name + ' (' + ammo + ' rounds)');
}
