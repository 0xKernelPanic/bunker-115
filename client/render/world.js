// Builds the 3D scene of a map from shared map data, and animates its state
// (doors, boards, items, power, blackouts, traps).
import * as THREE from 'three';
import { lam } from './psx.js';
import { wallPieces, SILL, WIN_TOP } from '../../shared/world.js';
import { WEAPONS } from '../../shared/weapons.js';
import { QUEST_KINDS } from '../../shared/interact.js';
import { R, rng } from '../../shared/util.js';
import { signTex, bloodTex } from './textures.js';
import { dressWorld } from './dressing.js';
import { buildGun } from './guns.js';

function worldUV(geo, s) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u / s, v / s);
  }
  uv.needsUpdate = true;
}
// one vertex per metre so the per-vertex flashlight reads as a pool of light
const seg = v => Math.max(1, Math.ceil(v / 1.0));
const glowSprite = (map, scale, opacity = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.set(scale, scale, 1); return s;
};

export function buildWorldView(scene, world, TX, GMw) {
  const map = world.map;
  const solids = [];
  const M = {
    brick: lam(TX.brick), plaster: lam(TX.plaster), concrete: lam(TX.concrete), stone: lam(TX.stone), wallpaper: lam(TX.wallpaper), books: lam(TX.books), paint: lam(TX.paint),
    planks: lam(TX.floor), tiles: lam(TX.tiles), ground: lam(TX.grass), ceil: lam(TX.ceil), outside: lam(TX.ground),
    board: lam(TX.board), crate: lam(TX.crate), metal: lam(TX.metal), dark: lam(TX.metalDark), rust: lam(TX.rust), bark: lam(TX.bark),
    sandbag: lam(TX.sandbag), sheet: lam(TX.sheet), wood: lam(TX.gwood), stoneP: lam(TX.stone),
    rock: lam(TX.rock), gravel: lam(TX.gravel)
  };
  const under = !!map.underground;
  const box = (w, h, d, x, y, z, mat, opt = {}) => {
    const g = new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d));
    g.translate(x, y, z);
    if (opt.uv !== false) worldUV(g, opt.uvScale || 2);
    const m = new THREE.Mesh(g, mat);
    if (opt.dynamic) m.userData.dynamic = true;
    scene.add(m);
    if (opt.solid !== false) solids.push(m);
    return m;
  };
  const plane = (w, d, x, y, z, mat, down, s) => {
    const g = new THREE.PlaneGeometry(w, d, seg(w), seg(d));
    g.rotateX(down ? Math.PI / 2 : -Math.PI / 2); g.translate(x, y, z); worldUV(g, s);
    const m = new THREE.Mesh(g, mat); scene.add(m); return m;
  };

  // ground, floors, ceilings
  // the open ground sits a little below the floors so the two never fight where they overlap
  { const g = new THREE.PlaneGeometry(200, 200, 40, 40); g.rotateX(-Math.PI / 2); g.translate(0, -.06, 0); worldUV(g, 4); scene.add(new THREE.Mesh(g, under ? M.rock : M.outside)); }
  for (const zn of map.zones) for (const r of zn.rects) {
    // exactly the zone: neighbouring floors meet under the walls instead of overlapping in doorways
    const w = r[2] - r[0], d = r[3] - r[1], cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
    plane(w, d, cx, .02, cz, M[zn.floor] || M.planks, false, zn.floor === 'ground' ? 4 : 3);
    if (zn.ceil) {
      plane(w, d, cx, zn.ceil, cz, under ? M.rock : M.ceil, true, 3);
      const span = r[2] - r[0], beams = Math.floor(span / (under ? 3 : 4));
      for (let i = 1; i <= beams; i++) box(.28, .3, d - .3, r[0] + i * span / (beams + 1), zn.ceil - .17, cz, under ? M.wood : M.ceil, { solid: false });
    }
  }
  // blood pools scattered on the floors, never repeating with the floor texture
  {
    const mats = [0, 1, 2, 3].map(i => lam(bloodTex(i + 1), { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    const r = rng(map.id.length * 31 + 5);
    let k = 0;
    for (const zn of map.zones) for (const rc of zn.rects) {
      const n = Math.round((rc[2] - rc[0]) * (rc[3] - rc[1]) / 14);
      for (let i = 0; i < n; i++) {
        const sz = .6 + r() * 1.4, g = new THREE.PlaneGeometry(sz, sz);
        g.rotateX(-Math.PI / 2); g.rotateY(r() * 6.28);
        const m = new THREE.Mesh(g, mats[k++ % 4]);
        m.position.set(rc[0] + .5 + r() * (rc[2] - rc[0] - 1), .03 + (k % 7) * .001, rc[1] + .5 + r() * (rc[3] - rc[1] - 1));
        scene.add(m);
      }
    }
  }
  // walls
  for (const w of map.walls) for (const p of wallPieces(w, map.walls)) box(p.sx, p.sy, p.sz, p.cx, p.cy, p.cz, M[w.mat] || M.brick);

  // windows: six boards each
  const planks = {};
  for (const w of world.windows) {
    planks[w.id] = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w.w + .3, .19, .06), M.board);
      p.position.set(w.x - w.nx * .2, SILL + .12 + i * (WIN_TOP - SILL - .1) / 6, w.z - w.nz * .2);
      p.rotation.y = w.nx !== 0 ? Math.PI / 2 : 0; p.rotation.z = R(-.2, .2);
      p.userData.pop = 0; p.userData.home = p.position.clone(); p.userData.dynamic = true;
      scene.add(p); planks[w.id].push(p);
    }
  }
  // doors: plank barricades (or a chained iron gate for the exit) with a sign
  const doors = {};
  for (const id in world.doors) {
    const d = world.doors[id], meshes = [];
    const alongX = d.axis === 'x';
    const iron = d.exit && !d.rubble;
    const base = box(alongX ? d.w : .2, 2.55, alongX ? .2 : d.w, d.x, 1.275, d.z, d.rubble ? M.rock : iron ? M.rust : M.board, { uv: iron || d.rubble, dynamic: true });
    meshes.push(base);
    // a rockfall filling the drift: loose boulders heaped against it on both sides
    if (d.rubble) {
      const rr = rng(Math.round(d.x * 3 + d.z * 7));
      for (let i = 0; i < 26; i++) {
        const s0 = .25 + rr() * .55, m = new THREE.Mesh(new THREE.DodecahedronGeometry(s0, 0), M.rock);
        const side = rr() < .5 ? -1 : 1, along = (rr() - .5) * (d.w + .6), up = rr() * 2.2 * (1 - Math.abs(along) / (d.w + .6));
        m.position.set(d.x + (alongX ? along : side * (.25 + rr() * .5)), s0 * .6 + up, d.z + (alongX ? side * (.25 + rr() * .5) : along));
        m.rotation.set(rr() * 3, rr() * 3, rr() * 3); scene.add(m); meshes.push(m);
      }
    }
    for (let i = 0; i < (d.rubble ? 0 : 4); i++) for (const side of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(alongX ? d.w + .4 : .08, iron ? .08 : .22, alongX ? .08 : d.w + .4), iron ? M.dark : M.board);
      p.position.set(d.x + (alongX ? 0 : side * .16), .5 + i * .58, d.z + (alongX ? side * .16 : 0));
      if (!iron) { if (alongX) p.rotation.z = R(-.25, .25); else p.rotation.x = R(-.25, .25); }
      scene.add(p); meshes.push(p);
    }
    const price = d.cost ? String(d.cost) : d.key ? 'LOCKED' : '';
    for (const side of (d.rubble ? [] : [-1, 1])) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .45), new THREE.MeshBasicMaterial({ map: signTex((d.label || 'DOOR').toUpperCase(), price), transparent: true }));
      s.position.set(d.x + (alongX ? 0 : side * .3), 1.9, d.z + (alongX ? side * .3 : 0));
      s.rotation.y = alongX ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      scene.add(s); meshes.push(s);
    }
    meshes.forEach(m => { m.userData.y0 = m.position.y; m.userData.dynamic = true; });
    doors[id] = { meshes, open: false, t: 0, base, rubble: !!d.rubble };
  }
  // wall buys
  for (const wb of map.wallBuys || []) {
    const m = buildGun(wb.w, GMw); m.scale.setScalar(1.5);
    m.position.set(wb.x + wb.nx * .06, wb.y, wb.z + wb.nz * .06); m.rotation.y = Math.atan2(wb.nx, wb.nz) + Math.PI / 2; scene.add(m);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .45), new THREE.MeshBasicMaterial({ map: signTex(WEAPONS[wb.w].name.toUpperCase(), String(wb.cost)), transparent: true }));
    s.position.set(wb.x + wb.nx * .02, wb.y - .45, wb.z + wb.nz * .02); s.rotation.y = Math.atan2(wb.nx, wb.nz); scene.add(s);
  }
  // fuse box with three empty sockets
  let fuseV = null;
  if (map.fusebox) {
    const f = map.fusebox, grp = new THREE.Group(); grp.position.set(f.x, 1.45, f.z); grp.rotation.y = Math.atan2(f.nx, f.nz); scene.add(grp);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(.7, .9, .14), [M.dark, M.dark, M.dark, M.dark, lam(TX.powerPanel), M.dark]); grp.add(panel);
    const sockets = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .14, 6), lam(TX.items.fuse)); s.rotation.z = Math.PI / 2;
      s.position.set(-.18 + i * .18, -.28, .1); s.visible = false; grp.add(s); sockets.push(s);
    }
    const lamp = glowSprite(TX.glowWhite, .25, .9); lamp.material.color.setHex(0xff2010); lamp.position.set(.25, .35, .1); grp.add(lamp);
    fuseV = { sockets, lamp };
  }
  // radio on the reception desk
  let radioV = null;
  if (map.radio) {
    const r = map.radio, grp = new THREE.Group(); grp.position.set(r.x, r.y, r.z); grp.rotation.y = Math.atan2(r.nx, r.nz); scene.add(grp);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.5, .3, .25), M.wood); body.position.y = .15; grp.add(body);
    const dial = new THREE.Mesh(new THREE.BoxGeometry(.3, .12, .02), lam(null, { color: 0x302a20 })); dial.position.set(-.05, .18, .13); grp.add(dial);
    const ant = new THREE.Mesh(new THREE.BoxGeometry(.01, .5, .01), M.metal); ant.position.set(.2, .5, -.05); ant.rotation.z = -.3; grp.add(ant);
    const lamp = glowSprite(TX.glowWhite, .18, 0); lamp.material.color.setHex(0xffa040); lamp.position.set(-.05, .18, .15); grp.add(lamp);
    radioV = { lamp };
  }
  // traps: switch panel + crackling sparks in the area
  const trapsV = {};
  for (const tr of map.traps || []) {
    const pnl = new THREE.Mesh(new THREE.BoxGeometry(.5, .6, .1), [M.dark, M.dark, M.dark, M.dark, lam(TX.trapPanel), M.dark]);
    pnl.position.set(tr.sx, 1.4, tr.sz); pnl.rotation.y = Math.atan2(tr.snx, tr.snz); scene.add(pnl);
    const [x0, z0, x1, z1] = tr.area, sparks = [];
    for (let i = 0; i < 10; i++) { const s = glowSprite(TX.glowBlue, R(.4, 1.0), .9); s.visible = false; s.userData.base = [R(x0, x1), R(.2, 2.6), R(z0, z1)]; scene.add(s); sparks.push(s); }
    for (const x of [x0, x1]) for (const z of [z0 + .05, z1 - .05]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.08, 2.8, .08), M.metal); post.position.set(x, 1.4, z); scene.add(post); }
    const wires = [];
    for (let k = 0; k < 4; k++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0, .5 + k * .6, z0 + .05), new THREE.Vector3(x0, .5 + k * .6, z1 - .05)]);
      const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x8fd8ff })); l.visible = false; scene.add(l); wires.push(l);
      const l2 = l.clone(); l2.position.x = x1 - x0; scene.add(l2); wires.push(l2);
    }
    trapsV[tr.id] = { sparks, wires };
  }
  // props
  let carV = null;
  const waters = [], tanks = [];
  for (const p of map.props || []) {
    const sw = p.rot ? p.d : p.w, sd = p.rot ? p.w : p.d;
    switch (p.kind) {
      case 'crate': box(sw, p.h, sd, p.x, p.h / 2, p.z, M.crate, { uv: false }); break;
      case 'desk': box(sw, .08, sd, p.x, p.h - .04, p.z, M.wood); box(sw, p.h - .08, .06, p.x, (p.h - .08) / 2, p.z + sd / 2 - .03, M.wood); break;
      case 'bench': box(sw, .08, sd, p.x, p.h, p.z, M.wood); box(.08, p.h, sd, p.x - sw / 2 + .1, p.h / 2, p.z, M.wood, { solid: false }); box(.08, p.h, sd, p.x + sw / 2 - .1, p.h / 2, p.z, M.wood, { solid: false }); break;
      case 'cabinet': box(sw, p.h, sd, p.x, p.h / 2, p.z, M.rust); break;
      case 'drawers': box(sw, p.h, sd, p.x, p.h / 2, p.z, M.metal); for (let i = 0; i < 3; i++) box(.02, .5, sd - .2, p.x + sw / 2, .5 + i * .6, p.z, M.dark, { solid: false }); break;
      case 'wheelchair': box(.6, .08, .6, p.x, .5, p.z, M.sheet); box(.6, .6, .08, p.x, .8, p.z - .3, M.sheet); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .04, 10), M.dark); w.rotation.z = Math.PI / 2; w.position.set(p.x + s * .33, .3, p.z); scene.add(w); } break;
      case 'slab': box(sw, .12, sd, p.x, p.h, p.z, M.metal); box(.3, p.h, .3, p.x, p.h / 2, p.z, M.dark); box(sw * .7, .18, sd * .8, p.x, p.h + .14, p.z, M.sheet, { solid: false }); break;
      case 'bed': box(sw, .15, sd, p.x, p.h - .1, p.z, M.sheet); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(.05, p.h - .1, .05, p.x + dx * (sw / 2 - .05), (p.h - .1) / 2, p.z + dz * (sd / 2 - .05), M.metal, { solid: false }); break;
      case 'optable': box(sw, .1, sd, p.x, p.h, p.z, M.metal); box(.4, p.h, .4, p.x, p.h / 2, p.z, M.dark); box(sw * .9, .06, sd * .8, p.x, p.h + .08, p.z, M.sheet, { solid: false }); break;
      case 'cart': box(sw, .06, sd, p.x, p.h, p.z, M.metal); box(sw, .06, sd, p.x, .3, p.z, M.metal, { solid: false }); break;
      case 'boiler': { const c = new THREE.Mesh(new THREE.CylinderGeometry(sw / 2, sw / 2, p.h, 12, 3), M.rust); c.position.set(p.x, p.h / 2, p.z); scene.add(c); solids.push(c); const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, 3.4 - p.h, 6), M.metal); pipe.position.set(p.x, p.h + (3.4 - p.h) / 2, p.z); scene.add(pipe); break; }
      case 'fountain': { const c = new THREE.Mesh(new THREE.CylinderGeometry(sw / 2, sw / 2 + .1, p.h, 12, 1), M.stoneP); c.position.set(p.x, p.h / 2, p.z); scene.add(c); solids.push(c); const s = new THREE.Mesh(new THREE.CylinderGeometry(.18, .25, 1.6, 8), M.stoneP); s.position.set(p.x, 1.2, p.z); scene.add(s); break; }
      case 'tree': tree(scene, M, p.x, p.z); break;
      case 'grave': { const c = new THREE.Mesh(new THREE.BoxGeometry(.1, 1, .1), M.bark); c.position.set(p.x, .5, p.z); c.rotation.z = R(-.2, .2); const h = new THREE.Mesh(new THREE.BoxGeometry(.5, .1, .1), M.bark); h.position.set(p.x, .75, p.z); scene.add(c, h); const mound = new THREE.Mesh(new THREE.BoxGeometry(.7, .15, 1.4), M.outside); mound.position.set(p.x, .07, p.z + .8); scene.add(mound); break; }
      case 'piano': box(sw, p.h, sd, p.x, p.h / 2, p.z, M.wood); box(sw * .9, .06, .2, p.x, p.h * .72, p.z + sd / 2 + .08, M.sheet, { solid: false }); break;
      case 'table': box(sw, .08, sd, p.x, p.h - .04, p.z, M.wood); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(.08, p.h - .08, .08, p.x + dx * (sw / 2 - .1), (p.h - .08) / 2, p.z + dz * (sd / 2 - .1), M.wood, { solid: false }); break;
      case 'rug': { const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sd), lam(TX.rug, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })); m.rotation.x = -Math.PI / 2; m.position.set(p.x, .03, p.z); scene.add(m); break; }
      case 'armchair': box(sw, .45, sd, p.x, .225, p.z, M.paint, { uv: false }); box(sw, .5, .15, p.x, .7, p.z - sd / 2 + .08, M.paint, { uv: false }); break;
      case 'clock': box(sw, p.h, sd, p.x, p.h / 2, p.z, M.wood); { const f = new THREE.Mesh(new THREE.CircleGeometry(.2, 10), lam(null, { color: 0xd8d0b0 })); f.position.set(p.x, p.h - .45, p.z + sd / 2 + .01); scene.add(f); } break;
      case 'chair': box(sw, .06, sd, p.x, .48, p.z, M.wood, { solid: false }); box(sw, .5, .05, p.x, .75, p.z + (p.z > 0 ? .22 : -.22), M.wood, { solid: false }); break;
      case 'shelf': box(sw, p.h, sd, p.x, p.h / 2, p.z, M.books, { uvScale: 1.4 }); break;
      case 'counter': box(sw, p.h - .05, sd, p.x, (p.h - .05) / 2, p.z, M.wood); box(sw + .04, .05, sd + .04, p.x, p.h - .025, p.z, M.metal); break;
      case 'stove': box(sw, p.h, sd, p.x, p.h / 2, p.z, M.dark); break;
      case 'car': {
        const body = box(sw, .7, sd, p.x, .55, p.z, M.paint, { uv: false, dynamic: true });
        box(sw * .92, .55, sd * .48, p.x, 1.17, p.z + sd * .08, M.paint, { uv: false });
        box(sw * .94, .42, .04, p.x, 1.18, p.z - sd * .17, lam(null, { color: 0x1a2028 }), { solid: false });
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .25, 10), M.dark); w.rotation.z = Math.PI / 2; w.position.set(p.x + dx * (sw / 2 - .05), .34, p.z + dz * (sd / 2 - .7)); scene.add(w); }
        const lights = [];
        for (const dx of [-.6, .6]) { const l = glowSprite(TX.glowWhite, .9, 0); l.material.color.setHex(0xfff0c0); l.position.set(p.x + dx, .65, p.z - sd / 2 - .05); scene.add(l); lights.push(l); }
        carV = { body, lights, x: p.x, z: p.z, base: [] };
        break;
      }
      // the mine
      case 'timber': for (const s2 of [-1, 1]) box(.22, p.h, .22, p.x + (p.rot ? 0 : s2 * sw / 2), p.h / 2, p.z + (p.rot ? s2 * sd / 2 : 0), M.wood, { solid: false }); box(p.rot ? .24 : sw + .2, .24, p.rot ? sd + .2 : .24, p.x, p.h - .12, p.z, M.wood, { solid: false }); break;
      case 'rails': {
        const along = sw >= sd, L = along ? sw : sd;
        for (const off of [-.36, .36]) box(along ? L : .06, .07, along ? .06 : L, p.x + (along ? 0 : off), .05, p.z + (along ? off : 0), M.rust, { solid: false, uv: false });
        for (let t = -L / 2 + .3; t < L / 2; t += .75) box(along ? .18 : 1.0, .05, along ? 1.0 : .18, p.x + (along ? t : 0), .025, p.z + (along ? 0 : t), M.wood, { solid: false });
        break;
      }
      case 'minecart': {
        box(sw, p.h * .55, sd, p.x, p.h * .55 / 2 + .25, p.z, M.rust, { uv: false });
        box(sw * .92, .08, sd * .85, p.x, p.h * .55 + .2, p.z, lam(null, { color: 0x1c1a18 }), { solid: false });
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .08, 8), M.dark); w.rotation.x = Math.PI / 2; w.position.set(p.x + dx * (sw / 2 - .3), .17, p.z + dz * (sd / 2 + .02)); scene.add(w); }
        // a heap of ore in the cart
        for (let k = 0; k < 6; k++) { const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(.12 + R(0, .1), 0), M.rock); ore.position.set(p.x + R(-sw / 3, sw / 3), p.h * .55 + .25 + R(0, .1), p.z + R(-sd / 4, sd / 4)); scene.add(ore); }
        break;
      }
      case 'pump': {
        box(sw, p.h * .6, sd, p.x, p.h * .3, p.z, M.rust);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(sd * .32, sd * .32, sw * .9, 10), M.dark); c.rotation.z = Math.PI / 2; c.position.set(p.x, p.h * .75, p.z); scene.add(c);
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 3.4 - p.h * .6, 6), M.metal); pipe.position.set(p.x + sw * .3, p.h * .6 + (3.4 - p.h * .6) / 2, p.z); scene.add(pipe);
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(.35, .05, 4, 12), M.dark); wheel.position.set(p.x - sw / 2 - .05, p.h * .5, p.z); wheel.rotation.y = Math.PI / 2; scene.add(wheel);
        break;
      }
      case 'barrels': {
        const n = Math.max(2, Math.round(sw / .65));
        for (let k = 0; k < n; k++) {
          const b = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, p.h, 10), lam(null, { color: 0x3e4a2a })); b.position.set(p.x - sw / 2 + .32 + k * (sw - .64) / (n - 1), p.h / 2, p.z); scene.add(b);
          const band = new THREE.Mesh(new THREE.CylinderGeometry(.305, .305, .06, 10), M.dark); band.position.set(b.position.x, p.h * .7, p.z); scene.add(band);
          const mark = new THREE.Mesh(new THREE.PlaneGeometry(.3, .18), new THREE.MeshBasicMaterial({ map: signTex('115', ''), transparent: true })); mark.position.set(b.position.x, p.h * .45, p.z + .305); scene.add(mark);
          // something green has leaked out under them
          if (k === 1) { const pool = new THREE.Mesh(new THREE.CircleGeometry(.6, 10), lam(null, { color: 0x3a5a18, emissive: 0x0c1a04, transparent: true, opacity: .8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })); pool.rotation.x = -Math.PI / 2; pool.position.set(b.position.x + .2, .035, p.z + .5); scene.add(pool); }
        }
        break;
      }
      case 'lamprack': {
        box(sw, p.h, sd, p.x, p.h / 2, p.z, M.wood, { solid: true });
        for (let k = 0; k < 12; k++) { const lampM = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .2, 6), k % 3 ? M.dark : M.metal); lampM.position.set(p.x - sw / 2 + .2 + (k % 6) * (sw - .4) / 5, .7 + Math.floor(k / 6) * .6, p.z + sd / 2 + .06); scene.add(lampM); }
        break;
      }
      case 'water': {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sd, 4, 4), lam(null, { color: 0x0a1418, emissive: 0x020608, transparent: true, opacity: .8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
        m.rotation.x = -Math.PI / 2; m.position.set(p.x, .04, p.z); scene.add(m); waters.push(m);
        break;
      }
      // a serum tank: a riveted drum on a plinth, a sight glass showing the green inside, the drain
      // valve facing where you stand to open it, and a pipe up into the roof
      case 'tank': {
        const r = Math.min(sw, sd) / 2, sp = (map.spots || []).find(q => q.id === p.spot);
        const dx = sp ? sp.x - p.x : 0, dz = sp ? sp.z - p.z : -1, dl = Math.hypot(dx, dz) || 1, fx = dx / dl, fz = dz / dl, face = Math.atan2(fx, fz);
        box(sw * .9, .25, sd * .9, p.x, .125, p.z, M.concrete);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, p.h - .25, 14, 3), M.metal); c.position.set(p.x, .25 + (p.h - .25) / 2, p.z); scene.add(c); solids.push(c);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 4, 0, Math.PI * 2, 0, Math.PI / 2), M.metal); dome.scale.y = .35; dome.position.set(p.x, p.h, p.z); scene.add(dome);
        for (const y of [.6, p.h * .55, p.h - .2]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(r + .02, r + .02, .07, 14), M.dark); band.position.set(p.x, y, p.z); scene.add(band); }
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 6, 6), M.rust); pipe.position.set(p.x, p.h + 3, p.z); scene.add(pipe);
        const glassMat = lam(null, { color: 0x5aa020, emissive: 0x2a6010 });
        const glass = new THREE.Mesh(new THREE.BoxGeometry(.16, p.h * .6, .04), glassMat);
        glass.position.set(p.x + fx * (r + .02) - fz * r * .45, .3 + p.h * .4, p.z + fz * (r + .02) + fx * r * .45); glass.rotation.y = face; glass.userData.dynamic = true; scene.add(glass);
        const mark = new THREE.Mesh(new THREE.PlaneGeometry(.7, .32), new THREE.MeshBasicMaterial({ map: signTex('SERUM 115', 'MINISTRY PROPERTY'), transparent: true }));
        mark.position.set(p.x + fx * (r + .03) + fz * r * .25, p.h * .6, p.z + fz * (r + .03) - fx * r * .25); mark.rotation.y = face; scene.add(mark);
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(.18, .035, 4, 10), M.dark); wheel.position.set(p.x + fx * (r + .12), .75, p.z + fz * (r + .12)); wheel.rotation.y = face; wheel.userData.dynamic = true; scene.add(wheel);
        const spout = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .25, 6), M.dark); spout.rotation.x = Math.PI / 2; spout.rotation.y = face; spout.position.set(p.x + fx * (r + .08), .45, p.z + fz * (r + .08)); scene.add(spout);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 12), lam(null, { color: 0x3a5a18, emissive: 0x0c1a04, transparent: true, opacity: .85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
        pool.rotation.x = -Math.PI / 2; pool.position.set(p.x + fx * (r + .7), .036, p.z + fz * (r + .7)); pool.scale.setScalar(.01); pool.visible = false; pool.userData.dynamic = true; scene.add(pool);
        tanks.push({ i: map.objectives.findIndex(o => o.spot === p.spot), glass, glassMat, wheel, pool, drain: 0 });
        break;
      }
      // a run of pipe along a wall, at height h
      case 'pipe': {
        const along = p.w >= p.d, len = along ? p.w : p.d;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, len, 6), M.rust); m.rotation.z = along ? Math.PI / 2 : 0; m.rotation.x = along ? 0 : Math.PI / 2;
        m.position.set(p.x, p.h, p.z); scene.add(m);
        for (let k = 0; k <= Math.floor(len / 3); k++) { const t = -len / 2 + k * 3, f = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .08, 6), M.dark); f.rotation.copy(m.rotation); f.position.set(p.x + (along ? t : 0), p.h, p.z + (along ? 0 : t)); scene.add(f); }
        break;
      }
      case 'debris': { const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), M.board); m.position.set(p.x, .06, p.z); m.rotation.y = R(-1, 1); scene.add(m); break; }
    }
  }
  // set dressing: trims, grime, stains, clutter and room-specific bits
  dressWorld(scene, world, TX, M);
  // outdoor decoration
  const dec = map.decor || {};
  if (dec.trees) {
    const t = dec.trees, ex = t.exclude, r = rng(7);
    for (let i = 0; i < t.n; i++) {
      const a = r() * Math.PI * 2, d = t.rmin + r() * (t.rmax - t.rmin), x = t.cx + Math.cos(a) * d, z = t.cz + Math.sin(a) * d;
      if (x > ex[0] && x < ex[2] && z > ex[1] && z < ex[3]) continue;
      tree(scene, M, x, z);
    }
  }
  for (let i = 0; i < (dec.crosses || 0); i++) {
    const a = R(0, Math.PI * 2), d = R(26, 40), x = (dec.trees ? dec.trees.cx : 0) + Math.cos(a) * d, z = Math.sin(a) * d;
    const v = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.2, .1), M.bark); v.position.set(x, .6, z);
    const h = new THREE.Mesh(new THREE.BoxGeometry(.6, .1, .1), M.bark); h.position.set(x, .9, z);
    v.rotation.z = h.rotation.z = R(-.2, .2); scene.add(v, h);
  }
  {
    if (!under) {
      const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.moon, fog: false, depthWrite: false, transparent: true }));
      moon.position.set(-50, 38, -70); moon.scale.set(14, 14, 1); scene.add(moon);
    }
  }
  // lights
  scene.add(new THREE.AmbientLight(map.ambient || 0x2a3240, 1.0));
  const moonL = new THREE.DirectionalLight(0x5a6c8e, under ? .04 : .3); moonL.position.set(-20, 30, -12); scene.add(moonL);
  // Map lamps share a fixed number of real lights: each frame the slots go to the lamps nearest
  // the camera. The shaders never change, and every vertex is lit by a few lights, not all of them.
  const lights = [], SLOTS = Math.min(5, (map.lights || []).length), slots = [];
  for (let i = 0; i < SLOTS; i++) { const l = new THREE.PointLight(0xffffff, 0, 14, 1.3); scene.add(l); slots.push(l); }
  for (const L of map.lights || []) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(.08, 6, 4), new THREE.MeshBasicMaterial({ color: L.color })); b.position.set(L.x, L.y, L.z); b.userData.dynamic = true; scene.add(b);
    const cord = new THREE.Mesh(new THREE.BoxGeometry(.015, .3, .015), new THREE.MeshBasicMaterial({ color: 0x111111 })); cord.position.set(L.x, L.y + .2, L.z); scene.add(cord);
    // a soft halo in the damp air around the bulb
    const halo = glowSprite(TX.glowWhite, 1.6, .28); halo.material.color.setHex(L.color); halo.position.set(L.x, L.y, L.z); scene.add(halo);
    lights.push({ b, halo, def: L, base: L.int, out: 0, now: 0 });
  }

  // lockers you can hide in; the door swings on a hinge
  const lockers = {};
  const lockerMat = lam(TX.items.locker), lockerBody = lam(TX.rust);
  for (const h of map.hides || []) {
    const grp = new THREE.Group(); grp.position.set(h.x, 0, h.z); grp.rotation.y = Math.atan2(h.nx, h.nz); scene.add(grp);
    const back = new THREE.Mesh(new THREE.BoxGeometry(.75, 2.0, .04), lockerBody); back.position.set(0, 1, -.28); grp.add(back);
    for (const sx of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(.04, 2.0, .6), lockerBody); side.position.set(sx * .355, 1, 0); grp.add(side); solids.push(side); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(.75, .04, .6), lockerBody); top.position.set(0, 2.0, 0); grp.add(top);
    const hinge = new THREE.Group(); hinge.position.set(-.36, 0, .3); grp.add(hinge);
    const door = new THREE.Mesh(new THREE.BoxGeometry(.72, 1.96, .03), lockerMat); door.position.set(.36, 1, 0); hinge.add(door); solids.push(door);
    lockers[h.id] = { hinge, open: 0, hold: 0 };
  }
  // puzzle stashes (safe, tool cabinet, footlocker, bookcase) and their switches (valves, books)
  const puzzlesV = {};
  for (const pz of map.puzzles || []) {
    const st = pz.stash, grp = new THREE.Group(); grp.position.set(st.x, 0, st.z); grp.rotation.y = Math.atan2(st.nx, st.nz); scene.add(grp);
    const add = (geo, mat, x, y, z, parent = grp) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    const v = { grp, kind: st.kind, t: 0, switches: [] };
    if (st.kind === 'safe') {
      add(new THREE.BoxGeometry(.7, 1.0, .56), M.dark, 0, .5, -.02);
      v.hinge = new THREE.Group(); v.hinge.position.set(-.33, 0, .27); grp.add(v.hinge);
      add(new THREE.BoxGeometry(.64, .9, .05), M.metal, .32, .5, 0, v.hinge);
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .04, 12), lam(null, { color: 0xb0a070 })); dial.rotation.x = Math.PI / 2; dial.position.set(.32, .62, .04); v.hinge.add(dial);
      add(new THREE.BoxGeometry(.14, .03, .04), M.dark, .32, .42, .04, v.hinge);
    } else if (st.kind === 'cabinet') {
      add(new THREE.BoxGeometry(.9, 1.9, .5), M.rust, 0, .95, -.03);
      v.hinge = new THREE.Group(); v.hinge.position.set(-.44, 0, .23); grp.add(v.hinge);
      add(new THREE.BoxGeometry(.86, 1.82, .04), M.metal, .43, .95, 0, v.hinge);
      add(new THREE.BoxGeometry(.06, .2, .05), M.dark, .78, 1.0, .04, v.hinge);
      // three pressure gauges on the door; their needles drop when it opens
      for (let k = 0; k < 3; k++) { const g = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .03, 10), lam(null, { color: 0xd8d0b0 })); g.rotation.x = Math.PI / 2; g.position.set(.2 + k * .23, 1.5, .03); v.hinge.add(g); }
    } else if (st.kind === 'footlocker') {
      add(new THREE.BoxGeometry(1.0, .4, .48), lam(null, { color: 0x4a5236 }), 0, .2, 0);
      v.hinge = new THREE.Group(); v.hinge.position.set(0, .4, -.24); grp.add(v.hinge);
      add(new THREE.BoxGeometry(1.02, .1, .5), lam(null, { color: 0x56603e }), 0, .05, .25, v.hinge);
      add(new THREE.BoxGeometry(.12, .12, .04), M.metal, 0, -.05, .51, v.hinge);
    } else if (st.kind === 'shelf') {
      // a dark recess in the wall behind, and the bookcase that slides away from it
      add(new THREE.BoxGeometry(1.2, 2.0, .05), new THREE.MeshBasicMaterial({ color: 0x050403 }), 0, 1.0, -.2);
      v.slide = new THREE.Group(); grp.add(v.slide);
      add(new THREE.BoxGeometry(1.4, 2.4, .42), M.books, 0, 1.2, 0, v.slide);
    }
    (pz.switches || []).forEach(sw => {
      const g = new THREE.Group(); g.position.set(sw.x, sw.model === 'book' ? 1.45 : 1.35, sw.z); g.rotation.y = Math.atan2(sw.nx, sw.nz); scene.add(g);
      const mat = lam(null, { color: sw.color });
      let part;
      if (sw.model === 'lever') {
        add(new THREE.BoxGeometry(.22, .3, .08), M.dark, 0, 0, -.02, g);
        part = new THREE.Group(); part.position.set(0, -.1, .04); g.add(part);
        add(new THREE.BoxGeometry(.04, .45, .04), M.metal, 0, .22, 0, part);
        add(new THREE.BoxGeometry(.1, .08, .08), mat, 0, .45, 0, part);
      } else if (sw.model === 'valve') {
        add(new THREE.CylinderGeometry(.03, .03, .2, 6), M.dark, 0, 0, -.05, g).rotation.x = Math.PI / 2;
        part = new THREE.Mesh(new THREE.TorusGeometry(.15, .022, 4, 10), mat); part.position.z = .06; g.add(part);
        for (let k = 0; k < 2; k++) { const spoke = new THREE.Mesh(new THREE.BoxGeometry(.3, .02, .02), mat); spoke.rotation.z = k * Math.PI / 2; part.add(spoke); }
      } else {
        part = new THREE.Mesh(new THREE.BoxGeometry(.06, .3, .22), mat); part.position.set(0, 0, -.02); g.add(part);
        add(new THREE.BoxGeometry(.065, .02, .2), lam(null, { color: 0xb09040 }), 0, .1, 0, part);
      }
      v.switches.push({ model: sw.model, part, turn: 0 });
    });
    puzzlesV[pz.id] = v;
  }
  function updatePuzzles(dt, W) {
    for (const pz of map.puzzles || []) {
      const v = puzzlesV[pz.id], st = W.puzzles && W.puzzles[pz.id]; if (!v || !st) continue;
      v.t = st.open ? Math.min(1, v.t + dt / 1.2) : 0;
      const e = v.t * v.t * (3 - 2 * v.t);
      if (v.hinge) { if (v.kind === 'footlocker') v.hinge.rotation.x = -e * 1.6; else v.hinge.rotation.y = -e * 1.9; }
      if (v.slide) v.slide.position.x = -e * 1.25;
      v.switches.forEach((sw, i) => {
        const on = st.open || st.seq.includes(i);
        sw.turn += ((on ? 1 : 0) - sw.turn) * Math.min(1, dt * 4);
        if (sw.model === 'valve') sw.part.rotation.z = sw.turn * Math.PI * 1.5;
        else if (sw.model === 'lever') sw.part.rotation.x = -.6 + sw.turn * 1.4;
        else { sw.part.position.z = -.02 + sw.turn * .12; sw.part.rotation.x = -sw.turn * .5; }
      });
    }
  }

  // blood sprayed onto walls and floors by hits; the oldest fade away first
  // one instanced mesh per blood texture, each a ring of the most recent splashes
  const decalMats = TX.blood.map(t => lam(t, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -4 }));
  const decalGeo = new THREE.PlaneGeometry(1, 1), PER = Math.ceil(90 / decalMats.length);
  const decalSets = decalMats.map(m => { const im = new THREE.InstancedMesh(decalGeo, m, PER); im.count = 0; im.frustumCulled = false; scene.add(im); return { im, next: 0 }; });
  const dObj = new THREE.Object3D();
  let decalN = 0;
  function addDecal(point, normal, size = .7) {
    const set = decalSets[decalN++ % decalSets.length];
    dObj.position.copy(point).addScaledVector(normal, .015);
    dObj.lookAt(point.clone().add(normal)); dObj.rotateZ(R(0, 6.28));
    dObj.scale.setScalar(size * R(.7, 1.3)); dObj.updateMatrix();
    set.im.setMatrixAt(set.next, dObj.matrix);
    set.next = (set.next + 1) % PER; set.im.count = Math.max(set.im.count, set.next === 0 ? PER : set.next);
    set.im.instanceMatrix.needsUpdate = true;
  }
  // tonight's collapse: a mound of rubble under a hole in the ceiling
  function addRubble(c, ceil) {
    const r = rng(Math.round(c.x0 * 7 + c.z0 * 13)), w = c.x1 - c.x0, d = c.z1 - c.z0, cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
    const mats = [M.plaster, M.concrete, M.brick, M.board, M.ceil];
    for (let i = 0; i < 46; i++) {
      const u = r() - .5, v = r() - .5, mound = 1 - Math.max(Math.abs(u), Math.abs(v)) * 1.6;
      const sx = .2 + r() * .7, sy = .08 + r() * .35, sz = .2 + r() * .7;
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mats[i % mats.length]);
      m.position.set(cx + u * (w - .2), Math.max(sy / 2, mound * 1.1 * r() + sy / 2), cz + v * (d - .2)); m.rotation.set((r() - .5) * 1.2, r() * 3, (r() - .5) * 1.2);
      scene.add(m);
    }
    for (let k = 0; k < 3; k++) { const beam = new THREE.Mesh(new THREE.BoxGeometry(.25, .25, Math.max(w, d) * .9), M.ceil); beam.position.set(cx + (r() - .5) * w * .5, .5 + r() * .6, cz + (r() - .5) * d * .5); beam.rotation.set((r() - .5) * .8, r() * 3, (r() - .4) * .9); scene.add(beam); }
    if (ceil) {
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(w * .9, d * .9), new THREE.MeshBasicMaterial({ color: 0x030202, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
      hole.rotation.x = Math.PI / 2; hole.position.set(cx, ceil - .02, cz); scene.add(hole);
      for (let k = 0; k < 4; k++) { const L = .5 + r() * 1.3, cb = new THREE.Mesh(new THREE.BoxGeometry(.015, L, .015), new THREE.MeshBasicMaterial({ color: 0x0c0c0c })); cb.position.set(cx + (r() - .5) * w * .7, ceil - L / 2, cz + (r() - .5) * d * .7); scene.add(cb); }
    }
  }
  function openLocker(id, secs) { const l = lockers[id]; if (l) l.hold = Math.max(l.hold, secs); }
  // the door of the locker you are inside would fill the whole view; the slats are drawn on screen instead
  function insideLocker(id) { for (const k in lockers) lockers[k].hinge.visible = k !== id; }

  // items lying around, each with a faint glint so they can be found in the dark
  const itemViews = new Map();
  const itemMesh = it => {
    const g = new THREE.Group();
    let m;
    switch (it.kind) {
      case 'fuel': m = new THREE.Mesh(new THREE.BoxGeometry(.32, .42, .14), lam(TX.items.fuel)); m.position.y = .21; break;
      case 'carkey': m = new THREE.Group(); { const ring = new THREE.Mesh(new THREE.TorusGeometry(.03, .008, 4, 8), GMw.metal); ring.rotation.x = Math.PI / 2; const fob = new THREE.Mesh(new THREE.BoxGeometry(.05, .015, .08), lam(null, { color: 0x2a1a10 })); fob.position.x = .06; m.add(ring, fob); } m.position.y = .02; break;
      case 'fuse': m = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .16, 6), lam(TX.items.fuse)); m.rotation.z = Math.PI / 2; m.position.y = .05; break;
      case 'battery': m = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .11, 6), lam(TX.items.battery)); m.rotation.z = Math.PI / 2; m.position.y = .04; break;
      case 'medkit': m = new THREE.Mesh(new THREE.BoxGeometry(.32, .12, .22), lam(TX.items.medkit)); m.position.y = .06; break;
      case 'ammo': m = new THREE.Mesh(new THREE.BoxGeometry(.3, .16, .18), lam(TX.items.ammo)); m.position.y = .08; break;
      case 'grenade': m = buildGun('grenade', GMw); m.rotation.z = Math.PI / 2; m.position.y = .04; break;
      case 'key': m = new THREE.Group(); { const ring = new THREE.Mesh(new THREE.TorusGeometry(.03, .008, 4, 8), GMw.brass); ring.rotation.x = Math.PI / 2; const shaft = new THREE.Mesh(new THREE.BoxGeometry(.1, .01, .015), GMw.brass); shaft.position.x = .07; m.add(ring, shaft); } m.position.y = .02; break;
      case 'weapon': m = buildGun(it.w, GMw); m.rotation.set(0, R(0, 6), Math.PI / 2); m.position.y = .05; break;
      case 'note': m = new THREE.Mesh(new THREE.PlaneGeometry(.22, .29), lam(TX.items.note, { side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = .015; break;
      case 'dynamite': m = new THREE.Group(); for (let k = 0; k < 3; k++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .2, 6), lam(null, { color: 0x9a2418 })); st.rotation.z = Math.PI / 2; st.position.set(0, .03, (k - 1) * .052); m.add(st); } { const band = new THREE.Mesh(new THREE.BoxGeometry(.05, .06, .17), lam(null, { color: 0xc8b890 })); band.position.y = .03; m.add(band); const fuse = new THREE.Mesh(new THREE.BoxGeometry(.14, .008, .008), lam(null, { color: 0x202020 })); fuse.position.set(.16, .03, 0); m.add(fuse); } break;
      case 'detonator': m = new THREE.Group(); { const body = new THREE.Mesh(new THREE.BoxGeometry(.28, .22, .2), lam(null, { color: 0x5a4024 })); body.position.y = .11; m.add(body); const rod = new THREE.Mesh(new THREE.BoxGeometry(.025, .2, .025), M.metal); rod.position.y = .3; m.add(rod); const t = new THREE.Mesh(new THREE.BoxGeometry(.2, .03, .03), M.dark); t.position.y = .4; m.add(t); } break;
      case 'handwheel': m = new THREE.Group(); { const ring = new THREE.Mesh(new THREE.TorusGeometry(.13, .02, 4, 10), lam(null, { color: 0x8a2a1a })); ring.rotation.x = Math.PI / 2; m.add(ring); for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(.26, .015, .02), lam(null, { color: 0x8a2a1a })); sp.rotation.y = k * Math.PI / 3; m.add(sp); } } m.position.y = .03; break;
      case 'clue': m = new THREE.Mesh(new THREE.PlaneGeometry(.15, .12), lam(TX.items.note, { side: THREE.DoubleSide, color: 0xd8c890 })); m.rotation.x = -Math.PI / 2; m.rotation.z = R(-.6, .6); m.position.y = .015; break;
      case 'secret': m = new THREE.Mesh(new THREE.BoxGeometry(.26, .02, .17), lam(null, { color: 0xc8b48a })); m.position.y = .015; { const seal = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .01, 8), lam(null, { color: 0x7a1010 })); seal.position.y = .015; m.add(seal); } break;
    }
    g.add(m);
    // what the objectives ask for shines warm and carries through the fog; supplies just glint
    const quest = QUEST_KINDS.has(it.kind) || it.kind === 'clue';
    const glint = glowSprite(TX.glowWhite, quest ? .55 : .3, .5); glint.position.y = .15; g.add(glint);
    if (quest) {
      glint.material.color.setHex(0xffd890); glint.material.fog = false;
      const halo = glowSprite(TX.glowWhite, 1.5, 0); halo.material.color.setHex(0xffb860); halo.material.fog = false; halo.position.y = .2; g.add(halo); g.userData.halo = halo;
      // a faint warmth of its own, so it can be made out even without the torch
      g.traverse(o => { if (o.isMesh && o.material && o.material.emissive) { o.material = o.material.clone(); o.material.emissive.setHex(0x4a3418); } });
    }
    g.userData.quest = quest;
    g.position.set(it.x, it.y || 0, it.z); g.rotation.y = R(0, 6);
    g.userData.glint = glint;
    scene.add(g);
    return g;
  };

  let blackSeen = 0;
  // near: where the Matron is (lamps around her stutter), or null
  function update(dt, W, time, near, cam) {
    const powered = !map.hasPower || W.power;
    const black = W.blackout > 0;
    for (const it of lights) {
      let f = it.def.power && !powered ? 0 : 1;
      if (it.def.flicker && Math.random() < .06) f *= .1;
      if (near && f > 0) { const d = Math.hypot(it.def.x - near.x, it.def.z - near.z); if (d < 9 && Math.random() < .35 * (1 - d / 9)) f *= .1 + Math.random() * .4; }
      if (black) f *= Math.random() < .03 ? .4 : 0;
      it.now = it.base * f; it.b.visible = f > .3; it.halo.visible = f > .3; it.halo.material.opacity = .28 * Math.min(1, f);
    }
    // hand the slots to the nearest lamps (a lamp keeps its slot while it stays among the nearest)
    if (SLOTS) {
      const cx = cam ? cam.x : lights[0].def.x, cz = cam ? cam.z : lights[0].def.z;
      const near = lights.slice().sort((a, b) => Math.hypot(a.def.x - cx, a.def.z - cz) - Math.hypot(b.def.x - cx, b.def.z - cz)).slice(0, SLOTS);
      near.forEach((it, i) => { const l = slots[i]; l.position.set(it.def.x, it.def.y, it.def.z); l.color.setHex(it.def.color); l.distance = it.def.dist || 14; l.intensity = it.now; });
    }
    blackSeen = black;
    updatePuzzles(dt, W);
    // doors
    for (const id in doors) {
      const d = doors[id], open = !!W.doors[id];
      if (open && !d.open) { d.open = true; d.t = 0; const i = solids.indexOf(d.base); if (i >= 0) solids.splice(i, 1); }
      if (!open && d.open) { d.open = false; d.meshes.forEach(m => { m.visible = true; m.position.y = m.userData.y0; }); solids.push(d.base); }
      if (d.open && d.t < 1.3) {
        d.t += dt;
        // barricades are pulled up and away; a rockfall slumps down into the floor
        d.meshes.forEach((m, i) => { m.position.y = d.rubble ? m.userData.y0 - d.t * d.t * 2.2 : m.userData.y0 + d.t * d.t * 4 + i * d.t * .1; });
        if (d.t >= 1.3) d.meshes.forEach(m => { m.visible = false; });
      }
    }
    // boards
    for (const id in planks) {
      const n = W.boards[id] ?? 6, ps = planks[id];
      ps.forEach((p, i) => {
        const want = i < n;
        if (want && !p.visible) { p.visible = true; p.userData.pop = 1; p.position.copy(p.userData.home); }
        if (!want && p.visible) p.visible = false;
        if (p.userData.pop > 0) { p.userData.pop = Math.max(0, p.userData.pop - dt * 5); p.scale.setScalar(1 + p.userData.pop * .25); }
      });
    }
    // items
    const seen = new Set(), o = map.objectives[W.obj.i];
    const wantKind = o ? (o.id === 'fuses' ? 'fuse' : o.id === 'collect' ? o.item : null) : null;
    for (const it of W.items) {
      seen.add(it.id);
      let v = itemViews.get(it.id);
      if (!v) { v = itemMesh(it); itemViews.set(it.id, v); }
      // the ones the current objective needs pulse strongest
      const wanted = v.userData.quest && (it.kind === wantKind || (it.kind === 'key' && wantKind));
      const pulse = Math.max(0, Math.sin(time * (wanted ? 3.2 : 2.2) + it.x));
      v.userData.glint.material.opacity = wanted ? .65 + pulse * .35 : v.userData.quest ? .4 + pulse * .4 : .25 + pulse * .45;
      if (wanted) v.userData.glint.scale.setScalar(.8 + pulse * .55);
      if (v.userData.halo) v.userData.halo.material.opacity = wanted ? .1 + pulse * .14 : 0;
    }
    for (const [id, v] of itemViews) if (!seen.has(id)) { scene.remove(v); itemViews.delete(id); }
    for (const id in lockers) {
      const l = lockers[id]; l.hold = Math.max(0, l.hold - dt);
      l.open += ((l.hold > 0 ? 1 : 0) - l.open) * Math.min(1, dt * 7);
      l.hinge.rotation.y = -l.open * 1.6;
    }
    // serum tanks: once drained the sight glass goes dark and the green spreads across the floor
    for (const t of tanks) {
      const done = t.i >= 0 && W.obj && W.obj.i > t.i;
      t.drain = done ? Math.min(1, t.drain + dt * .25) : 0;
      const g = 1 - t.drain;
      t.glass.scale.y = Math.max(.02, g); t.glass.position.y = .3 + t.glass.geometry.parameters.height * (.5 * Math.max(.02, g) + .17);
      t.glassMat.emissive.setRGB(.16 * g, .38 * g, .06 * g);
      t.pool.visible = t.drain > 0; t.pool.scale.setScalar(.01 + t.drain * 1.2);
      if (t.drain > 0 && t.drain < 1) t.wheel.rotation.z += dt * 4;
    }
    // the car: headlights and a shudder once the engine is being cranked
    if (carV) {
      const ob = W.obj && map.objectives[W.obj.i], on = ob && (ob.id === 'hold' || ob.id === 'exit');
      carV.lights.forEach(l => { l.material.opacity = on ? (ob.id === 'hold' ? .3 + Math.random() * .5 : .95) : 0; });
      carV.body.position.y = on ? Math.sin(time * 40) * .012 : 0;
    }
    if (fuseV) {
      fuseV.sockets.forEach((s, i) => { s.visible = W.power; });
      fuseV.lamp.material.color.setHex(W.power ? 0x40ff60 : 0xff2010);
      fuseV.lamp.material.opacity = W.power ? .9 : (Math.sin(time * 4) > 0 ? .9 : .2);
    }
    if (radioV) radioV.lamp.material.opacity = powered ? .7 + Math.sin(time * 9) * .2 : 0;
    // traps
    for (const id in trapsV) {
      const on = W.traps[id] && W.traps[id].a > 0, v = trapsV[id];
      v.wires.forEach(w => { w.visible = on && Math.random() < .7; });
      v.sparks.forEach(s => {
        s.visible = on && Math.random() < .6;
        if (s.visible) { const [x, y, z] = s.userData.base; s.position.set(x + R(-.3, .3), y + R(-.3, .3), z + R(-.4, .4)); s.material.rotation = R(0, 6); }
      });
    }
  }
  mergeStatic(scene, solids);
  return { solids, planks, doors, lights, update, addDecal, openLocker, insideLocker, addRubble, isBlack: () => blackSeen };
}

