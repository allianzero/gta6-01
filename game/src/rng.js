// Palmira Bay — deterministic seeded random numbers (mulberry32).
// The whole city, traffic and pedestrian flow derive from one seed so a
// fresh run always builds the same Palmira Bay.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rngInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
export function rngRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function rngChoice(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
