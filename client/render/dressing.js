// Set dressing: the small things that make a room look lived in and then abandoned. Skirting
// boards and grime along the walls, stains, pipes, door frames, holes in the ceiling, papers and
// glass on the floor, and a few things that belong to each kind of room. Nothing here collides
// or changes how anyone moves: it is all flat, thin, or pushed against a wall.
import * as THREE from 'three';
import { lam, basic } from './psx.js';
import { mkCanvas, toTex, rgb, bloodTex } from './textures.js';
import { wallPieces, zoneAt, WALL_T, SILL, WIN_TOP, DOOR_TOP } from '../../shared/world.js';
import { rng } from '../../shared/util.js';

// what kind of room each zone is
const THEMES = {
  'sanatorium:R': 'reception', 'sanatorium:C': 'morgue', 'sanatorium:O': 'ward', 'sanatorium:K': 'boiler', 'sanatorium:S': 'surgery',
  'estate:H': 'hall', 'estate:L': 'library', 'estate:S': 'study', 'estate:D': 'dining', 'estate:K': 'kitchen', 'estate:R': 'garage',
  'bunkier:A': 'bunker', 'bunkier:B': 'bunker',
  'waterworks:G': 'reception', 'waterworks:P': 'boiler', 'waterworks:F': 'boiler', 'waterworks:L': 'surgery', 'waterworks:C': 'tunnel',
  'mine:E': 'lamproom', 'mine:H': 'tunnel', 'mine:S': 'stope', 'mine:M': 'magazine', 'mine:P': 'boiler', 'mine:F': 'reception'
};

