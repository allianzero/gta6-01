// The HUD and the screens: wanted stars, cash, health, the minimap, the mission
// objective, banners, the title screen, pause, busted, wasted and the ending.
// Everything here is screen space, drawn after the world.

import { FONT, FONT_DISPLAY, PALETTE, WORLD_W, WORLD_H, POLICE } from './config.js';
import { clamp, formatCash, formatTime } from './util.js';
import { objectiveText, objectiveMarker, missionName, missionCount } from './missions.js';
import { rr } from './render.js';

const MINIMAP_W = 210;
const MINIMAP_H = 224;

export function drawHUD(G, ctx) {
  const p = G.player;
  const vw = G.viewW;
  const vh = G.viewH;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // --- Top right: wanted stars, then cash.
  let y = 26;
  ctx.font = `28px ${FONT}`;
  ctx.textAlign = 'right';
  let stars = '';
  for (let i = 0; i < POLICE.maxStars; i++) stars += i < p.wanted ? '★' : '☆';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(stars, vw - 18, y + 2);
  ctx.fillStyle = p.wanted > 0 ? PALETTE.star : PALETTE.starEmpty;
  ctx.fillText(stars, vw - 20, y);
  y += 30;
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(formatCash(p.cash), vw - 18, y + 2);
  ctx.fillStyle = PALETTE.cash;
  ctx.fillText(formatCash(p.cash), vw - 20, y);

  // --- Top left: mission name and objective.
  const obj = objectiveText(G);
  const m = G.mission;
  ctx.textAlign = 'left';
  if (m && m.active) {
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(`MISSION ${m.index + 1}/${missionCount()}: ${missionName(m.index).toUpperCase()}`, 22, 28);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`MISSION ${m.index + 1}/${missionCount()}: ${missionName(m.index).toUpperCase()}`, 20, 26);
    if (obj) {
      ctx.font = `15px ${FONT}`;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillText(obj, 22, 50);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(obj, 20, 48);
    }
  }

  // --- Banner: mission passed / failed, centred.
  if (G.banner && G.time < G.banner.until) {
    const alpha = clamp((G.banner.until - G.time) / 0.6, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `bold 40px ${FONT_DISPLAY}`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(G.banner.title, vw / 2 + 2, 132);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(G.banner.title, vw / 2, 130);
    if (G.banner.sub) {
      ctx.font = `17px ${FONT}`;
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(G.banner.sub, vw / 2, 158);
    }
    ctx.globalAlpha = 1;
  }

  // --- Off-screen objective arrow, at the screen edge.
  const marker = objectiveMarker(G);
  if (marker && G.mode === 'playing') {
    drawObjectiveArrow(G, ctx, marker);
  }

  // --- Bottom left: health + armour bars over the minimap.
  const mapX = 20;
  const mapY = vh - MINIMAP_H - 20;
  const barW = MINIMAP_W;
  const barY = mapY - 34;
  ctx.textAlign = 'left';
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('HEALTH', mapX, barY - 5);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, mapX, barY, barW, 10, 5);
  ctx.fill();
  ctx.fillStyle = p.health < 30 ? PALETTE.healthLow : PALETTE.health;
  rr(ctx, mapX, barY, barW * clamp(p.health / p.maxHealth, 0, 1), 10, 5);
  ctx.fill();
  if (p.armor > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, mapX, barY + 14, barW, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#7fb8ff';
    rr(ctx, mapX, barY + 14, barW * clamp(p.armor / 100, 0, 1), 8, 4);
    ctx.fill();
  }
  // Speed, when driving.
  if (!p.onFoot && p.car) {
    ctx.textAlign = 'right';
    ctx.font = `bold 26px ${FONT_DISPLAY}`;
    const kmh = Math.round(Math.abs(p.car.speed) * 0.16);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(`${kmh}`, vw - 18, vh - 22);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${kmh}`, vw - 20, vh - 24);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('KM/H', vw - 20, vh - 4);
    ctx.textAlign = 'left';
  }

  drawMinimap(G, ctx, mapX, mapY);

  // --- Controls hint, bottom right.
  ctx.textAlign = 'right';
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = 'rgba(244,239,228,0.75)';
  const hint = p.onFoot
    ? 'WASD move · Shift run · Mouse aim · Click shoot · E enter car · M mute · Esc pause'
    : 'W/S drive · A/D steer · Space handbrake · E exit car · M mute · Esc pause';
  ctx.fillText(hint, vw - 20, vh - 66);
  ctx.restore();
}

function drawObjectiveArrow(G, ctx, marker) {
  const vw = G.viewW;
  const vh = G.viewH;
  const cam = G.camera;
  const sx = (marker.x - cam.x) * cam.zoom + vw / 2;
  const sy = (marker.y - cam.y) * cam.zoom + vh / 2;
  if (sx > 40 && sx < vw - 40 && sy > 40 && sy < vh - 40) return; // on screen already
  const cx = clamp(sx, 60, vw - 60);
  const cy = clamp(sy, 90, vh - 90);
  const a = Math.atan2(sy - cy, sx - cx);
  const d = Math.hypot(sx - cx, sy - cy);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(`${Math.round(d / cam.zoom / 50) * 5}m`, cx, cy + 26);
}

function drawMinimap(G, ctx, x, y) {
  const sx = MINIMAP_W / WORLD_W;
  const sy = MINIMAP_H / WORLD_H;
  ctx.save();
  ctx.fillStyle = PALETTE.hudPanel;
  rr(ctx, x - 6, y - 6, MINIMAP_W + 12, MINIMAP_H + 12, 8);
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudBorder;
  ctx.lineWidth = 1;
  rr(ctx, x - 6, y - 6, MINIMAP_W + 12, MINIMAP_H + 12, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x, y, MINIMAP_W, MINIMAP_H);
  ctx.clip();

  // Ocean and sand.
  ctx.fillStyle = '#256b8f';
  ctx.fillRect(x, y + 3960 * sy, MINIMAP_W, MINIMAP_H - 3960 * sy);
  ctx.fillStyle = '#e9cf9a';
  ctx.fillRect(x, y + 3840 * sy, MINIMAP_W, 120 * sy);
  // Blocks.
  ctx.fillStyle = '#6b6250';
  ctx.fillRect(x, y, MINIMAP_W, 3960 * sy);
  // Streets.
  ctx.fillStyle = '#3a3f4a';
  for (const c of G.city.centers) {
    ctx.fillRect(x + (c - 60) * sx, y, 120 * sx, 3960 * sy);
    ctx.fillRect(x, y + (c - 60) * sy, MINIMAP_W, 120 * sy);
  }
  // Parks.
  ctx.fillStyle = '#7fae5a';
  for (const park of G.city.parks) {
    ctx.fillRect(x + park.x * sx, y + park.y * sy, park.w * sx, park.h * sy);
  }
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Objective marker.
  const marker = objectiveMarker(G);
  if (marker) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    dot(marker.x, marker.y, '#ffd23f', pulse);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + marker.x * sx, y + marker.y * sy, pulse + 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Police.
  for (const car of G.cars) {
    if (car.kind === 'police' && !car.dead) dot(car.x, car.y, '#2d7dff', 2.5);
  }
  for (const cop of G.cops) {
    if (!cop.dead) dot(cop.x, cop.y, '#2d7dff', 2);
  }
  // The player, on top, with a white ring.
  const p = G.player;
  dot(p.x, p.y, '#fff', 4);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + p.x * sx, y + p.y * sy, 6, 0, Math.PI * 2);
  ctx.stroke();
  // North indicator.
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('N', x + MINIMAP_W / 2, y + 12);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function dimScreen(ctx, vw, vh, alpha) {
  ctx.fillStyle = `rgba(8, 10, 16, ${alpha})`;
  ctx.fillRect(0, 0, vw, vh);
}

function screenTitle(ctx, text, y, size, color, vw) {
  ctx.font = `bold ${size}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(text, vw / 2 + 3, y + 3);
  ctx.fillStyle = color;
  ctx.fillText(text, vw / 2, y);
}

