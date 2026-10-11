// Small helpers shared by the server simulation and the browser client.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const R = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.random() * arr.length | 0];
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// Deterministic xorshift RNG, so every client builds the same zombie from its id.
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function weightedPick(entries) {
  const total = entries.reduce((n, e) => n + e.w, 0);
  let r = Math.random() * total;
  for (const e of entries) { r -= e.w; if (r <= 0) return e; }
  return entries[entries.length - 1];
}

// Polish noun forms: 1 runda, 2-4 rundy, 5+ rund.
export function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && (h < 10 || h >= 20) ? few : many;
}