function tree(scene, M, x, z) {
  const h = R(4, 7), trunk = new THREE.Mesh(new THREE.CylinderGeometry(R(.1, .16), R(.2, .3), h, 5, 3), M.bark);
  trunk.position.set(x, h / 2, z); trunk.rotation.z = R(-.08, .08); scene.add(trunk);
  for (let i = 0; i < 3; i++) {
    const l = R(1.2, 2.4), b = new THREE.Mesh(new THREE.CylinderGeometry(.03, .08, l, 4), M.bark);
    const a = R(0, Math.PI * 2), y = R(h * .5, h * .9);
    b.position.set(x + Math.cos(a) * l * .4, y, z + Math.sin(a) * l * .4);
    b.rotation.set(Math.sin(a), 0, -Math.cos(a));
    scene.add(b);
  }
}

// Merge every mesh that never moves into one mesh per material per 10 m square: a few dozen draw
// calls instead of hundreds, while squares behind the camera are still skipped.
function mergeStatic(scene, solids) {
  const groups = new Map(), take = [];
  const consider = (m, parent) => {
    if (!m.isMesh || m.isSkinnedMesh || m.userData.dynamic || Array.isArray(m.material) || !m.visible) return;
    const g = m.geometry; if (!g.attributes.position || !g.attributes.normal || !g.attributes.uv) return;
    m.updateMatrixWorld(true);
    if (!g.boundingSphere) g.computeBoundingSphere();
    const c = g.boundingSphere.center.clone().applyMatrix4(m.matrixWorld);
    const key = m.material.uuid + ':' + Math.floor(c.x / 10) + ':' + Math.floor(c.z / 10);
    if (!groups.has(key)) groups.set(key, { mat: m.material, list: [] });
    groups.get(key).list.push(m); take.push([m, parent]);
  };
  for (const ch of scene.children.slice()) {
    if (ch.isMesh) consider(ch, scene);
    else if (ch.isGroup && ch.userData.dressing) for (const k of ch.children.slice()) consider(k, ch);
  }
  const solidSet = new Set(solids), newSolids = new Set();
  const nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const { mat, list } of groups.values()) {
    if (list.length < 2) continue;
    let nv = 0, ni = 0;
    for (const m of list) { nv += m.geometry.attributes.position.count; ni += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
    let ov = 0, oi = 0, solid = false;
    for (const m of list) {
      const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      nm.getNormalMatrix(m.matrixWorld);
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); pos.set([v.x, v.y, v.z], (ov + i) * 3);
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (ov + i) * 3);
        uv[(ov + i) * 2] = U.getX(i); uv[(ov + i) * 2 + 1] = U.getY(i);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[oi++] = g.index.getX(i) + ov;
      else for (let i = 0; i < P.count; i++) idx[oi++] = i + ov;
      ov += P.count;
      if (solidSet.has(m)) solid = true;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    const merged = new THREE.Mesh(geo, mat);
    merged.renderOrder = list[0].renderOrder;
    scene.add(merged);
    for (const m of list) { m.parent.remove(m); m.geometry.dispose(); if (solidSet.has(m)) solids.splice(solids.indexOf(m), 1); }
    if (solid) newSolids.add(merged);
  }
  for (const m of newSolids) solids.push(m);
  void take;
}
