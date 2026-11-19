// Palmira Bay — the city itself: a deterministic road grid, blocks full of
// buildings, parks and plazas, plus collision and road queries.
import { WORLD_W, WORLD_H, ROAD, BLOCK, STEP, DISTRICTS } from './config.js';
import { makeRng, rngInt, rngRange, rngChoice } from './rng.js';
import { clamp } from './util.js';

export function roadXs() {
  const xs = [];
  for (let x = 0; x <= WORLD_W; x += STEP) xs.push(x);
  return xs;
}
export function roadYs() {
  const ys = [];
  for (let y = 0; y <= WORLD_H; y += STEP) ys.push(y);
  return ys;
}
export function isOnRoad(x, y) {
  const mx = ((x % STEP) + STEP) % STEP;
  const my = ((y % STEP) + STEP) % STEP;
  return mx < ROAD || my < ROAD;
}
export function nearestRoadPoint(x, y) {
  const gx = Math.round(x / STEP) * STEP;
  const gy = Math.round(y / STEP) * STEP;
  const cx = clamp(gx, 0, WORLD_W);
  const cy = clamp(gy, 0, WORLD_H);
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  if (dx < dy) return { x: cx, y: clamp(y, 0, WORLD_H), horizontal: false };
  return { x: clamp(x, 0, WORLD_W), y: cy, horizontal: true };
}
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[4];
}
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const parks = [];
  const lots = [];
  let id = 0;
  for (let bx = 0; bx < WORLD_W / STEP; bx++) {
    for (let by = 0; by < WORLD_H / STEP; by++) {
      const ox = bx * STEP + ROAD;
      const oy = by * STEP + ROAD;
      const d = districtAt(ox + BLOCK / 2, oy + BLOCK / 2);
      const roll = rng();
      if (d.name === 'Coral Beach' && by >= 2) {
        parks.push({ x: ox, y: oy, w: BLOCK, h: BLOCK, kind: 'sand' });
        for (let i = 0; i < 6; i++) palms.push({ x: ox + rng() * BLOCK, y: oy + rng() * BLOCK });
        continue;
      }
      if (roll < 0.14) {
        parks.push({ x: ox, y: oy, w: BLOCK, h: BLOCK, kind: rng() < 0.5 ? 'park' : 'plaza' });
        for (let i = 0; i < 5; i++) palms.push({ x: ox + 20 + rng() * (BLOCK - 40), y: oy + 20 + rng() * (BLOCK - 40) });
        continue;
      }
      if (roll < 0.2) {
        lots.push({ x: ox, y: oy, w: BLOCK, h: BLOCK });
        continue;
      }
      const cols = rng() < 0.5 ? 2 : 3;
      const rows = rng() < 0.5 ? 2 : 3;
      const cw = BLOCK / cols, ch = BLOCK / rows;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (rng() < 0.12) continue;
          const w = cw * rngRange(rng, 0.55, 0.8);
          const h = ch * rngRange(rng, 0.55, 0.8);
          const tall = d.name === 'Downtown' || d.name === 'Neon Strip';
          buildings.push({
            id: id++,
            x: ox + cx * cw + (cw - w) / 2,
            y: oy + cy * ch + (ch - h) / 2,
            w, h,
            floors: tall ? rngInt(rng, 6, 18) : rngInt(rng, 1, 4),
            color: rngChoice(rng, ['#b98a5e', '#8e9aa8', '#c2b49a', '#7a8ba0', '#a86a5e', '#6b7a8e', '#c98a7a', '#94a88e']),
            roof: rngChoice(rng, ['#5a4a3a', '#3a4a5a', '#6a5a4a', '#2e3a2e']),
            district: d.name,
          });
        }
      }
    }
  }
  return { buildings, palms, parks, lots, seed };
}
export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
export function resolveCircle(city, p, r) {
  const b = collideBuildings(city, p.x, p.y, r);
  if (!b) return false;
  const cx = clamp(p.x, b.x, b.x + b.w);
  const cy = clamp(p.y, b.y, b.y + b.h);
  const dx = p.x - cx, dy = p.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 0.001) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * r;
    p.y = cy + (dy / d) * r;
  } else {
    p.x += r;
  }
  return true;
}
export function randomRoadSpot(rng) {
  const xs = roadXs(), ys = roadYs();
  const horizontal = rng() < 0.5;
  if (horizontal) {
    const east = rng() < 0.5;
    return { x: rngRange(rng, 60, WORLD_W - 60), y: xs[Math.floor(rng() * xs.length)] + ROAD / 2 + (east ? 24 : -24), angle: east ? 0 : Math.PI };
  }
  const south = rng() < 0.5;
  return { x: ys[Math.floor(rng() * ys.length)] + ROAD / 2 + (south ? -24 : 24), y: rngRange(rng, 60, WORLD_H - 60), angle: south ? Math.PI / 2 : -Math.PI / 2 };
}
export function randomSidewalkSpot(rng) {
  // Sidewalk edge: just off the road surface, so walkers rarely cross traffic.
  const s = randomRoadSpot(rng);
  const near = nearestRoadPoint(s.x, s.y);
  if (near.horizontal) return { x: clamp(s.x + rngRange(rng, -160, 160), 40, WORLD_W - 40), y: near.y + (rng() < 0.5 ? 1 : -1) * (ROAD / 2 + 16) };
  return { x: near.x + (rng() < 0.5 ? 1 : -1) * (ROAD / 2 + 16), y: clamp(s.y + rngRange(rng, -160, 160), 40, WORLD_H - 40) };
}
