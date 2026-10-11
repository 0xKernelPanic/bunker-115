// Grid navigation for zombies inside the playable zones.
// Each living player gets a BFS distance field; zombies walk downhill on the field of their target.
import { zoneAt, pointBlocked } from './world.js';

const CS = .5;
const INF = 65535;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class Nav {
  constructor(world) {
    this.world = world;
    const b = world.map.navBounds;
    this.x0 = b[0]; this.z0 = b[1];
    this.W = Math.ceil((b[2] - b[0]) / CS); this.H = Math.ceil((b[3] - b[1]) / CS);
    this.blocked = new Uint8Array(this.W * this.H);
    this.queue = new Int32Array(this.W * this.H);
    this.rebuild();
  }
  rebuild() {
    const { W, H, blocked, world } = this;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = this.x0 + (i + .5) * CS, z = this.z0 + (j + .5) * CS;
      blocked[j * W + i] = (zoneAt(world.map, x, z) === null || pointBlocked(x, z, world.colliders, .27)) ? 1 : 0;
    }
    this.version = (this.version || 0) + 1;
  }
  cell(x, z) {
    const i = Math.floor((x - this.x0) / CS), j = Math.floor((z - this.z0) / CS);
    if (i < 0 || j < 0 || i >= this.W || j >= this.H) return -1;
    return j * this.W + i;
  }
  center(c) { return { x: this.x0 + (c % this.W + .5) * CS, z: this.z0 + (Math.floor(c / this.W) + .5) * CS }; }
  free(c) { return c >= 0 && !this.blocked[c]; }
  // Nearest unblocked cell, searching a small ring around (x, z).
  freeCell(x, z) {
    let c = this.cell(x, z);
    if (this.free(c)) return c;
    for (let r = 1; r <= 4; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const cc = this.cell(x + di * CS, z + dj * CS);
      if (this.free(cc)) return cc;
    }
    return -1;
  }
  field(x, z, out) {
    const { W, H, blocked, queue } = this, n = W * H;
    const f = out && out.length === n ? out : new Uint16Array(n);
    f.fill(INF);
    const s = this.freeCell(x, z);
    if (s < 0) return f;
    let qh = 0, qt = 0;
    f[s] = 0; queue[qt++] = s;
    while (qh < qt) {
      const c = queue[qh++], ci = c % W, cj = (c - ci) / W, d = f[c];
      for (let k = 0; k < 8; k++) {
        const ni = ci + N8[k][0], nj = cj + N8[k][1];
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const nc = nj * W + ni;
        if (blocked[nc] || f[nc] !== INF) continue;
        if (k >= 4 && (blocked[cj * W + ni] || blocked[nj * W + ci])) continue;
        f[nc] = d + (k >= 4 ? 3 : 2);
        queue[qt++] = nc;
      }
    }
    return f;
  }
  distAt(f, x, z) { const c = this.freeCell(x, z); return c < 0 ? INF : f[c]; }
  clearLine(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / .25);
    for (let i = 1; i < n; i++) { const t = i / n; if (!this.free(this.cell(ax + (bx - ax) * t, az + (bz - az) * t))) return false; }
    return true;
  }
  // Point to steer toward: follow the field downhill a few cells, keep the farthest one in straight sight.
  steer(f, x, z) {
    let c = this.freeCell(x, z);
    if (c < 0 || f[c] === INF) return null;
    const { W } = this;
    let target = null;
    for (let step = 0; step < 6; step++) {
      const ci = c % W, cj = (c - ci) / W;
      let best = c, bv = f[c];
      for (let k = 0; k < 8; k++) {
        const ni = ci + N8[k][0], nj = cj + N8[k][1];
        if (ni < 0 || nj < 0 || ni >= W || nj >= this.H) continue;
        const nc = nj * W + ni;
        if (f[nc] >= bv) continue;
        if (k >= 4 && (this.blocked[cj * W + ci + N8[k][0]] || this.blocked[(cj + N8[k][1]) * W + ci])) continue;
        bv = f[nc]; best = nc;
      }
      if (best === c) break;
      c = best;
      const p = this.center(c);
      if (step === 0 || this.clearLine(x, z, p.x, p.z)) target = p; else break;
    }
    return target;
  }
}
export const NAV_INF = INF;
