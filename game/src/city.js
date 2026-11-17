// Palmira Bay itself: a sun-soaked coastal city of 8x8 blocks, generated once from
// the fixed seed, so the map is identical on every load. Streets run on a grid;
// blocks hold buildings, parks or parking lots; the south edge is beach and ocean.

import { WORLD, WORLD_W, WORLD_H, BUILDING_COLORS } from './config.js';
import { makeRng, int, range, pick } from './rng.js';
import { clamp, pointInRect, circleRectResolve } from './util.js';

/** Street centre lines, in pixels, for both axes. */
export function streetCenters() {
  const centers = [];
  const step = WORLD.block + WORLD.road;
  for (let i = 0; i <= WORLD.grid; i++) centers.push(i * step + WORLD.road / 2);
  return centers;
}

/** True when (x, y) is on asphalt (a street), not a block, beach or ocean. */
export function isOnRoad(x, y) {
  if (y >= WORLD.beachY) return false;
  const centers = streetCenters();
  const half = WORLD.road / 2;
  for (const c of centers) {
    if (Math.abs(x - c) <= half || Math.abs(y - c) <= half) return true;
  }
  return false;
}

/** The nearest street centre to a point, on one axis. */
export function nearestStreetCoord(v) {
  const centers = streetCenters();
  let best = centers[0];
  for (const c of centers) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return best;
}

/** A random point on a random street, from a seeded rng. */
export function randomStreetPoint(rng) {
  const centers = streetCenters();
  const horizontal = rng() < 0.5;
  const street = pick(rng, centers);
  const along = range(rng, WORLD.road, WORLD_W - WORLD.road);
  return horizontal ? { x: along, y: street } : { x: street, y: along };
}

/** A random point on a sidewalk (the strip just off the asphalt). */
export function randomSidewalkPoint(rng) {
  const centers = streetCenters();
  const horizontal = rng() < 0.5;
  const street = pick(rng, centers);
  const along = range(rng, WORLD.road, WORLD_W - WORLD.road);
  const off = WORLD.road / 2 + WORLD.sidewalk / 2 + range(rng, -4, 4);
  const side = rng() < 0.5 ? -off : off;
  const p = horizontal ? { x: along, y: street + side } : { x: street + side, y: along };
  p.x = clamp(p.x, 40, WORLD_W - 40);
  p.y = clamp(p.y, 40, WORLD.beachY - 40);
  return p;
}

