// Palmira Bay — rendering: the sun-soaked city, camera, cars, people,
// effects and the menu screens. All art is drawn in code, no image files.
import { WORLD_W, WORLD_H, ROAD, BLOCK, STEP, DAY_LENGTH } from './config.js';
import { districtAt } from './world.js';
import { shade } from './util.js';
import { roundRect } from './hud.js';

export function createCamera() {
  return { x: 0, y: 0, zoom: 1, shake: 0, shakeX: 0, shakeY: 0 };
}
export function updateCamera(G, dt) {
  const cam = G.camera;
  const p = G.player;
  const tx = (p.inCar ? p.inCar.x : p.x) - G.vw / 2;
  const ty = (p.inCar ? p.inCar.y : p.y) - G.vh / 2;
  cam.x += (tx - cam.x) * Math.min(1, dt * 5);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  cam.shake = Math.max(0, cam.shake - dt * 22);
  cam.shakeX = (Math.random() - 0.5) * cam.shake;
  cam.shakeY = (Math.random() - 0.5) * cam.shake;
}
export function skyTint(dayT) {
  const sun = Math.sin(dayT * Math.PI * 2);
  if (sun > 0.25) return { ground: '#3f7a4a', road: '#3a3f46', amb: 0 };
  if (sun > -0.1) return { ground: '#6a6a3d', road: '#3f3a3a', amb: 0.12 };
  return { ground: '#22303a', road: '#23262c', amb: 0.3 };
}
export function drawWorld(G, ctx) {
  const cam = G.camera;
  const vw = G.vw, vh = G.vh;
  const tint = skyTint(G.dayT);
  ctx.fillStyle = tint.ground;
  ctx.fillRect(0, 0, vw, vh);
  const ox = -cam.x + cam.shakeX, oy = -cam.y + cam.shakeY;
  ctx.save();
  ctx.translate(ox, oy);
  const vx0 = cam.x - 80, vy0 = cam.y - 80, vx1 = cam.x + vw + 80, vy1 = cam.y + vh + 80;
  // ground blocks
  for (let bx = 0; bx < WORLD_W / STEP; bx++) {
    for (let by = 0; by < WORLD_H / STEP; by++) {
      const x = bx * STEP + ROAD, y = by * STEP + ROAD;
      if (x > vx1 || y > vy1 || x + BLOCK < vx0 || y + BLOCK < vy0) continue;
      const d = districtAt(x + BLOCK / 2, y + BLOCK / 2);
      ctx.fillStyle = shade(d.tint, 0.42);
      ctx.fillRect(x, y, BLOCK, BLOCK);
    }
  }
  // parks and sand
  for (const pk of G.city.parks) {
    if (pk.x > vx1 || pk.y > vy1 || pk.x + pk.w < vx0 || pk.y + pk.h < vy0) continue;
    ctx.fillStyle = pk.kind === 'sand' ? '#e8d49a' : pk.kind === 'park' ? '#2e6b34' : '#7a7a82';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    if (pk.kind === 'sand') {
      ctx.fillStyle = '#4f9fc2';
      ctx.fillRect(pk.x + pk.w - 60, pk.y, 60, pk.h);
    }
  }
  // roads
  ctx.fillStyle = tint.road;
  for (let x = 0; x <= WORLD_W; x += STEP) ctx.fillRect(x, 0, ROAD, WORLD_H);
  for (let y = 0; y <= WORLD_H; y += STEP) ctx.fillRect(0, y, WORLD_W, ROAD);
  // lane dashes
  ctx.fillStyle = 'rgba(255,220,90,0.75)';
  for (let x = 0; x <= WORLD_W; x += STEP) {
    for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(x + ROAD / 2 - 2, y, 4, 30);
  }
  for (let y = 0; y <= WORLD_H; y += STEP) {
    for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, y + ROAD / 2 - 2, 30, 4);
  }
  // parking lots
  for (const lot of G.city.lots) {
    ctx.fillStyle = '#2c2f36';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) ctx.strokeRect(lot.x + 20 + i * 60, lot.y + 20, 44, 90);
  }
  drawLandmarks(G, ctx, vx0, vy0, vx1, vy1);
  drawBuildings(G, ctx, vx0, vy0, vx1, vy1);
  drawPalms(G, ctx, vx0, vy0, vx1, vy1);
  drawMissionMarker(G, ctx);
  drawPickups(G, ctx);
  drawCars(G, ctx, vx0, vy0, vx1, vy1);
  drawPeds(G, ctx, vx0, vy0, vx1, vy1);
  drawEnemies(G, ctx, vx0, vy0, vx1, vy1);
  drawPlayer(G, ctx);
  drawBullets(G, ctx);
  drawSparks(G, ctx);
  drawFloaters(G, ctx);
  ctx.restore();
  if (tint.amb > 0) {
    ctx.fillStyle = `rgba(10,14,40,${tint.amb})`;
    ctx.fillRect(0, 0, vw, vh);
  }
}
function drawLandmarks(G, ctx, vx0, vy0, vx1, vy1) {
  for (const l of G.landmarks) {
    if (l.x < vx0 - 100 || l.x > vx1 + 100 || l.y < vy0 - 100 || l.y > vy1 + 100) continue;
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 26, 70, 18, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#e8e0c8';
    ctx.fillRect(-56, -40, 112, 66);
    ctx.fillStyle = '#c94f42';
    ctx.fillRect(-56, -40, 112, 12);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(l.name.toUpperCase(), 0, -48);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}
function drawBuildings(G, ctx, vx0, vy0, vx1, vy1) {
  for (const b of G.city.buildings) {
    if (b.x > vx1 || b.y > vy1 || b.x + b.w < vx0 || b.y + b.h < vy0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    const floors = Math.min(b.floors, 6);
    ctx.fillStyle = 'rgba(255,240,180,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + b.id) % 4 === 0) continue;
        ctx.fillRect(b.x + 8 + i * ((b.w - 16) / cols), b.y + 8 + j * ((b.h - 16) / rows), 10, 12);
      }
    }
    if (b.floors >= 8) {
      ctx.fillStyle = '#222';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText(b.floors + 'F', b.x + 6, b.y + 14);
    }
  }
}
function drawPalms(G, ctx, vx0, vy0, vx1, vy1) {
  for (const pl of G.city.palms) {
    if (pl.x < vx0 || pl.x > vx1 || pl.y < vy0 || pl.y > vy1) continue;
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pl.x, pl.y); ctx.lineTo(pl.x + 3, pl.y - 16); ctx.stroke();
    ctx.fillStyle = '#2e8e4a';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 6.28 + 0.4;
      ctx.beginPath();
      ctx.ellipse(pl.x + 3 + Math.cos(a) * 10, pl.y - 16 + Math.sin(a) * 6, 11, 4, a, 0, 6.29);
      ctx.fill();
    }
  }
}
// Palmira Bay — rendering, part 2: markers, cars, people, effects.