// ---------- textures ----------
function grimeTex(seed) {
  const r = rng(seed), c = mkCanvas(64, 64), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 64, 0, 0);
  grad.addColorStop(0, 'rgba(18,14,8,.75)'); grad.addColorStop(.35, 'rgba(26,20,12,.35)'); grad.addColorStop(1, 'rgba(30,24,14,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(20,14,8,.25)'; g.fillRect(r() * 64, 20 + r() * 44, 1 + r() * 2, 6 + r() * 30); }   // drips running down
  return toTex(c, true, false);
}
function stainTex(seed, kind) {
  const r = rng(seed), c = mkCanvas(64, 64), g = c.getContext('2d');
  if (kind === 'peel') {
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(${70 + r() * 30},${60 + r() * 25},${44 + r() * 20},.9)`; g.beginPath(); g.ellipse(16 + r() * 32, 16 + r() * 32, 6 + r() * 12, 4 + r() * 9, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(220,214,190,.6)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(20 + r() * 24, 20 + r() * 24, 8 + r() * 10, r() * 6, r() * 6 + 1.5); g.stroke(); }
  } else if (kind === 'water') {
    for (let k = 0; k < 4; k++) { g.strokeStyle = `rgba(60,46,24,${.25 + k * .1})`; g.lineWidth = 2; g.beginPath(); g.ellipse(32, 20 + k * 3, 26 - k * 5, 16 - k * 3, 0, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(60,46,24,.25)'; g.beginPath(); g.ellipse(32, 24, 18, 12, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 5; i++) g.fillRect(14 + r() * 36, 30, 1.5, 10 + r() * 30);
  } else {   // a bloody hand print smeared down the wall
    g.fillStyle = 'rgba(90,8,5,.85)';
    g.beginPath(); g.ellipse(32, 18, 9, 11, 0, 0, Math.PI * 2); g.fill();
    for (let f = 0; f < 4; f++) g.fillRect(22 + f * 6, 2 + Math.abs(f - 1.5) * 2, 4, 12);
    g.fillRect(14, 16, 8, 4);
    for (let i = 0; i < 4; i++) g.fillRect(24 + i * 5, 26, 3, 14 + r() * 24);
  }
  return toTex(c, false, false);
}
function paperTex(seed, kind) {
  const r = rng(seed), c = mkCanvas(32, 40), g = c.getContext('2d');
  g.fillStyle = kind === 'map' ? rgb(176, 160, 120) : rgb(200, 194, 172); g.fillRect(0, 0, 32, 40);
  if (kind === 'map') {
    g.strokeStyle = 'rgba(60,70,90,.7)'; g.lineWidth = .7;
    for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(r() * 32, r() * 40); g.bezierCurveTo(r() * 32, r() * 40, r() * 32, r() * 40, r() * 32, r() * 40); g.stroke(); }
    g.fillStyle = 'rgba(150,20,10,.8)'; for (let i = 0; i < 4; i++) g.fillRect(r() * 28, r() * 36, 3, 3);
  } else {
    g.fillStyle = 'rgba(40,36,30,.55)'; for (let y = 5; y < 36; y += 3) g.fillRect(3, y, 6 + r() * 22, 1);
  }
  g.fillStyle = 'rgba(80,60,30,.25)'; g.fillRect(0, 36, 32, 4);
  return toTex(c, false, false);
}
function paintingTex(seed) {
  const r = rng(seed), c = mkCanvas(48, 64), g = c.getContext('2d');
  g.fillStyle = rgb(30 + r() * 20, 26 + r() * 16, 20); g.fillRect(0, 0, 48, 64);
  // a dark portrait whose face has been scratched out
  g.fillStyle = rgb(60, 48, 36); g.beginPath(); g.ellipse(24, 40, 14, 22, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = rgb(150, 124, 100); g.beginPath(); g.ellipse(24, 22, 8, 10, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(10,8,6,.95)'; g.lineWidth = 1.5; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(17 + r() * 4, 14 + r() * 4); g.lineTo(27 + r() * 4, 28 + r() * 4); g.stroke(); }
  return toTex(c, false, false);
}

export function dressWorld(scene, world, TX, M) {
  const map = world.map, r = rng(map.id.length * 101 + 17);
  const group = new THREE.Group(); group.userData.dressing = true; scene.add(group);
  const keep = [];   // places to leave clear: items, notes, hides, doors, windows, props
  for (const it of map.items || []) if (it.x !== null && it.x !== undefined) keep.push([it.x, it.z, .9]);
  for (const n of map.notes || []) keep.push([n.x, n.z, .9]);
  for (const h of map.hides || []) keep.push([h.x, h.z, 1.1]);
  for (const w of world.windows) keep.push([w.x, w.z, 1.6]);
  for (const id in world.doors) { const d = world.doors[id]; keep.push([d.x, d.z, 1.8]); }
  for (const p of map.props || []) keep.push([p.x, p.z, Math.max(p.w || 1, p.d || 1) / 2 + .5]);
  for (const s of map.useSpots || []) keep.push([s.x, s.z, 1.5]);
  // never cover anything you can use on a wall
  for (const w of map.wallBuys || []) keep.push([w.x, w.z, 1.4]);
  for (const o of [map.fusebox, map.radio]) if (o) keep.push([o.x, o.z, 1.4]);
  for (const t of map.traps || []) keep.push([t.sx, t.sz, 1.2]);
  for (const pz of map.puzzles || []) { for (const q of [pz.lock, pz.stash, ...(pz.switches || [])]) if (q) keep.push([q.x, q.z, 1.4]); }
  const clear = (x, z, rad = 0) => keep.every(([kx, kz, kr]) => Math.hypot(kx - x, kz - z) > kr + rad);
  const theme = (x, z) => { const id = zoneAt(map, x, z); return id && THEMES[map.id + ':' + id]; };
  const indoor = (x, z) => { const id = zoneAt(map, x, z), zn = id && map.zones.find(q => q.id === id); return zn && zn.ceil ? zn : null; };

  const mats = {
    grime: [0, 1, 2].map(i => lam(grimeTex(map.id.length + i), { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 })),
    stains: ['peel', 'water', 'hand'].map((k, i) => lam(stainTex(i * 7 + 3, k), { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
    blood: [1, 2, 3].map(i => lam(bloodTex(i + 10), { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
    paper: [0, 1, 2].map(i => lam(paperTex(i + 4), { side: THREE.DoubleSide })),
    map: lam(paperTex(9, 'map'), { side: THREE.DoubleSide }),
    painting: [0, 1, 2].map(i => lam(paintingTex(i + 21))),
    trim: lam(null, { color: 0x3a2c1e }), trimPale: lam(null, { color: 0x8a8678 }),
    pipe: M.metal, rust: M.rust, dark: M.dark, wood: M.wood, sheet: M.sheet,
    glass: basic({ color: 0x9fb4b0, transparent: true, opacity: .55 }),
    bag: lam(null, { color: 0x2a2c2a }), sand: M.sandbag || lam(null, { color: 0x7a6a48 }),
    cable: basic({ color: 0x0c0c0c }), hole: basic({ color: 0x050403, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    flame: new THREE.SpriteMaterial({ map: TX.glowWhite, color: 0xffb060, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })
  };
  const add = (geo, mat, x, y, z, ry = 0, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); group.add(m); return m; };
  const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // a flat quad against a wall at (x, z) whose room-side normal is (nx, nz)
  const onWall = (w, h, x, y, z, nx, nz, mat, off = .005) => {
    const g = new THREE.PlaneGeometry(w, h), m = new THREE.Mesh(g, mat);
    m.position.set(x + nx * off, y, z + nz * off); m.rotation.y = Math.atan2(nx, nz); group.add(m); return m;
  };
  const onFloor = (w, d, x, z, mat, rot = 0, y = .02) => {
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.rotateY(rot);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); group.add(m); return m;
  };

  // ---------- walls: every full wall piece, on each side that faces a room ----------
  const runs = [];
  for (const w of map.walls) for (const p of wallPieces(w, map.walls)) {
    if (p.kind !== 'wall') continue;
    for (const s of [-1, 1]) {
      const nx = w.axis === 'z' ? s : 0, nz = w.axis === 'x' ? s : 0;
      const len = w.axis === 'x' ? p.sx : p.sz;
      const fx = p.cx + nx * (WALL_T / 2), fz = p.cz + nz * (WALL_T / 2);
      const zn = indoor(fx + nx * .4, fz + nz * .4);
      if (!zn || len < .5) continue;
      runs.push({ w, p, nx, nz, len, fx, fz, zn, th: theme(fx + nx * .4, fz + nz * .4) });
    }
  }
  for (const R of runs) {
    const { nx, nz, len, fx, fz, zn, th, w } = R, ry = Math.atan2(nx, nz);
    const along = w.axis === 'x' ? [1, 0] : [0, 1];
    // skirting board (not on bare rock)
    if (!map.underground) add(boxG(w.axis === 'x' ? len : .035, .13, w.axis === 'x' ? .035 : len), th === 'boiler' || th === 'garage' || th === 'bunker' ? mats.dark : mats.trim, fx + nx * .017, .065, fz + nz * .017);
    // grime rising from the floor, heavier in the basement rooms
    const gh = th === 'boiler' || th === 'morgue' || th === 'bunker' ? 1.6 : 1.1;
    onWall(len, gh, fx, gh / 2, fz, nx, nz, mats.grime[(r() * 3) | 0], .01);
    // a dado rail in the old rooms
    if (w.mat === 'plaster' || w.mat === 'wallpaper') add(boxG(w.axis === 'x' ? len : .03, .05, w.axis === 'x' ? .03 : len), w.mat === 'wallpaper' ? mats.trim : mats.trimPale, fx + nx * .015, 1.0, fz + nz * .015);
    // stains, peeling paint and the odd bloody hand
    const nSt = Math.floor(len / 3.5 + r() * 1.5);
    for (let i = 0; i < nSt; i++) {
      const t = (r() - .5) * (len - 1), x = fx + along[0] * t, z = fz + along[1] * t;
      // no peeling paint on bare rock: only water marks and the odd hand print
      const k = map.underground ? .5 + r() * .5 : r(), m = k < .5 ? mats.stains[0] : k < .82 ? mats.stains[1] : mats.stains[2];
      const sz = m === mats.stains[2] ? .45 : .8 + r() * 1.1;
      onWall(sz, sz, x, m === mats.stains[1] ? zn.ceil - sz / 2 - .05 : 1.1 + r() * 1.2, z, nx, nz, m, .012 + i * .001);
    }
    // pipes along the top of basement and service walls
    if ((th === 'boiler' || th === 'morgue' || th === 'bunker' || th === 'kitchen' || th === 'garage' || th === 'tunnel' || th === 'magazine') && len > 2) {
      const y = zn.ceil - .35 - (r() * .25), rad = .05 + r() * .04;
      const pg = new THREE.CylinderGeometry(rad, rad, len, 6); pg.rotateZ(Math.PI / 2); if (w.axis === 'z') pg.rotateY(Math.PI / 2);
      add(pg, r() < .5 ? mats.rust : mats.pipe, fx + nx * (rad + .05), y, fz + nz * (rad + .05));
      for (let t = -len / 2 + .4; t < len / 2; t += 1.6) add(boxG(.04, .12, .04), mats.dark, fx + along[0] * t + nx * .05, y + .05, fz + along[1] * t + nz * .05);
    }
    // things hung on the wall
    if (len > 2.2 && r() < .55) {
      const t = (r() - .5) * (len - 1.6), x = fx + along[0] * t, z = fz + along[1] * t;
      if (clear(x + nx * .4, z + nz * .4)) {
        if (th === 'hall' || th === 'library' || th === 'dining' || th === 'study') {
          add(boxG(w.axis === 'x' ? .78 : .05, 1.0, w.axis === 'x' ? .05 : .78), mats.trim, x + nx * .03, 1.75, z + nz * .03).rotation.z = (r() - .5) * .08;
          onWall(.62, .84, x, 1.75, z, nx, nz, mats.painting[(r() * 3) | 0], .07);
        } else if (th === 'bunker') {
          onWall(.9, .7, x, 1.6, z, nx, nz, mats.map, .01).rotation.z = (r() - .5) * .1;
        } else if (th === 'boiler') {
          // pressure gauges
          for (let k = 0; k < 2; k++) {
            const gg = new THREE.CylinderGeometry(.11, .11, .05, 10); gg.rotateX(Math.PI / 2);
            const m = add(gg, mats.trimPale, x + along[0] * k * .35 + nx * .03, 1.55, z + along[1] * k * .35 + nz * .03); m.rotation.y = ry;
          }
        } else {
          // a notice board with papers pinned to it
          add(boxG(w.axis === 'x' ? .9 : .04, .65, w.axis === 'x' ? .04 : .9), M.board, x + nx * .03, 1.55, z + nz * .03);
          for (let k = 0; k < 3; k++) onWall(.2, .26, x + along[0] * (k - 1) * .26, 1.55 + (r() - .5) * .15, z + along[1] * (k - 1) * .26, nx, nz, mats.paper[k % 3], .06).rotation.z = (r() - .5) * .3;
        }
      }
    }
  }

  // ---------- mine: timber posts under every roof beam, against the rock ----------
  if (map.underground) {
    for (const zn of map.zones) for (const rc of zn.rects) {
      if (!zn.ceil) continue;
      const span = rc[2] - rc[0], n = Math.floor(span / 3);
      for (let i = 1; i <= n; i++) {
        const x = rc[0] + i * span / (n + 1);
        for (const [z, sgn] of [[rc[1] + .14, 1], [rc[3] - .14, -1]]) {
          if (!clear(x, z + sgn * .3, -.4)) continue;
          add(boxG(.2, zn.ceil - .3, .2), mats.wood, x, (zn.ceil - .3) / 2, z, (r() - .5) * .1);
          add(boxG(.26, .14, .4), mats.wood, x, zn.ceil - .36, z + sgn * .1);
        }
      }
    }
  }
  // ---------- door and window frames ----------
  for (const w of map.walls) for (const o of w.open || []) {
    const x = w.axis === 'x' ? o.t : w.at, z = w.axis === 'x' ? w.at : o.t;
    const top = o.type === 'window' ? WIN_TOP : DOOR_TOP, bot = o.type === 'window' ? SILL : 0;
    for (const s of [-1, 1]) {
      const nx = w.axis === 'z' ? s : 0, nz = w.axis === 'x' ? s : 0;
      if (!indoor(x + nx * .5, z + nz * .5)) continue;
      const fx = x + nx * (WALL_T / 2 + .02), fz = z + nz * (WALL_T / 2 + .02);
      const ax = w.axis === 'x' ? 1 : 0, az = w.axis === 'x' ? 0 : 1, half = o.w / 2 + .06;
      const mat = o.type === 'window' ? mats.trimPale : mats.trim;
      for (const e of [-1, 1]) add(boxG(ax ? .1 : .05, top - bot, az ? .1 : .05), mat, fx + ax * e * half, (top + bot) / 2, fz + az * e * half);
      add(boxG(ax ? o.w + .32 : .05, .1, az ? o.w + .32 : .05), mat, fx, top + .05, fz);
      if (o.type === 'window') add(boxG(ax ? o.w + .3 : .14, .05, az ? o.w + .3 : .14), mat, fx + nx * .04, bot, fz + nz * .04);
    }
  }

  // ---------- ceilings and floors, room by room ----------
  for (const zn of map.zones) for (const rc of zn.rects) {
    const area = (rc[2] - rc[0]) * (rc[3] - rc[1]), th = THEMES[map.id + ':' + zn.id];
    const rp = () => [rc[0] + .7 + r() * (rc[2] - rc[0] - 1.4), rc[1] + .7 + r() * (rc[3] - rc[1] - 1.4)];
    if (zn.ceil) {
      // holes where ceiling panels fell, with the debris below; cables hanging out
      for (let i = 0; i < Math.round(area / 45); i++) {
        const [x, z] = rp();
        const hole = new THREE.PlaneGeometry(.6 + r() * .5, .6 + r() * .5); hole.rotateX(Math.PI / 2);
        add(hole, mats.hole, x, zn.ceil - .02, z);
        if (clear(x, z)) for (let k = 0; k < 3; k++) add(boxG(.3 + r() * .3, .03, .25 + r() * .3), M.board || mats.wood, x + (r() - .5) * .8, .03, z + (r() - .5) * .8, r() * 3);
        for (let k = 0; k < 2; k++) { const L = .4 + r() * 1.1; add(boxG(.015, L, .015), mats.cable, x + (r() - .5) * .4, zn.ceil - L / 2, z + (r() - .5) * .4, 0, (r() - .5) * .2, (r() - .5) * .2); }
      }
    }
    // papers, broken glass, bottles, and blood dragged across the floor
    const nPaper = Math.round(area / (th === 'reception' || th === 'study' || th === 'library' ? 6 : map.underground ? 30 : 14));
    for (let i = 0; i < nPaper; i++) { const [x, z] = rp(); onFloor(.2, .27, x, z, mats.paper[i % 3], r() * 6, .025 + i * .0004); }
    for (let i = 0; i < Math.round(area / 30); i++) {
      const [x, z] = rp();
      for (let k = 0; k < 5; k++) onFloor(.05 + r() * .08, .04 + r() * .08, x + (r() - .5) * .6, z + (r() - .5) * .6, mats.glass, r() * 6, .028);
    }
    if (zn.ceil) for (let i = 0; i < Math.round(area / 50); i++) {
      const [x, z] = rp(); if (!clear(x, z)) continue;
      const b = new THREE.CylinderGeometry(.03, .035, .22, 6); b.rotateZ(Math.PI / 2);
      add(b, mats.glass, x, .035, z, r() * 6);
    }
    for (let i = 0; i < Math.round(area / 60); i++) {
      const [x, z] = rp(), a = r() * 6, L = 2 + r() * 3;
      for (let k = 0; k < 6; k++) onFloor(.35, .55, x + Math.cos(a) * k * L / 6, z + Math.sin(a) * k * L / 6, mats.blood[k % 3], a + Math.PI / 2, .031 + k * .0003);
    }
  }

  // ---------- things that belong to each room, against the walls ----------
  const spots = [];
  for (const R of runs) {
    if (!R.th || R.len < 1.6) continue;
    const along = R.w.axis === 'x' ? [1, 0] : [0, 1];
    for (let t = -R.len / 2 + .8; t < R.len / 2 - .6; t += 1.4 + r() * 1.6) {
      const x = R.fx + along[0] * t + R.nx * .35, z = R.fz + along[1] * t + R.nz * .35;
      if (clear(x, z, .2)) spots.push({ x, z, nx: R.nx, nz: R.nz, th: R.th, ax: along });
    }
  }
  for (const s of spots) {
    if (r() < .3) continue;
    const ry = Math.atan2(s.nx, s.nz), { x, z } = s;
    switch (s.th) {
      case 'ward': {
        if (r() < .5) {   // drip stand with an empty bag
          add(boxG(.03, 1.9, .03), mats.pipe, x, .95, z);
          add(boxG(.5, .03, .03), mats.pipe, x, .02, z, ry); add(boxG(.03, .03, .5), mats.pipe, x, .02, z, ry);
          add(boxG(.14, .22, .04), mats.glass, x + .05, 1.7, z, ry);
        } else {   // a folding screen with torn curtains
          for (let k = -1; k <= 1; k++) {
            const px = x + s.ax[0] * k * .6, pz = z + s.ax[1] * k * .6;
            add(boxG(.03, 1.7, .03), mats.pipe, px, .85, pz);
            if (k < 1 && r() < .8) { const c = add(boxG(s.ax[0] ? .58 : .02, 1.3 - r() * .4, s.ax[1] ? .58 : .02), mats.sheet, px + s.ax[0] * .3, 1.0, pz + s.ax[1] * .3); c.rotation.y = (r() - .5) * .3; }
          }
        }
        break;
      }
      case 'morgue': {
        if (r() < .6) {   // a body bag on the floor along the wall
          const g = new THREE.CylinderGeometry(.2, .22, 1.75, 8); g.rotateZ(Math.PI / 2); g.scale(1, .55, 1);
          add(g, mats.bag, x, .11, z, ry + Math.PI / 2);
        } else {   // a column of cold-storage doors
          for (let k = 0; k < 3; k++) add(boxG(s.ax[0] ? .6 : .04, .55, s.ax[1] ? .6 : .04), mats.trimPale, x - s.nx * .33, .5 + k * .62, z - s.nz * .33);
        }
        break;
      }
      case 'boiler': {   // tool rack or a stack of old drums
        if (r() < .5) { const d = new THREE.CylinderGeometry(.28, .28, .85, 10); add(d, mats.rust, x, .43, z); }
        else { for (let k = 0; k < 3; k++) add(boxG(.06, .5, .02), mats.dark, x + s.ax[0] * (k - 1) * .2 - s.nx * .3, 1.4, z + s.ax[1] * (k - 1) * .2 - s.nz * .3, 0, 0, (r() - .5) * .3); }
        break;
      }
      case 'surgery': {   // a tray of instruments on a stand
        add(boxG(.03, .9, .03), mats.pipe, x, .45, z);
        add(boxG(.5, .03, .35), mats.pipe, x, .92, z, ry);
        for (let k = 0; k < 4; k++) add(boxG(.02, .01, .14), mats.pipe, x + (r() - .5) * .3, .945, z + (r() - .5) * .2, r() * 3);
        break;
      }
      case 'hall': case 'dining': case 'library': case 'study': {
        if (r() < .5) {   // a candelabrum on a small table, the candles burnt down, one still lit
          add(boxG(.45, .7, .45), mats.wood, x, .35, z);
          add(boxG(.03, .3, .03), mats.pipe, x, .85, z);
          for (let k = -1; k <= 1; k++) add(boxG(.025, .12 + r() * .06, .025), mats.sheet, x + s.ax[0] * k * .1, 1.04, z + s.ax[1] * k * .1);
          if (r() < .4) { const f = new THREE.Sprite(mats.flame); f.scale.set(.12, .18, 1); f.position.set(x, 1.15, z); group.add(f); }
        } else {   // books pulled off the shelves
          for (let k = 0; k < 4; k++) add(boxG(.18, .04, .25), k % 2 ? mats.trim : mats.wood, x + (r() - .5) * .6, .02 + k * .002, z + (r() - .5) * .6, r() * 3);
        }
        break;
      }
      case 'lamproom': case 'tunnel': case 'stope': {
        const k = r();
        if (k < .35) {   // a dropped pick
          add(boxG(.04, .04, .85), mats.wood, x, .03, z, r() * 6);
          add(boxG(.5, .05, .06), mats.pipe, x + (r() - .5) * .2, .05, z + (r() - .5) * .2, r() * 6);
        } else if (k < .6) {   // a miner's helmet, upside down
          const h = new THREE.SphereGeometry(.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); h.rotateX(Math.PI);
          add(h, lam(null, { color: 0x5a5a40 }), x, .15, z);
        } else {   // fallen rock
          for (let n = 0; n < 4 + (r() * 4 | 0); n++) add(new THREE.DodecahedronGeometry(.1 + r() * .2, 0), M.rock || mats.dark, x + (r() - .5) * .8, .08 + r() * .1, z + (r() - .5) * .8, r() * 3, r() * 3);
        }
        break;
      }
      case 'magazine': {   // small crates of blasting caps
        add(boxG(.5, .3, .35), M.crate || mats.wood, x, .15, z, ry + (r() - .5) * .3);
        if (r() < .5) add(boxG(.4, .25, .3), M.crate || mats.wood, x, .42, z, ry + (r() - .5) * .5);
        break;
      }
      case 'kitchen': {   // pots and broken plates
        for (let k = 0; k < 3; k++) { const p = new THREE.CylinderGeometry(.12, .1, .14, 8); add(p, mats.pipe, x + (r() - .5) * .5, .07, z + (r() - .5) * .5); }
        for (let k = 0; k < 4; k++) onFloor(.12, .1, x + (r() - .5) * .7, z + (r() - .5) * .7, mats.sheet, r() * 6, .03);
        break;
      }
      case 'bunker': {
        if (r() < .6) {   // sandbags piled against the wall
          for (let k = 0; k < 5; k++) {
            const g = new THREE.BoxGeometry(.55, .17, .3); const row = k < 3 ? 0 : 1;
            add(g, mats.sand, x + s.ax[0] * ((k % 3) - 1 + row * .5) * .55 - s.nx * .12, .09 + row * .17, z + s.ax[1] * ((k % 3) - 1 + row * .5) * .55 - s.nz * .12, ry + (r() - .5) * .15);
          }
        } else {   // ammunition boxes
          add(boxG(.45, .22, .25), M.crate || mats.wood, x, .11, z, ry); add(boxG(.45, .22, .25), M.crate || mats.wood, x, .33, z, ry + .2);
        }
        break;
      }
      case 'garage': {   // oil drum and a tyre
        add(new THREE.CylinderGeometry(.28, .28, .85, 10), mats.rust, x, .43, z);
        const ty = new THREE.TorusGeometry(.3, .1, 5, 10); ty.rotateX(Math.PI / 2); add(ty, mats.dark, x + s.ax[0] * .7, .1, z + s.ax[1] * .7);
        break;
      }
      case 'reception': {   // a toppled chair or a waste bin
        if (r() < .5) { add(boxG(.45, .05, .45), mats.wood, x, .25, z, ry, 0, 1.3); add(boxG(.45, .45, .05), mats.wood, x + .1, .2, z, ry, 1.2); }
        else add(new THREE.CylinderGeometry(.16, .13, .4, 8), mats.dark, x, .2, z);
        break;
      }
    }
  }
  // the operating lamp above each table
  for (const p of map.props || []) if (p.kind === 'optable') {
    const zn = indoor(p.x, p.z); if (!zn) continue;
    add(boxG(.04, zn.ceil - 2.3, .04), mats.pipe, p.x, (zn.ceil + 2.3) / 2, p.z);
    const lampG = new THREE.CylinderGeometry(.18, .38, .2, 10); add(lampG, mats.trimPale, p.x, 2.25, p.z);
  }
  return group;
}
