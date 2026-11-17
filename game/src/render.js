// Drawing: the whole of Palmira Bay on one canvas — streets, buildings with
// long sun shadows, palms, the beach and ocean, cars, people, particles —
// then the warm late-afternoon light over everything.

import { WORLD, WORLD_W, WORLD_H, PALETTE } from './config.js';
import { clamp, TAU } from './util.js';
import { shade } from './city.js';
import { objectiveMarker } from './missions.js';

/** Rounded-rect path (ctx.roundRect is new; this works everywhere). */
export function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function drawWorld(G, ctx) {
  const cam = G.camera;
  const vw = G.viewW;
  const vh = G.viewH;
  ctx.save();
  // Camera: centre on the player, shake on top, zoom around the screen centre.
  const shX = (Math.random() - 0.5) * cam.shake;
  const shY = (Math.random() - 0.5) * cam.shake;
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + shX, -cam.y + shY);

  const view = {
    x0: cam.x - vw / 2 / cam.zoom - 80,
    y0: cam.y - vh / 2 / cam.zoom - 80,
    x1: cam.x + vw / 2 / cam.zoom + 80,
    y1: cam.y + vh / 2 / cam.zoom + 80,
  };

  drawGround(G, ctx, view);
  drawBuildings(G, ctx, view);
  drawProps(G, ctx, view);
  drawPickups(G, ctx, view);
  drawMissionMarker(G, ctx);
  drawPeds(G, ctx, view);
  drawCars(G, ctx, view);
  drawPlayer(G, ctx);
  drawBullets(G, ctx);
  drawParticles(G, ctx);
  drawFloaters(G, ctx);
  ctx.restore();

  // Warm late-afternoon light: a soft sun glare and a vignette.
  const glare = ctx.createRadialGradient(vw * 0.82, vh * 0.08, 40, vw * 0.82, vh * 0.08, vw * 0.75);
  glare.addColorStop(0, 'rgba(255, 214, 130, 0.16)');
  glare.addColorStop(1, 'rgba(255, 214, 130, 0)');
  ctx.fillStyle = glare;
  ctx.fillRect(0, 0, vw, vh);
  const vig = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(20,10,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, vw, vh);
}