export function generateCity(seed) {
  const rng = makeRng(seed);
  const centers = streetCenters();
  const step = WORLD.block + WORLD.road;
  const blocks = [];
  const buildings = [];
  const palms = [];
  const lamps = [];
  const parks = [];

  for (let bi = 0; bi < WORLD.grid; bi++) {
    for (let bj = 0; bj < WORLD.grid; bj++) {
      const bx = bi * step + WORLD.road;
      const by = bj * step + WORLD.road;
      const roll = rng();
      if (roll < 0.12) {
        // Park: grass, a few palms, no buildings.
        parks.push({ x: bx, y: by, w: WORLD.block, h: WORLD.block });
        const n = int(rng, 3, 6);
        for (let k = 0; k < n; k++) {
          palms.push({ x: bx + range(rng, 30, WORLD.block - 30), y: by + range(rng, 30, WORLD.block - 30), s: range(rng, 0.8, 1.2) });
        }
        continue;
      }
      if (roll < 0.2) {
        // Parking lot: flat asphalt with painted bays.
        blocks.push({ x: bx, y: by, w: WORLD.block, h: WORLD.block, kind: 'lot' });
        continue;
      }
      // Built block: one big building or two smaller ones.
      const block = { x: bx, y: by, w: WORLD.block, h: WORLD.block, kind: 'built' };
      blocks.push(block);
      const two = rng() < 0.45;
      const spots = two
        ? [
            { x: bx + 22, y: by + 22, w: WORLD.block / 2 - 34, h: WORLD.block - 44 },
            { x: bx + WORLD.block / 2 + 12, y: by + 22, w: WORLD.block / 2 - 34, h: WORLD.block - 44 },
          ]
        : [{ x: bx + 24, y: by + 24, w: WORLD.block - 48, h: WORLD.block - 48 }];
      for (const s of spots) {
        const color = pick(rng, BUILDING_COLORS);
        const h = int(rng, 1, 3); // storeys, drawn as a height offset
        buildings.push({
          x: s.x, y: s.y, w: s.w, h: s.h, color, storeys: h,
          roof: shade(color, -28),
          // Roof dressing: AC boxes and, rarely, a rooftop pool.
          ac: Array.from({ length: int(rng, 1, 3) }, () => ({
            x: range(rng, 14, Math.max(15, s.w - 44)),
            y: range(rng, 14, Math.max(15, s.h - 44)),
            s: range(rng, 10, 18),
          })),
          pool: rng() < 0.14 && s.w > 130 && s.h > 130,
        });
      }
    }
  }

  // Palm trees along the sidewalks and the beach promenade.
  for (const c of centers) {
    for (let t = WORLD.road * 2; t < WORLD_W - WORLD.road; t += 300) {
      if (rng() < 0.6) {
        palms.push({ x: t + range(rng, -40, 40), y: c + WORLD.road / 2 + WORLD.sidewalk / 2, s: range(rng, 0.85, 1.25) });
      }
      if (rng() < 0.5) {
        lamps.push({ x: t + 150, y: c - WORLD.road / 2 - 6 });
      }
    }
  }
  for (let x = 80; x < WORLD_W; x += 170) {
    palms.push({ x: x + range(rng, -20, 20), y: WORLD.beachY + 26, s: range(rng, 0.9, 1.3) });
  }

  return {
    seed,
    centers,
    blocks,
    buildings,
    palms,
    lamps,
    parks,
    width: WORLD_W,
    height: WORLD_H,
    beachY: WORLD.beachY,
    oceanY: WORLD.oceanY,
  };
}

/** Darken (negative) or lighten (positive) a #rrggbb colour by an amount. */
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amount, 0, 255);
  const g = clamp(((n >> 8) & 0xff) + amount, 0, 255);
  const b = clamp((n & 0xff) + amount, 0, 255);
  return `rgb(${r},${g},${b})`;
}

/**
 * Resolve a circle against every building and the world edge.
 * Mutates `pos`; returns true when anything pushed it.
 */
export function collideCity(pos, radius, city) {
  let hit = false;
  // Simple full scan is cheap: ~130 buildings, called a few dozen times a frame.
  for (const b of city.buildings) {
    if (pos.x + radius < b.x || pos.x - radius > b.x + b.w ||
        pos.y + radius < b.y || pos.y - radius > b.y + b.h) continue;
    if (circleRectResolve(pos, radius, b)) hit = true;
  }
  // The ocean stops everyone: the south edge is water, not a wall.
  if (pos.y > WORLD.oceanY - 8) { pos.y = WORLD.oceanY - 8; hit = true; }
  // World edge: the ocean stops the player, the north/west/east edges are walls.
  const m = radius + 2;
  if (pos.x < m) { pos.x = m; hit = true; }
  if (pos.x > WORLD_W - m) { pos.x = WORLD_W - m; hit = true; }
  if (pos.y < m) { pos.y = m; hit = true; }
  if (pos.y > WORLD_H - m) { pos.y = WORLD_H - m; hit = true; }
  return hit;
}

/** True when a circle overlaps any building. */
export function hitsBuilding(x, y, radius, city) {
  for (const b of city.buildings) {
    if (x + radius < b.x || x - radius > b.x + b.w ||
        y + radius < b.y || y - radius > b.y + b.h) continue;
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < radius * radius) return true;
  }
  return false;
}

export { pointInRect };