export function drawMissionMarker(G, ctx) {
  const m = G.missionMarker ? G.missionMarker() : null;
  if (!m) return;
  const pulse = 1 + Math.sin(G.time * 4) * 0.12;
  ctx.save();
  ctx.strokeStyle = '#ffd94f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r * pulse, 0, 6.29);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,217,79,0.12)';
  ctx.fill();
  ctx.fillStyle = '#ffd94f';
  ctx.beginPath();
  ctx.arc(m.x, m.y, 8, 0, 6.29);
  ctx.fill();
  ctx.restore();
}
export function drawPickups(G, ctx) {
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(G.time * 3 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = pk.kind === 'cash' ? '#7ae84f' : pk.kind === 'health' ? '#ff5a6a' : '#ffd94f';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#08200a';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'W', 0, 4);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}
export function drawCars(G, ctx, vx0, vy0, vx1, vy1) {
  for (const c of G.cars) {
    if (c.dead || c.x < vx0 - 80 || c.x > vx1 + 80 || c.y < vy0 - 80 || c.y > vy1 + 80) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 4, c.w, c.h);
    ctx.fillStyle = c.color;
    roundRectPath(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.9)';
    ctx.fillRect(-c.w / 2 + 10, -c.h / 2 + 4, 12, c.h - 8);
    ctx.fillRect(c.w / 2 - 18, -c.h / 2 + 4, 10, c.h - 8);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-c.w / 2 + 2, -c.h / 2 - 2, 8, 5);
    ctx.fillRect(-c.w / 2 + 2, c.h / 2 - 3, 8, 5);
    ctx.fillRect(c.w / 2 - 10, -c.h / 2 - 2, 8, 5);
    ctx.fillRect(c.w / 2 - 10, c.h / 2 - 3, 8, 5);
    if (c.isCop) {
      const flash = Math.floor(G.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
      ctx.fillRect(-4, -c.h / 2 - 3, 8, 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PBPD', 0, 3);
      ctx.textAlign = 'left';
    }
    if (c.hp < 100) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-c.w / 2, -c.h / 2 - 8, c.w, 4);
      ctx.fillStyle = '#ff5a4e';
      ctx.fillRect(-c.w / 2, -c.h / 2 - 8, c.w * (c.hp / 100), 4);
    }
    ctx.restore();
  }
}
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function drawPeds(G, ctx, vx0, vy0, vx1, vy1) {
  for (const ped of G.peds) {
    if (ped.dead || ped.x < vx0 || ped.x > vx1 || ped.y < vy0 || ped.y > vy1) continue;
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.save();
    ctx.translate(ped.x, ped.y + bob * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 9, 4, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4 - 2, 5, 0, 6.29); ctx.fill();
    if (ped.panic > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -16);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
}
export function drawEnemies(G, ctx, vx0, vy0, vx1, vy1) {
  for (const e of G.enemies) {
    if (e.dead || e.x < vx0 || e.x > vx1 || e.y < vy0 || e.y > vy1) continue;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 9, 10, 4, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = e.kind === 'boss' ? '#c22a2a' : '#7a1f1f';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffd94f';
    ctx.beginPath(); ctx.arc(Math.cos(e.angle) * 5, Math.sin(e.angle) * 5 - 2, 5, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(-12, -22, 24, 4);
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(-12, -22, 24 * (e.hp / (e.kind === 'boss' ? 160 : 70)), 4);
    ctx.restore();
  }
}
export function drawPlayer(G, ctx) {
  const p = G.player;
  if (p.dead || p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  const walking = p.speed > 20;
  const bob = walking ? Math.sin(G.time * 12) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 10, 11, 5, 0, 0, 6.29); ctx.fill();
  ctx.rotate(p.angle);
  ctx.fillStyle = '#2e6b34';
  ctx.fillRect(-8, -9, 16, 18);
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(12, 0, 6, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(13, -2, 5, 0, 6.29); ctx.fill();
  if (G.punchAnim > 0) {
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(20, -4, 5, 0, 6.29); ctx.fill();
  }
  if (p.weapon !== 'fists') {
    ctx.fillStyle = '#222';
    ctx.fillRect(10, 4, 16, 4);
  }
  ctx.restore();
  if (G.muzzle > 0) {
    ctx.save();
    ctx.translate(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26);
    ctx.fillStyle = '#ffe14f';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.29); ctx.fill();
    ctx.restore();
  }
}
export function drawBullets(G, ctx) {
  ctx.save();
  ctx.strokeStyle = '#ffe14f';
  ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}
export function drawSparks(G, ctx) {
  for (const s of G.sparks) {
    ctx.save();
    ctx.globalAlpha = 1 - s.t * 3;
    ctx.fillStyle = '#ffd94f';
    ctx.beginPath(); ctx.arc(s.x, s.y, 6 - s.t * 10, 0, 6.29); ctx.fill();
    ctx.restore();
  }
}
export function drawFloaters(G, ctx) {
  ctx.save();
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = 1 - f.t;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - f.t * 30);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}
