// Small pure helpers shared by every system: angles, distances, circle-vs-rect
// collision. Nothing here touches game state, so nothing here can cycle-import.

export const TAU = Math.PI * 2;

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Shortest signed turn from angle `from` to angle `to`, in (-PI, PI]. */
export function angleDiff(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** Move `from` toward `to` by at most `maxStep` radians. */
export function angleApproach(from, to, maxStep) {
  const d = angleDiff(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/**
 * Push a circle (x, y, radius) out of a rectangle. Mutates `pos` in place and
 * returns true when a push happened. The circle slides along the rect's faces.
 */
export function circleRectResolve(pos, radius, r) {
  const cx = clamp(pos.x, r.x, r.x + r.w);
  const cy = clamp(pos.y, r.y, r.y + r.h);
  const dx = pos.x - cx;
  const dy = pos.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * radius;
    pos.y = cy + (dy / d) * radius;
  } else {
    // Centre inside the rect: push out along the smallest penetration.
    const left = pos.x - r.x;
    const right = r.x + r.w - pos.x;
    const top = pos.y - r.y;
    const bottom = r.y + r.h - pos.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) pos.x = r.x - radius;
    else if (m === right) pos.x = r.x + r.w + radius;
    else if (m === top) pos.y = r.y - radius;
    else pos.y = r.y + r.h + radius;
  }
  return true;
}

/** True when two circles overlap. */
export function circlesOverlap(a, b) {
  const rr = a.r + b.r;
  return dist2(a.x, a.y, b.x, b.y) < rr * rr;
}

/** Format seconds as M:SS. */
export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Format dollars with commas: 1500 -> $1,500. */
export function formatCash(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}
