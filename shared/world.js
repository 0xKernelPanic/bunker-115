// Turns map data into geometry pieces, colliders, windows and doors.
// Used by the simulation (collisions, spawns) and by the client (meshes, prediction).
import { stashFootprint } from './puzzles.js';
export const WALL_T = .3;
export const SILL = 1.0, WIN_TOP = 2.3, DOOR_TOP = 2.6;

// Axis-aligned footprint of a machine standing against a wall with normal (nx, nz).
export function footprint(cx, cz, nx, nz, along, depth) {
  const hx = Math.abs(nx) > .5 ? depth / 2 : along / 2, hz = Math.abs(nx) > .5 ? along / 2 : depth / 2;
  return { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz };
}

// How far a wall runs past its end point. Walls that continue in a straight line just meet;
// a wall ending against a crossing wall stops a hair inside it; a free end gets a square corner.
// (Overlapping faces in the same plane flicker against each other.)
function endExt(w, all, t) {
  if (!all) return WALL_T / 2;
  for (const o of all) {
    if (o === w) continue;
    if (o.axis === w.axis && Math.abs(o.at - w.at) < .01 && (Math.abs(o.from - t) < .01 || Math.abs(o.to - t) < .01)) return 0;
  }
  for (const o of all) {
    if (o.axis !== w.axis && Math.abs(o.at - t) < .01 && w.at >= o.from - WALL_T && w.at <= o.to + WALL_T) return WALL_T / 2 - .01;
  }
  return WALL_T / 2;
}
export function wallPieces(w, all) {
  const H = w.h || 3.2, out = [];
  const seg = (t0, t1, y0, y1, kind) => {
    if (t1 - t0 < .01 || y1 - y0 < .01) return;
    const tc = (t0 + t1) / 2, len = t1 - t0, yc = (y0 + y1) / 2, h = y1 - y0;
    out.push(w.axis === 'x'
      ? { cx: tc, cy: yc, cz: w.at, sx: len, sy: h, sz: WALL_T, kind, mat: w.mat }
      : { cx: w.at, cy: yc, cz: tc, sx: WALL_T, sy: h, sz: len, kind, mat: w.mat });
  };
  let cur = w.from - endExt(w, all, w.from);
  const ops = (w.open || []).slice().sort((a, b) => a.t - b.t);
  for (const o of ops) {
    const s = o.t - o.w / 2, e = o.t + o.w / 2;
    seg(cur, s, 0, H, 'wall');
    if (o.type === 'window') { seg(s, e, 0, SILL, 'sill'); seg(s, e, WIN_TOP, H, 'lintel'); }
    else seg(s, e, DOOR_TOP, H, 'lintel');
    cur = e;
  }
  seg(cur, w.to + endExt(w, all, w.to), 0, H, 'wall');
  return out;
}

export function zoneAt(map, x, z) {
  for (const zn of map.zones) for (const r of zn.rects) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return zn.id;
  return null;
}

export function buildWorld(map) {
  const colliders = [], windows = [], doors = {};
  const rect = (minX, maxX, minZ, maxZ, tag) => { const c = { minX, maxX, minZ, maxZ, off: false, tag }; colliders.push(c); return c; };
  for (const w of map.walls) {
    for (const p of wallPieces(w, map.walls)) if (p.kind !== 'lintel') rect(p.cx - p.sx / 2, p.cx + p.sx / 2, p.cz - p.sz / 2, p.cz + p.sz / 2, p.kind);
    for (const o of w.open || []) {
      const x = w.axis === 'x' ? o.t : w.at, z = w.axis === 'x' ? w.at : o.t;
      if (o.type === 'window') {
        const nx = w.axis === 'z' ? o.out : 0, nz = w.axis === 'x' ? o.out : 0;
        windows.push({ id: o.id, x, z, nx, nz, axis: w.axis, w: o.w,
          inX: x - nx * .9, inZ: z - nz * .9, outX: x + nx * .75, outZ: z + nz * .75,
          zone: zoneAt(map, x - nx * .9, z - nz * .9), spawnMin: o.spawnMin || 7, spawnMax: o.spawnMax || 13, lat: o.lat ?? 3 });
      } else {
        const def = map.doors.find(d => d.id === o.id) || { id: o.id, cost: 1000, zones: [] };
        const c = w.axis === 'x'
          ? rect(x - o.w / 2, x + o.w / 2, z - WALL_T / 2, z + WALL_T / 2, 'door')
          : rect(x - WALL_T / 2, x + WALL_T / 2, z - o.w / 2, z + o.w / 2, 'door');
        doors[o.id] = Object.assign({}, def, { x, z, w: o.w, axis: w.axis, col: c });
      }
    }
  }
  for (const p of map.props || []) {
    if (!p.collide) continue;
    const sw = p.rot ? p.d : p.w, sd = p.rot ? p.w : p.d;
    rect(p.x - sw / 2, p.x + sw / 2, p.z - sd / 2, p.z + sd / 2, 'prop');
  }
  for (const h of map.hides || []) { const f = footprint(h.x, h.z, h.nx, h.nz, .75, .6); rect(f.minX, f.maxX, f.minZ, f.maxZ, 'hide'); }
  for (const pz of map.puzzles || []) { const f = stashFootprint(pz.stash); rect(f.minX, f.maxX, f.minZ, f.maxZ, 'prop'); }
  return { map, colliders, windows, doors, winById: Object.fromEntries(windows.map(w => [w.id, w])) };
}

export function setDoorOpen(world, id, open) { const d = world.doors[id]; if (d) d.col.off = open; }

// Circle (radius r) vs every enabled AABB, pushing p out. Mutates p.x / p.z.
export function collide(p, r, colliders) {
  for (const b of colliders) {
    if (b.off) continue;
    const cx = Math.max(b.minX, Math.min(p.x, b.maxX)), cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
    else {
      const pl = p.x - b.minX, pr = b.maxX - p.x, pb = p.z - b.minZ, pf = b.maxZ - p.z, m = Math.min(pl, pr, pb, pf);
      if (m === pl) p.x = b.minX - r; else if (m === pr) p.x = b.maxX + r; else if (m === pb) p.z = b.minZ - r; else p.z = b.maxZ + r;
    }
  }
}

export function pointBlocked(x, z, colliders, pad = 0) {
  for (const b of colliders) if (!b.off && x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return b;
  return null;
}

// A zone is reachable once the game starts in it or any door leading into it is open.
export function activeZones(map, doorsOpen) {
  const act = new Set(map.zones.filter(z => z.start).map(z => z.id));
  for (const d of map.doors) if (doorsOpen[d.id]) d.zones.forEach(z => act.add(z));
  return act;
}