function drawGround(G, ctx, view) {
  const city = G.city;
  // Base: the block colour (dry grass / dirt) under everything.
  ctx.fillStyle = '#a89a7c';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

  // Beach and ocean, south of the city.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(view.x0, WORLD.beachY, view.x1 - view.x0, WORLD.oceanY - WORLD.beachY);
  ctx.fillStyle = PALETTE.ocean;
  ctx.fillRect(view.x0, WORLD.oceanY, view.x1 - view.x0, view.y1 - WORLD.oceanY);
  // Animated wave lines on the water.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  const t = G.time;
  for (let y = WORLD.oceanY + 30; y < Math.min(view.y1, WORLD_H); y += 46) {
    ctx.beginPath();
    for (let x = Math.max(view.x0, 0); x < Math.min(view.x1, WORLD_W); x += 60) {
      const yy = y + Math.sin(x / 130 + t * 1.2 + y / 90) * 6;
      if (x === Math.max(view.x0, 0)) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Sand speckle.
  ctx.fillStyle = 'rgba(180,150,100,0.5)';
  for (let i = 0; i < 40; i++) {
    const x = ((i * 977) % WORLD_W);
    const y = WORLD.beachY + ((i * 613) % (WORLD.oceanY - WORLD.beachY - 20)) + 10;
    if (x < view.x0 || x > view.x1) continue;
    ctx.fillRect(x, y, 5, 3);
  }

  // Parks.
  for (const park of city.parks) {
    if (park.x > view.x1 || park.x + park.w < view.x0 || park.y > view.y1 || park.y + park.h < view.y0) continue;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = PALETTE.grassDark;
    ctx.fillRect(park.x, park.y, park.w, 10);
  }
  // Parking lots.
  for (const b of city.blocks) {
    if (b.kind !== 'lot') continue;
    if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
    ctx.fillStyle = PALETTE.asphaltDark;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let x = b.x + 30; x < b.x + b.w - 20; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, b.y + 24);
      ctx.lineTo(x, b.y + 64);
      ctx.stroke();
    }
  }

  // Streets: sidewalk band, then asphalt, then the centre dashes.
  const half = WORLD.road / 2;
  const sw = WORLD.sidewalk;
  for (const c of city.centers) {
    // Vertical street.
    if (c > view.x0 - WORLD.road && c < view.x1 + WORLD.road) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(c - half - sw, Math.max(view.y0, 0), WORLD.road + sw * 2, Math.min(view.y1, WORLD.beachY) - Math.max(view.y0, 0));
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(c - half, Math.max(view.y0, 0), WORLD.road, Math.min(view.y1, WORLD.beachY) - Math.max(view.y0, 0));
      ctx.strokeStyle = PALETTE.roadLine;
      ctx.lineWidth = 4;
      ctx.setLineDash([34, 30]);
      ctx.beginPath();
      ctx.moveTo(c, Math.max(view.y0, 0));
      ctx.lineTo(c, Math.min(view.y1, WORLD.beachY));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Horizontal street.
    if (c > view.y0 - WORLD.road && c < view.y1 + WORLD.road) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(Math.max(view.x0, 0), c - half - sw, Math.min(view.x1, WORLD_W) - Math.max(view.x0, 0), WORLD.road + sw * 2);
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(Math.max(view.x0, 0), c - half, Math.min(view.x1, WORLD_W) - Math.max(view.x0, 0), WORLD.road);
      ctx.strokeStyle = PALETTE.roadLine;
      ctx.lineWidth = 4;
      ctx.setLineDash([34, 30]);
      ctx.beginPath();
      ctx.moveTo(Math.max(view.x0, 0), c);
      ctx.lineTo(Math.min(view.x1, WORLD_W), c);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // Kerb edges.
  ctx.fillStyle = PALETTE.sidewalkEdge;
  for (const c of city.centers) {
    if (c > view.x0 - WORLD.road && c < view.x1 + WORLD.road) {
      ctx.fillRect(c - half - 3, Math.max(view.y0, 0), 3, Math.min(view.y1, WORLD.beachY) - Math.max(view.y0, 0));
      ctx.fillRect(c + half, Math.max(view.y0, 0), 3, Math.min(view.y1, WORLD.beachY) - Math.max(view.y0, 0));
    }
    if (c > view.y0 - WORLD.road && c < view.y1 + WORLD.road) {
      ctx.fillRect(Math.max(view.x0, 0), c - half - 3, Math.min(view.x1, WORLD_W) - Math.max(view.x0, 0), 3);
      ctx.fillRect(Math.max(view.x0, 0), c + half, Math.min(view.x1, WORLD_W) - Math.max(view.x0, 0), 3);
    }
  }
}

function drawBuildings(G, ctx, view) {
  for (const b of G.city.buildings) {
    if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
    const h = b.storeys * 7;
    // Long sun shadow to the south-east.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    rr(ctx, b.x + h, b.y + h, b.w, b.h, 6);
    ctx.fill();
    // Wall face (the south edge) then the roof.
    ctx.fillStyle = shade(b.color, -34);
    ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6 + h);
    ctx.fillStyle = b.color;
    rr(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.fill();
    // Roof: a darker inset, AC boxes, sometimes a pool.
    ctx.fillStyle = b.roof;
    rr(ctx, b.x + 8, b.y + 8, b.w - 16, b.h - 16, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (const ac of b.ac) {
      ctx.fillRect(b.x + ac.x, b.y + ac.y, ac.s, ac.s);
    }
    if (b.pool) {
      ctx.fillStyle = '#4fc3f7';
      rr(ctx, b.x + b.w / 2 - 26, b.y + b.h / 2 - 14, 52, 28, 12);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(b.x + b.w / 2 - 18, b.y + b.h / 2 - 8, 36, 3);
    }
  }
}

function drawProps(G, ctx, view) {
  for (const palm of G.city.palms) {
    if (palm.x < view.x0 || palm.x > view.x1 || palm.y < view.y0 || palm.y > view.y1) continue;
    const s = palm.s;
    ctx.strokeStyle = '#7a5c38';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 4 * s, palm.y - 26 * s);
    ctx.stroke();
    ctx.strokeStyle = '#3f8f4f';
    ctx.lineWidth = 4 * s;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4;
      ctx.beginPath();
      ctx.moveTo(palm.x + 4 * s, palm.y - 26 * s);
      ctx.quadraticCurveTo(
        palm.x + 4 * s + Math.cos(a) * 16 * s,
        palm.y - 26 * s + Math.sin(a) * 16 * s - 6 * s,
        palm.x + 4 * s + Math.cos(a) * 24 * s,
        palm.y - 26 * s + Math.sin(a) * 24 * s + 8 * s,
      );
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(palm.x + 10 * s, palm.y + 4 * s, 14 * s, 5 * s, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#555';
  for (const lamp of G.city.lamps) {
    if (lamp.x < view.x0 || lamp.x > view.x1 || lamp.y < view.y0 || lamp.y > view.y1) continue;
    ctx.fillRect(lamp.x, lamp.y, 3, 14);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(lamp.x + 1, lamp.y - 2, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#555';
  }
}

function drawPickups(G, ctx, view) {
  for (const pk of G.pickups) {
    if (pk.x < view.x0 || pk.x > view.x1 || pk.y < view.y0 || pk.y > view.y1) continue;
    if (pk.life < 3 && Math.floor(G.time * 6) % 2 === 0) continue; // blink out
    const bob = Math.sin(pk.bob) * 3;
    const y = pk.y + bob;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.arc(pk.x, y, 13, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7dff9b';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', pk.x, y + 1);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      rr(ctx, pk.x - 12, y - 12, 24, 24, 5);
      ctx.fill();
      ctx.fillStyle = '#e63946';
      ctx.fillRect(pk.x - 3, y - 8, 6, 16);
      ctx.fillRect(pk.x - 8, y - 3, 16, 6);
    } else if (pk.kind === 'armor') {
      ctx.fillStyle = '#2b6cb0';
      ctx.beginPath();
      ctx.moveTo(pk.x, y - 13);
      ctx.lineTo(pk.x + 11, y - 7);
      ctx.lineTo(pk.x + 11, y + 3);
      ctx.quadraticCurveTo(pk.x + 11, y + 12, pk.x, y + 14);
      ctx.quadraticCurveTo(pk.x - 11, y + 12, pk.x - 11, y + 3);
      ctx.lineTo(pk.x - 11, y - 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', pk.x, y + 1);
    } else if (pk.kind === 'drop') {
      const pulse = 1 + Math.sin(G.time * 5) * 0.12;
      ctx.save();
      ctx.translate(pk.x, y);
      ctx.rotate(Math.PI / 4);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.restore();
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DROP', pk.x, y - 22);
    }
  }
}

function drawMissionMarker(G, ctx) {
  const marker = objectiveMarker(G);
  if (!marker) return;
  const pulse = 1 + Math.sin(G.time * 4) * 0.15;
  // A beam of light so the marker is visible across the city.
  const grad = ctx.createLinearGradient(marker.x, marker.y - 320, marker.x, marker.y);
  grad.addColorStop(0, 'rgba(255, 210, 63, 0)');
  grad.addColorStop(1, 'rgba(255, 210, 63, 0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(marker.x - 8, marker.y - 320, 16, 320);
  ctx.save();
  ctx.translate(marker.x, marker.y);
  ctx.rotate(Math.PI / 4);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-13, -13, 26, 26);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-13, -13, 26, 26);
  ctx.restore();
  // A ring on the ground.
  ctx.strokeStyle = 'rgba(255, 210, 63, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 34 + Math.sin(G.time * 4) * 6, 0, TAU);
  ctx.stroke();
}

function drawPeds(G, ctx, view) {
  for (const p of G.peds) {
    if (p.dead) continue;
    if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
    const bob = Math.sin(p.walkPhase || 0) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 9, 9, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob * 0.4, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3 + bob * 0.4 - 2, 5.5, 0, TAU);
    ctx.fill();
  }
  // Officers on foot.
  for (const cop of G.cops) {
    if (cop.dead) continue;
    if (cop.x < view.x0 || cop.x > view.x1 || cop.y < view.y0 || cop.y > view.y1) continue;
    const bob = Math.sin(cop.walkPhase || 0) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cop.x, cop.y + 9, 9, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1e2a4a';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y + bob * 0.4, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#dfe6f2';
    ctx.beginPath();
    ctx.arc(cop.x + Math.cos(cop.angle) * 3, cop.y + Math.sin(cop.angle) * 3 + bob * 0.4 - 2, 5.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#16233f';
    ctx.fillRect(cop.x - 6, cop.y - 12 + bob * 0.4, 12, 4);
  }
  // Rival gunners.
  if (G.mission && G.mission.enemies) {
    for (const e of G.mission.enemies) {
      if (e.dead) continue;
      if (e.x < view.x0 || e.x > view.x1 || e.y < view.y0 || e.y > view.y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + 9, 9, 4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#8e1616';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 10, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f1c27d';
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(e.angle) * 3, e.y + Math.sin(e.angle) * 3 - 2, 5.5, 0, TAU);
      ctx.fill();
      // Gun barrel.
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(e.angle) * 8, e.y + Math.sin(e.angle) * 8);
      ctx.lineTo(e.x + Math.cos(e.angle) * 18, e.y + Math.sin(e.angle) * 18);
      ctx.stroke();
      // Health bar.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
      ctx.fillStyle = '#ff4747';
      ctx.fillRect(e.x - 14, e.y - 22, 28 * clamp(e.health / 60, 0, 1), 4);
    }
  }
}

function drawCars(G, ctx, view) {
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.x < view.x0 - 60 || car.x > view.x1 + 60 || car.y < view.y0 - 60 || car.y > view.y1 + 60) continue;
    ctx.save();
    ctx.translate(car.x, car.y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(4, 5, 34, 18, car.angle, 0, TAU);
    ctx.fill();
    ctx.rotate(car.angle);
    // Wheels.
    ctx.fillStyle = '#111';
    ctx.fillRect(-24, -19, 12, 6);
    ctx.fillRect(12, -19, 12, 6);
    ctx.fillRect(-24, 13, 12, 6);
    ctx.fillRect(12, 13, 12, 6);
    // Body.
    ctx.fillStyle = car.color;
    rr(ctx, -32, -16, 64, 32, 8);
    ctx.fill();
    if (car.driver === 'player') {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      rr(ctx, -32, -16, 64, 32, 8);
      ctx.stroke();
    }
    // Cabin and windows.
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    rr(ctx, -10, -13, 22, 26, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,240,0.5)';
    ctx.fillRect(-8, -12, 6, 24);
    // Headlights and taillights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(30, -12, 3, 6);
    ctx.fillRect(30, 6, 3, 6);
    ctx.fillStyle = '#ff2d2d';
    ctx.fillRect(-33, -12, 3, 6);
    ctx.fillRect(-33, 6, 3, 6);
    // Police light bar, flashing.
    if (car.kind === 'police') {
      const phase = Math.floor(G.time * 4) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d2d' : '#2d7dff';
      ctx.fillRect(-4, -15, 8, 6);
      ctx.fillStyle = phase ? '#2d7dff' : '#ff2d2d';
      ctx.fillRect(-4, 9, 8, 6);
      // Light glow.
      ctx.fillStyle = phase ? 'rgba(255,45,45,0.25)' : 'rgba(45,125,255,0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, TAU);
      ctx.fill();
    }
    // Smoke when the car is nearly wrecked.
    if (car.health < 35 && Math.random() < 0.3) {
      ctx.fillStyle = 'rgba(60,60,60,0.5)';
      ctx.beginPath();
      ctx.arc(-14 + Math.random() * 8, -6, 6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayer(G, ctx) {
  const p = G.player;
  if (!p.onFoot || G.mode === 'title') return;
  const bob = Math.sin(p.walkPhase || 0) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 10, 10, 4.5, 0, 0, TAU);
  ctx.fill();
  // Body: Rook's yellow jacket.
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.4, 11, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.4, 11, 0, TAU);
  ctx.stroke();
  // Head.
  ctx.fillStyle = '#e0ac69';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.aimAngle) * 3, p.y + Math.sin(p.aimAngle) * 3 + bob * 0.4 - 2, 6.5, 0, TAU);
  ctx.fill();
  // Pistol, aimed at the mouse.
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.aimAngle) * 9, p.y + Math.sin(p.aimAngle) * 9);
  ctx.lineTo(p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20);
  ctx.stroke();
  // A soft ring so the player is always findable.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 17 + Math.sin(G.time * 3) * 1.5, 0, TAU);
  ctx.stroke();
}

function drawBullets(G, ctx) {
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2.5;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(G, ctx) {
  for (const pt of G.particles) {
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    if (pt.kind === 'smoke') {
      ctx.fillStyle = `rgba(70,70,70,${0.55 * a})`;
    } else if (pt.kind === 'fire') {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = a;
    } else if (pt.kind === 'flash') {
      ctx.fillStyle = `rgba(255, 210, 63, ${a})`;
    } else {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = a;
    }
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (pt.kind === 'smoke' ? (1.6 - a * 0.6) : 1), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawFloaters(G, ctx) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
  for (const f of G.floaters) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
