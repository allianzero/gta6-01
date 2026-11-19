// Palmira Bay — named places, shops and street life data: landmarks, stores,
// safehouses and the traffic-light clock. All names are original.
import { makeRng, rngChoice } from './rng.js';
import { WORLD_W, WORLD_H } from './config.js';

export const LANDMARKS = [
  { name: 'Coral Crown Casino', x: 1560, y: 180, kind: 'casino' },
  { name: 'Bayview Pier', x: 3300, y: 1400, kind: 'pier' },
  { name: 'Palmira Stadium', x: 2900, y: 2300, kind: 'stadium' },
  { name: 'Harbor Lighthouse', x: 200, y: 200, kind: 'lighthouse' },
  { name: 'Sunset Mall', x: 1900, y: 1500, kind: 'mall' },
  { name: 'PBPD HQ', x: 1500, y: 1150, kind: 'police' },
  { name: 'Coral Bank', x: 1750, y: 1150, kind: 'bank' },
  { name: 'Mango Motel', x: 700, y: 2100, kind: 'motel' },
];

export const SHOPS = [
  { name: 'Taco Luna', x: 950, y: 500, kind: 'food', price: 12, heal: 30 },
  { name: 'Burger Bay', x: 2100, y: 700, kind: 'food', price: 15, heal: 40 },
  { name: 'Ammo & Sons', x: 1300, y: 1750, kind: 'guns', price: 250, item: 'pistol' },
  { name: 'Ironworks Guns', x: 2600, y: 1500, kind: 'guns', price: 600, item: 'smg' },
  { name: 'Spray & Shine', x: 800, y: 1500, kind: 'paint', price: 100 },
  { name: 'Doc Marina Clinic', x: 2300, y: 2100, kind: 'clinic', price: 80, heal: 100 },
];

export const SAFEHOUSES = [
  { name: 'Rosa\'s Apartment', x: 1450, y: 1250 },
  { name: 'Mango Motel Room 7', x: 700, y: 2100 },
];

export function buildStreetProps(seed) {
  const rng = makeRng(seed + 77);
  const props = [];
  for (let i = 0; i < 160; i++) {
    const x = rng() * WORLD_W;
    const y = rng() * WORLD_H;
    props.push({ x, y, kind: rngChoice(rng, ['hydrant', 'bench', 'bin', 'lamp', 'cone']) });
  }
  return props;
}
export function trafficLightPhase(time, x, y) {
  const cycle = 12;
  const t = (time + (x + y) * 0.01) % cycle;
  return t < 5 ? 'green' : t < 6 ? 'yellow' : 'red';
}
export function nearestLandmark(x, y) {
  let best = null; let bd = Infinity;
  for (const l of LANDMARKS) {
    const d = (l.x - x) ** 2 + (l.y - y) ** 2;
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}
export function nearestShop(x, y, kind) {
  let best = null; let bd = Infinity;
  for (const s of SHOPS) {
    if (kind && s.kind !== kind) continue;
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