export function drawTitle(G, ctx) {
  const vw = G.viewW;
  const vh = G.viewH;
  // The city keeps living behind the title.
  dimScreen(ctx, vw, vh, 0.45);
  screenTitle(ctx, 'PALMIRA BAY', 150, 72, '#ffd23f', vw);
  ctx.font = `bold 24px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('An open-world crime story in the spirit of GTA', vw / 2, 196);
  ctx.font = `16px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  const story = [
    'Palmira Bay, 2026. Marco "Rook" Santana is back in town',
    'with nothing but a burner phone and a debt.',
    'Six jobs stand between him and the crown.',
  ];
  story.forEach((line, i) => ctx.fillText(line, vw / 2, 232 + i * 24));

  const blink = Math.floor(G.titleTime * 1.6) % 2 === 0;
  if (blink) {
    ctx.font = `bold 26px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#fff';
    ctx.fillText('PRESS ENTER TO START', vw / 2, 350);
  }
  if (G.save && G.save.missionsDone > 0) {
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.cash;
    ctx.fillText(`[C] CONTINUE — ${G.save.missionsDone} of 6 jobs done, ${formatCash(G.save.cash)} in the bank`, vw / 2, 386);
  }
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = PALETTE.text;
  const controls = [
    'WASD / Arrows — move & drive      Shift — run      Mouse — aim      Click — shoot',
    'E — steal / enter / exit car      Space — handbrake      M — mute      Esc — pause',
    'Steal cars, lose the cops, run the six jobs. Your progress saves in this browser.',
  ];
  controls.forEach((line, i) => ctx.fillText(line, vw / 2, vh - 92 + i * 24));
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('An original game: its city, characters, vehicles, names and story are all its own.', vw / 2, vh - 20);
}

export function drawPaused(G, ctx) {
  const vw = G.viewW;
  const vh = G.viewH;
  dimScreen(ctx, vw, vh, 0.6);
  screenTitle(ctx, 'PAUSED', vh / 2 - 30, 54, PALETTE.text, vw);
  ctx.font = `17px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('Esc — resume      R — restart the current job      Q — quit to title', vw / 2, vh / 2 + 14);
  ctx.fillText(`${missionName(G.mission ? G.mission.index : 0)} — ${formatCash(G.player.cash)} — ${G.stats.missionsDone || 0} jobs done`, vw / 2, vh / 2 + 44);
}

export function drawWasted(G, ctx) {
  const vw = G.viewW;
  const vh = G.viewH;
  dimScreen(ctx, vw, vh, 0.55);
  screenTitle(ctx, 'WASTED', vh / 2 - 40, 84, '#ff4747', vw);
  ctx.font = `18px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('Rook went down in Palmira Bay. The city keeps moving without him.', vw / 2, vh / 2 + 10);
  ctx.font = `bold 22px ${FONT_DISPLAY}`;
  ctx.fillStyle = '#fff';
  if (Math.floor(G.time * 1.6) % 2 === 0) ctx.fillText('PRESS ENTER TO TRY AGAIN', vw / 2, vh / 2 + 60);
}

export function drawBusted(G, ctx) {
  const vw = G.viewW;
  const vh = G.viewH;
  dimScreen(ctx, vw, vh, 0.55);
  screenTitle(ctx, 'BUSTED', vh / 2 - 40, 84, '#2d7dff', vw);
  ctx.font = `18px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('The Palmira Bay PD took Rook in. They kept 20% of his cash as "evidence".', vw / 2, vh / 2 + 10);
  ctx.font = `bold 22px ${FONT_DISPLAY}`;
  ctx.fillStyle = '#fff';
  if (Math.floor(G.time * 1.6) % 2 === 0) ctx.fillText('PRESS ENTER TO GET OUT', vw / 2, vh / 2 + 60);
}

export function drawComplete(G, ctx) {
  const vw = G.viewW;
  const vh = G.viewH;
  dimScreen(ctx, vw, vh, 0.5);
  screenTitle(ctx, 'KING OF PALMIRA', vh / 2 - 60, 56, '#ffd23f', vw);
  ctx.font = `19px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('All six jobs done. The crown is yours, Rook — Palmira Bay is your city now.', vw / 2, vh / 2);
  ctx.fillStyle = PALETTE.cash;
  ctx.fillText(`${formatCash(G.player.cash)} in the bank · ${G.stats.carsStolen || 0} cars stolen · best heat ${G.save.bestWanted || 0}★`, vw / 2, vh / 2 + 32);
  ctx.font = `bold 22px ${FONT_DISPLAY}`;
  ctx.fillStyle = '#fff';
  if (Math.floor(G.time * 1.6) % 2 === 0) ctx.fillText('ENTER — KEEP ROAMING THE CITY', vw / 2, vh / 2 + 80);
}
