// Palmira Bay — the HUD: cash, health, wanted stars, clock, mission card,
// toasts, banners and the live minimap.
import { fmtMoney, fmtClock, fmtTime, clamp } from './util.js';
import { WORLD_W, WORLD_H } from './config.js';
import { currentMission } from './missions.js';

export function drawHud(G, ctx, vw, vh) {
  const p = G.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // top-left: cash + respect + level
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  roundRect(ctx, 12, 12, 218, 74, 10); ctx.fill();
  ctx.fillStyle = '#7ae84f';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(fmtMoney(p.cash), 24, 42);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('LVL ' + p.level + '  •  RESPECT ' + p.respect + '  •  ' + fmtClock(G.dayT), 24, 64);
  ctx.fillStyle = '#ffd94f';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('★'.repeat(0) + '', 24, 78);
  // wanted stars top-center
  const stars = p.wanted;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffcf3d' : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 4;
    ctx.strokeText('★', vw / 2 - 70 + i * 35, 44);
    ctx.fillText('★', vw / 2 - 70 + i * 35, 44);
  }
  ctx.textAlign = 'left';
  // health bar bottom-left
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  roundRect(ctx, 12, vh - 58, 240, 46, 10); ctx.fill();
  ctx.fillStyle = '#333';
  roundRect(ctx, 24, vh - 44, 180, 12, 6); ctx.fill();
  ctx.fillStyle = p.hp > 40 ? '#7ae84f' : '#ff5a4e';
  roundRect(ctx, 24, vh - 44, 180 * clamp(p.hp / p.maxHp, 0, 1), 12, 6); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.hp) + ' / ' + p.maxHp, 24, vh - 20);
  ctx.fillText(p.weapon.toUpperCase() + (p.ammo[p.weapon] ? '  •  ' + p.ammo[p.weapon] + ' RDS' : ''), 130, vh - 20);
  // speed bottom-right (when driving)
  if (p.inCar) {
    ctx.fillStyle = 'rgba(8,12,20,0.62)';
    roundRect(ctx, vw - 152, vh - 58, 140, 46, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h', vw - 24, vh - 24);
    ctx.textAlign = 'left';
  }
  // mission card top-right, under minimap
  drawMinimap(G, ctx, vw - 172, 12, 160, 124);
  const def = currentMission(G.missions);
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  roundRect(ctx, vw - 172, 144, 160, 86, 10); ctx.fill();
  ctx.fillStyle = '#ffd94f';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(G.missions.active ? 'MISSION: ' + G.missions.active.title : 'FREE ROAM', vw - 160, 166);
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui, sans-serif';
  wrapText(ctx, G.missions.active ? G.missions.stepText : (def ? def.title + ' — press M to start' : 'All missions done!'), vw - 160, 184, 136, 15);
  if (G.missions.active && G.missions.timer > 0) {
    ctx.fillStyle = G.missions.timer < 15 ? '#ff5a4e' : '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(fmtTime(G.missions.timer), vw - 160, 222);
  }
  // toasts
  let ty = vh - 120;
  for (let i = G.toasts.length - 1; i >= 0; i--) {
    const t = G.toasts[i];
    ctx.globalAlpha = clamp(t.t / 0.5, 0, 1);
    ctx.fillStyle = 'rgba(8,12,20,0.75)';
    const w = ctx.measureText(t.text).width + 24;
    roundRect(ctx, 12, ty - 18, w, 26, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(t.text, 24, ty);
    ctx.globalAlpha = 1;
    ty -= 32;
  }
  // banner
  if (G.banner) {
    ctx.globalAlpha = clamp(G.banner.t, 0, 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,12,20,0.7)';
    roundRect(ctx, vw / 2 - 260, vh * 0.3, 520, 84, 12); ctx.fill();
    ctx.fillStyle = '#ffd94f';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(G.banner.title, vw / 2, vh * 0.3 + 38);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(G.banner.sub, vw / 2, vh * 0.3 + 66);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}
export function drawMinimap(G, ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 10); ctx.clip();
  const sx = w / WORLD_W, sy = h / WORLD_H;
  ctx.fillStyle = '#1d3a4a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2e5a3a';
  ctx.fillRect(x + 2400 * sx, y + 900 * sy, 1200 * sx, 1000 * sy);
  ctx.strokeStyle = '#5a6a7a';
  ctx.lineWidth = 2;
  for (let gx = 0; gx <= WORLD_W; gx += 416) {
    ctx.beginPath(); ctx.moveTo(x + gx * sx, y); ctx.lineTo(x + gx * sx, y + h); ctx.stroke();
  }
  for (let gy = 0; gy <= WORLD_H; gy += 416) {
    ctx.beginPath(); ctx.moveTo(x, y + gy * sy); ctx.lineTo(x + w, y + gy * sy); ctx.stroke();
  }
  const px = G.player.inCar ? G.player.inCar.x : G.player.x;
  const py = G.player.inCar ? G.player.inCar.y : G.player.y;
  const marker = G.missionMarker ? G.missionMarker() : null;
  if (marker) {
    ctx.fillStyle = '#ffd94f';
    ctx.beginPath();
    ctx.arc(x + marker.x * sx, y + marker.y * sy, 5, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#ffd94f';
    ctx.beginPath();
    ctx.arc(x + marker.x * sx, y + marker.y * sy, 8 + Math.sin(G.time * 5) * 2, 0, 6.29); ctx.stroke();
  }
  for (const c of G.cars) {
    if (c.isCop) {
      ctx.fillStyle = '#4f9fff';
      ctx.fillRect(x + c.x * sx - 2, y + c.y * sy - 2, 4, 4);
    }
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + px * sx, y + py * sy, 4, 0, 6.29); ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.arc(x + px * sx, y + py * sy, 4, 0, 6.29); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText('PALMIRA BAY', x + 6, y + h - 6);
  ctx.restore();
}
