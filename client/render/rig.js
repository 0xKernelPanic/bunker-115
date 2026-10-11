// Procedural skinned characters: one continuous low-poly mesh per body, deformed by a bone skeleton.
// buildHumanoid() makes zombies (walker / thin / bloater / crawler) and player soldiers; buildDog() makes hellhounds.
import * as THREE from 'three';
import { atlasUV } from './textures.js';
import { rng } from '../../shared/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpN = (a, b, t) => a + (b - a) * t;

class MeshBuilder {
  constructor(skinned = true) { this.skinned = skinned; this.pos = []; this.uv = []; this.si = []; this.sw = []; this.idx = []; this.n = 0; }
  vert(p, u, v, w) {
    this.pos.push(p.x, p.y, p.z); this.uv.push(u, v);
    if (this.skinned) {
      const ws = w.slice(0, 4); while (ws.length < 4) ws.push([0, 0]);
      const tot = ws.reduce((s, e) => s + e[1], 0) || 1;
      for (const e of ws) { this.si.push(e[0]); this.sw.push(e[1] / tot); }
    }
    return this.n++;
  }
  P(i) { return V(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]); }
  // triangle whose normal is forced to face `want`
  tri(a, b, c, want) {
    const pa = this.P(a), n = this.P(b).sub(pa).cross(this.P(c).sub(pa));
    if (n.dot(want) < 0) this.idx.push(a, c, b); else this.idx.push(a, b, c);
  }
  // Tube from point a to point b. radii: profile sampled along the tube; sx/sz squash the cross-section.
  // weight(t) returns [[boneIndex, weight], ...] for a ring at parameter t.
  tube({ a, b, radii, sx = 1, sz = 1, seg = 7, uv, weight, capA = true, capB = true, wobble = 0, rnd = Math.random, bulge }) {
    const d = b.clone().sub(a), len = d.length(); d.normalize();
    let U, Vv;
    if (Math.abs(d.y) > .7) { U = V(1, 0, 0); Vv = V(0, 0, 1); }
    else if (Math.abs(d.z) > .7) { U = V(1, 0, 0); Vv = V(0, 1, 0); }
    else { U = V(0, 0, 1); Vv = V(0, 1, 0); }
    U.sub(d.clone().multiplyScalar(U.dot(d))).normalize();
    Vv.sub(d.clone().multiplyScalar(Vv.dot(d))).sub(U.clone().multiplyScalar(Vv.dot(U))).normalize();
    const rings = radii.length, rows = [];
    const [u0, v0, u1, v1] = uv;
    for (let r = 0; r < rings; r++) {
      const t = rings === 1 ? 0 : r / (rings - 1);
      const c = a.clone().addScaledVector(d, len * t);
      const row = [];
      for (let k = 0; k <= seg; k++) {
        const f = k / seg, ang = Math.PI * 2 * (f - .75);
        let rad = radii[r] * (1 + (k < seg && wobble ? (rnd() - .5) * wobble : 0));
        if (bulge) rad *= bulge(t, ang);
        const dir = U.clone().multiplyScalar(Math.sin(ang) * sx).addScaledVector(Vv, Math.cos(ang) * sz);
        const p = c.clone().addScaledVector(dir, rad);
        row.push(this.vert(p, u0 + (u1 - u0) * f, v0 + (v1 - v0) * t, weight(t)));
      }
      // close the seam on the wobble: the last vertex copies the first position
      if (wobble) { const i0 = row[0], iL = row[seg]; this.pos[iL * 3] = this.pos[i0 * 3]; this.pos[iL * 3 + 1] = this.pos[i0 * 3 + 1]; this.pos[iL * 3 + 2] = this.pos[i0 * 3 + 2]; }
      rows.push({ row, c });
    }
    for (let r = 0; r < rings - 1; r++) for (let k = 0; k < seg; k++) {
      const A = rows[r].row[k], B = rows[r].row[k + 1], C = rows[r + 1].row[k], D = rows[r + 1].row[k + 1];
      const out = this.P(A).sub(rows[r].c);
      this.tri(A, B, C, out); this.tri(B, D, C, out);
    }
    const cap = (ri, dirSign) => {
      const { row, c } = rows[ri];
      const ctr = this.vert(c, (u0 + u1) / 2, ri === 0 ? v0 : v1, weight(ri === 0 ? 0 : 1));
      const want = d.clone().multiplyScalar(dirSign);
      for (let k = 0; k < seg; k++) this.tri(ctr, row[k], row[k + 1], want);
    };
    if (capA) cap(0, -1);
    if (capB) cap(rings - 1, 1);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.skinned) {
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    }
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

// weight helpers
const W1 = i => () => [[i, 1]];
const Wseg = (prev, own, next, blend = .3) => t => {
  const out = [[own, 1]];
  if (prev >= 0 && t < blend) { const w = .5 * (1 - t / blend); out[0][1] -= w; out.push([prev, w]); }
  if (next >= 0 && t > 1 - blend) { const w = .5 * ((t - (1 - blend)) / blend); out[0][1] -= w; out.push([next, w]); }
  return out;
};

const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const stumpGeo = new THREE.SphereGeometry(.065, 6, 4);

const PROPS = {
  walker: r => ({ legLen: .96 + r() * .08, armLen: 1 + r() * .06, girth: .88 + r() * .14, belly: .9, torsoLen: 1, neckLen: 1, headS: 1, hunch: .18 + r() * .2, backKnee: false, waddle: 0 }),
  thin: r => ({ legLen: 1.22, armLen: 1.42, girth: .6, belly: .7, torsoLen: 1.12, neckLen: 1.8, headS: .9, hunch: .45, backKnee: true, waddle: 0 }),
  bloater: r => ({ legLen: .92, armLen: .95, girth: 1.2, belly: 2.1, torsoLen: 1.02, neckLen: .7, headS: .95, hunch: .1, backKnee: false, waddle: .1 }),
  stalker: r => ({ legLen: 1.2, armLen: 1.18, girth: 1.05, belly: 1.15, torsoLen: 1.14, neckLen: 1.25, headS: 1.04, hunch: .32, backKnee: false, waddle: .02 }),
  soldier: r => ({ legLen: 1, armLen: 1, girth: 1, belly: 1, torsoLen: 1, neckLen: 1, headS: 1, hunch: 0, backKnee: false, waddle: 0 }),
  screamer: r => ({ legLen: 1.12, armLen: 1.3, girth: .62, belly: .7, torsoLen: 1.08, neckLen: 2.1, headS: .95, hunch: .32, backKnee: false, waddle: 0 }),
  brute: r => ({ legLen: 1.04, armLen: 1.22, girth: 1.6, belly: 1.25, torsoLen: 1.16, neckLen: .45, headS: .86, hunch: .5, backKnee: false, waddle: .05 }),
  weeper: r => ({ legLen: 1, armLen: 1.16, girth: .72, belly: .8, torsoLen: 1, neckLen: 1.2, headS: .95, hunch: .2, backKnee: false, waddle: 0 })
};

export function buildHumanoid(kind, seed, material, extras = {}) {
  const r = rng(seed + 11);
  const P = (PROPS[kind] || PROPS.walker)(r);
  P.limp = (kind === 'walker' && r() < .45) || kind === 'stalker';   // the Matron drags her right leg
  P.pump = r() < .5; P.oneArm = kind === 'walker' && r() < .25;
  P.headTilt = (r() - .5) * (kind === 'thin' ? .9 : .5); P.jawLoose = kind === 'soldier' ? 0 : .5 + r() * .8;
  P.armOff = (r() - .5) * .3; P.stride = .9 + r() * .25;
  // how this one carries itself: arms (0 reaching, 1 hanging, 2 one up one down), a rolling
  // shoulder, a lolling head; and whether its jaw is gone or an arm is swollen
  P.armStyle = kind === 'walker' ? (r() * 3 | 0) : 0;
  P.roll = kind === 'soldier' ? 0 : r() * .12; P.loll = kind === 'soldier' ? 0 : r() * .25;
  P.noJaw = kind === 'walker' && r() < .12;
  P.swell = kind === 'walker' && r() < .15 ? (r() < .5 ? 'L' : 'R') : null;
  P.shrug = kind === 'soldier' ? 0 : (r() - .5) * .07;   // one shoulder lower than the other
  P.hair = (kind === 'walker' && r() < .3) || kind === 'weeper';
  P.tatters = kind === 'walker' || kind === 'thin' ? Math.floor(r() * 6) : 0;
  // how this body is broken. Some stay almost human, so the broken ones stand out.
  const breakable = ['walker', 'thin', 'screamer', 'weeper', 'crawler'].includes(kind) || ((kind === 'brute' || kind === 'bloater') && r() < .4);
  const broken = breakable && r() < (kind === 'thin' || kind === 'screamer' ? .95 : .75);
  P.neckBreak = broken && r() < .55 ? { z: (r() < .5 ? -1 : 1) * (.6 + r() * .8), x: (r() - .35) * 1.0 } : null;
  if (P.neckBreak && r() < .5) P.neckLen *= 1.3 + r() * .3;
  P.armMul = { L: 1, R: 1 };
  if (broken && r() < .45) { const both = r() < .4, k = 1.25 + r() * .15; if (both || r() < .5) P.armMul.L = k; if (both || P.armMul.L === 1) P.armMul.R = k; }
  P.badElbow = broken && r() < .35 ? (r() < .5 ? 'L' : 'R') : null;
  P.badKnee = broken && r() < .25 ? (r() < .5 ? 'L' : 'R') : null;
  P.twist = broken && r() < .45 ? (r() - .5) * 1.2 : 0;
  P.jawHang = kind === 'soldier' ? 0 : broken && r() < .5 ? { x: .45 + r() * .4, z: (r() - .5) * .5 } : null;
  // how it moves: in jerks (stop-motion), how often it spasms
  P.choppy = kind !== 'soldier' && r() < .6 ? 8 + r() * 6 : 0;
  P.spasm = kind === 'soldier' ? 0 : .08 + r() * .25;
  const g = P.girth, hipY = .92 * P.legLen;
  const names = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'jaw', 'uaL', 'faL', 'haL', 'uaR', 'faR', 'haR', 'thL', 'shL', 'thR', 'shR'];
  const parent = { hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head', uaL: 'chest', faL: 'uaL', haL: 'faL', uaR: 'chest', faR: 'uaR', haR: 'faR', thL: 'hips', shL: 'thL', thR: 'hips', shR: 'thR' };
  const sh = .19 * Math.max(.8, g);
  const local = {
    root: V(0, 0, 0), hips: V(0, hipY, 0), spine: V(0, .14, 0), chest: V(0, .24 * P.torsoLen, 0), neck: V(0, .25 * P.torsoLen, 0),
    head: V(0, .09 * P.neckLen, .01), jaw: V(0, .03, .04),
    uaL: V(-sh, .19 * P.torsoLen + P.shrug, 0), faL: V(0, -.29 * P.armLen * P.armMul.L, 0), haL: V(0, -.26 * P.armLen * P.armMul.L, 0),
    uaR: V(sh, .19 * P.torsoLen - P.shrug, 0), faR: V(0, -.29 * P.armLen * P.armMul.R, 0), haR: V(0, -.26 * P.armLen * P.armMul.R, 0),
    thL: V(-.1 * Math.max(.85, g), -.03, 0), shL: V(0, -.45 * P.legLen, 0), thR: V(.1 * Math.max(.85, g), -.03, 0), shR: V(0, -.44 * P.legLen, 0)
  };
  const bones = {}, list = [], index = {};
  names.forEach((n, i) => { const b = new THREE.Bone(); b.name = n; b.position.copy(local[n]); bones[n] = b; list.push(b); index[n] = i; });
  names.forEach(n => { if (parent[n]) bones[parent[n]].add(bones[n]); });
  bones.root.updateMatrixWorld(true);
  const wp = n => bones[n].getWorldPosition(new THREE.Vector3());
  const I = index, mb = new MeshBuilder(true), rnd = r;
  const wob = kind === 'soldier' ? 0 : .12;
  // torso: hips to neck base, elliptical, weighted hips -> spine -> chest -> neck
  const hipsP = wp('hips'), neckP = wp('neck');
  const torsoA = hipsP.clone().add(V(0, -.08, 0)), torsoB = neckP.clone();
  const by = torsoB.y - torsoA.y;
  const spineY = wp('spine').y, chestY = wp('chest').y;
  mb.tube({
    a: torsoA, b: torsoB, seg: 9, uv: atlasUV('torso'), wobble: wob, rnd,
    radii: [.15, .16, .14, .15, .18, .2, .17, .07].map((v, i) => v * g * (i >= 2 && i <= 3 ? Math.sqrt(P.belly) : 1)),
    sx: 1.15, sz: .7,
    bulge: P.belly > 1.3 ? (t, ang) => 1 + (t > .15 && t < .6 ? Math.max(0, Math.cos(ang)) * (P.belly - 1) * .5 * Math.sin((t - .15) / .45 * Math.PI) : 0) : null,
    weight: t => {
      const y = torsoA.y + by * t;
      if (y < spineY) return [[I.hips, 1]];
      if (y < chestY) { const k = (y - spineY) / (chestY - spineY); return [[I.hips, 1 - k], [I.spine, k]]; }
      if (t > .93) return [[I.neck, .6], [I.chest, .4]];
      const k = Math.min(1, (y - chestY) / .15); return [[I.spine, 1 - k], [I.chest, k]];
    }
  });
  // neck
  const headP = wp('head');
  mb.tube({ a: neckP.clone().add(V(0, -.02, 0)), b: headP.clone().add(V(0, .03, 0)), radii: [.055, .05, .055].map(v => v * Math.sqrt(g)), seg: 6, uv: atlasUV('torso'), weight: Wseg(I.chest, I.neck, I.head, .4), capA: false, capB: false });
  // head: skull from neck top upwards, wider at the cheeks, deep front-to-back
  const hs = P.headS;
  mb.tube({
    a: headP.clone().add(V(0, -.01, 0)), b: headP.clone().add(V(0, .29 * hs, 0)), seg: kind === 'soldier' ? 9 : 12, uv: atlasUV('head'), wobble: kind === 'soldier' ? 0 : .06, rnd,
    radii: (kind === 'soldier' ? [.075, .1, .115, .12, .118, .11, .09, .055, 0] : [.072, .09, .104, .114, .12, .122, .121, .117, .11, .1, .084, .06, .03, 0]).map(v => v * hs),
    sx: .95, sz: 1.08, weight: W1(I.head), capB: false,
    // the skull showing through: deep eye sockets, sharp cheekbones, sunken temples
    bulge: kind === 'soldier' ? null : (t, ang) => {
      const a = Math.atan2(Math.sin(ang), Math.cos(ang)), fa = Math.abs(a);
      let k = 1;
      if (Math.abs(t - .45) < .09 && Math.abs(fa - .34) < .24) k *= .84;            // sockets
      if (Math.abs(t - .34) < .06 && fa > .45 && fa < .85) k *= 1.07;                // cheekbones
      if (t > .25 && t < .36 && fa < .35) k *= .93;                                  // under the cheekbones
      if (t > .5 && t < .72 && Math.abs(fa - 1.3) < .35) k *= .9;                     // temples
      return k;
    }
  });
  // jaw hinged under the front of the skull
  const jawP = wp('jaw');
  const jl = kind === 'screamer' ? 2.2 : 1;   // the screamer's jaw hangs down to its chest
  mb.tube({ a: jawP.clone().add(V(0, .02, -.06)), b: jawP.clone().add(V(0, -.05 * jl, .06)), radii: [.075, .07, .05].map(v => v * hs), sx: 1.0, sz: .62, seg: 7, uv: atlasUV('jaw'), weight: W1(I.jaw) });
  // arms
  for (const s of ['L', 'R']) {
    const ua = wp('ua' + s), fa = wp('fa' + s), ha = wp('ha' + s);
    const ag = kind === 'bloater' ? 1.25 : kind === 'brute' ? 1.55 : kind === 'thin' || kind === 'screamer' ? .65 : kind === 'weeper' ? .75 : 1;
    mb.tube({ a: ua.clone().add(V(0, .05, 0)), b: fa, radii: [.07, .065, .058, .05].map(v => v * ag), seg: 7, uv: atlasUV('upper'), weight: Wseg(I.chest, I['ua' + s], I['fa' + s], .25), wobble: wob * .6, rnd });
    mb.tube({ a: fa, b: ha, radii: [.05, .048, .04, .034].map(v => v * ag), seg: 6, uv: atlasUV('fore'), weight: Wseg(I['ua' + s], I['fa' + s], I['ha' + s], .3), wobble: wob * .6, rnd });
    const palmEnd = ha.clone().add(V(0, -.1, .01));
    mb.tube({ a: ha, b: palmEnd, radii: [.034, .042, .036], sx: 1.25, sz: .55, seg: 6, uv: atlasUV('hand'), weight: Wseg(I['fa' + s], I['ha' + s], -1, .3) });
    if (kind !== 'soldier' && kind !== 'stalker') {
      const clawL = kind === 'thin' || kind === 'weeper' ? .14 : kind === 'brute' ? .04 : .075;
      for (let f = 0; f < 4; f++) {
        const fx = (f - 1.5) * .018 * (s === 'L' ? -1 : 1);
        mb.tube({ a: palmEnd.clone().add(V(fx, .015, .005)), b: palmEnd.clone().add(V(fx * 1.2, -clawL, .02 + r() * .02)), radii: [.009, .007, .002], seg: 4, uv: atlasUV('hand'), weight: W1(I['ha' + s]), capA: false });
      }
    }
  }
  // legs
  for (const s of ['L', 'R']) {
    const th = wp('th' + s), shn = wp('sh' + s), ankle = shn.clone().add(V(0, -.43 * P.legLen, 0));
    const lg = kind === 'bloater' ? 1.2 : kind === 'brute' ? 1.35 : kind === 'thin' || kind === 'screamer' ? .6 : kind === 'weeper' ? .8 : 1;
    mb.tube({ a: th.clone().add(V(0, .06, 0)), b: shn, radii: [.095, .09, .075, .062].map(v => v * lg), seg: 7, uv: atlasUV('thigh'), weight: Wseg(I.hips, I['th' + s], I['sh' + s], .25), wobble: wob * .5, rnd });
    mb.tube({ a: shn, b: ankle, radii: [.062, .056, .048, .05].map(v => v * lg), seg: 6, uv: atlasUV('shin'), weight: Wseg(I['th' + s], I['sh' + s], -1, .25), wobble: wob * .5, rnd });
    mb.tube({ a: ankle.clone().add(V(0, .02, -.05)), b: ankle.clone().add(V(0, -.03, .17)), radii: [.05, .055, .05, .035], sx: 1, sz: .55, seg: 6, uv: [.5, 1 - 112 / 128, 1, 0], weight: W1(I['sh' + s]) });
  }
  // ---- details that break up the silhouette of the dead ----
  if (kind !== 'soldier' && kind !== 'stalker') {
    const H = headP, skinUV = [40 / 128, 1 - 24 / 128, 56 / 128, 1 - 30 / 128];
    // a nose (or what is left of it), a heavy brow, ears
    mb.tube({ a: H.clone().add(V(0, .135 * hs, .115 * hs)), b: H.clone().add(V(0, .085 * hs, .145 * hs)), radii: [.012, .02, .014], sx: .9, sz: 1, seg: 5, uv: skinUV, weight: W1(I.head) });
    mb.tube({ a: H.clone().add(V(-.065 * hs, .165 * hs, .1 * hs)), b: H.clone().add(V(.065 * hs, .165 * hs, .1 * hs)), radii: [.01, .02, .022, .02, .01], sx: 1, sz: .6, seg: 5, uv: skinUV, weight: W1(I.head) });
    for (const sx of [-1, 1]) mb.tube({ a: H.clone().add(V(sx * .105 * hs, .14 * hs, 0)), b: H.clone().add(V(sx * .122 * hs, .135 * hs, -.008)), radii: [.016, .02, .008], sx: .4, sz: 1, seg: 5, uv: skinUV, weight: W1(I.head) });
    // long, lank hair hanging from the back of the skull
    if (P.hair) {
      const hairUV = [0, 1 - 2 / 128, 64 / 128, 1 - 8 / 128];
      for (let i = 0; i < 9; i++) {
        const a0 = -1.2 + i * .3, x = Math.sin(a0) * .11 * hs, z = Math.cos(a0) * -.1 * hs, len = (.18 + r() * .2) * (kind === 'weeper' ? 1.6 : 1);
        mb.tube({ a: H.clone().add(V(x, .25 * hs, z)), b: H.clone().add(V(x * 1.25, .25 * hs - len, z * 1.4 - .03)), radii: [.022, .016, .006], sx: 1, sz: .4, seg: 4, uv: hairUV, weight: W1(I.head), capA: false });
      }
    }
    // rags hanging from the shirt and trousers; the ones over a leg swing with it
    const ragUV = [66 / 128, 1 - 50 / 128, 126 / 128, 1 - 62 / 128];
    for (let i = 0; i < P.tatters; i++) {
      const ang = r() * Math.PI * 2, rx = Math.sin(ang) * .17 * g * 1.1, rz = Math.cos(ang) * .12 * g, len = .15 + r() * .28;
      const leg = rx < -.04 ? I.thL : rx > .04 ? I.thR : I.hips;
      mb.tube({ a: hipsP.clone().add(V(rx, -.02, rz)), b: hipsP.clone().add(V(rx * 1.08, -.02 - len, rz * 1.15)), radii: [.035, .03, .012], sx: 1, sz: .22, seg: 4, uv: ragUV, weight: t => [[I.hips, 1 - t * .7], [leg, t * .7]], capA: false });
    }
    // the ribs show through on the starved ones
    if (kind === 'thin' || kind === 'screamer') {
      const C = wp('chest'), ribUV = [100 / 128, 1 - 10 / 128, 124 / 128, 1 - 12 / 128];
      for (let i = 0; i < 4; i++) {
        const y = -.04 - i * .055;
        mb.tube({ a: C.clone().add(V(-.085 * g, y, .07 * g)), b: C.clone().add(V(.085 * g, y, .07 * g)), radii: [.006, .011, .013, .011, .006], sx: 1, sz: 1, seg: 4, uv: ribUV, weight: W1(I.chest),
          bulge: (t) => 1 + Math.sin(t * Math.PI) * .3 });
      }
    }
    // sores bulging from the bloater's belly
    if (kind === 'bloater') {
      const B = wp('spine'), soreUV = [96 / 128, 1 - 30 / 128, 126 / 128, 1 - 34 / 128];
      for (let i = 0; i < 9; i++) {
        const ang = (r() - .5) * 2.2, y = .04 + r() * .22, rr = .2 * g * Math.sqrt(P.belly), sz = .022 + r() * .025;
        const at = B.clone().add(V(Math.sin(ang) * rr, y, Math.cos(ang) * rr * .85));
        mb.tube({ a: at, b: at.clone().add(V(Math.sin(ang) * sz, 0, Math.cos(ang) * sz)), radii: [sz, sz * .9, sz * .4], seg: 5, uv: soreUV, weight: W1(I.spine) });
      }
    }
  }
  // the Matron's gown hangs from the hips almost to the floor
  if (kind === 'stalker') {
    mb.tube({
      a: hipsP.clone().add(V(0, .02, 0)), b: V(hipsP.x, .3, hipsP.z), seg: 10, uv: atlasUV('legs'), wobble: .06, rnd,
      radii: [.2, .22, .26, .3, .33, .35].map(v => v * g), sx: 1.12, sz: .95, weight: W1(I.hips), capA: false, capB: false
    });
  }
  const geo = mb.geometry();
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.add(bones.root);
  const skeleton = new THREE.Skeleton(list);
  mesh.bind(skeleton);
  mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.add(mesh);

  // glowing eyes for the dead
  const eyes = [];
  if (kind !== 'soldier' && kind !== 'stalker' && extras.eyeMat) {
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(extras.eyeGeo, extras.eyeMat);
      e.position.set(sx * .042 * hs, .13 * hs, .125 * hs * 1.08 - .005);
      bones.head.add(e); eyes.push(e);
      if (extras.glowMat) { const sp = new THREE.Sprite(extras.glowMat); sp.scale.set(.09, .09, 1); sp.position.copy(e.position).add(V(0, 0, .02)); bones.head.add(sp); eyes.push(sp); }
    }
  }
  if (kind === 'brute' && extras.cleaverMat) {
    // a length of chain still locked to its right wrist
    for (let k = 0; k < 6; k++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(.035, .009, 3, 6), extras.cleaverMat);
      link.position.set(0, -.1 - k * .055, .02); link.rotation.y = k % 2 ? Math.PI / 2 : 0;
      bones.haR.add(link);
    }
  }
  if (kind === 'stalker' && extras.cleaverMat) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.02, .3, .13), extras.cleaverMat); blade.position.set(0, -.28, .05);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(.035, .14, .035), extras.helmet || extras.cleaverMat); handle.position.set(0, -.1, 0);
    bones.haR.add(blade, handle);
  }
  if (extras.helmet && kind !== 'stalker' && (kind === 'soldier' || (['walker', 'thin'].includes(kind) && r() < (extras.helmetChance ?? .22)))) {
    const h = new THREE.Mesh(extras.helmetGeo, extras.helmet);
    h.position.set(0, .2 * hs, 0); h.rotation.set(kind === 'soldier' ? -.08 : (r() - .5) * .5, 0, kind === 'soldier' ? 0 : (r() - .5) * .6);
    h.scale.setScalar(hs);
    bones.head.add(h);
  }
  // stumps shown after a limb is blown off
  const stumps = {};
  if (extras.stumpMat) {
    const st = (parentBone, at, key) => { const m = new THREE.Mesh(stumpGeo, extras.stumpMat); m.position.copy(at); m.visible = false; bones[parentBone].add(m); stumps[key] = m; };
    st('neck', local.head, 'head'); st('uaL', local.faL, 'armL'); st('uaR', local.faR, 'armR'); st('hips', local.thL, 'legL'); st('hips', local.thR, 'legR');
  }
  // invisible hitboxes per body part (raycast targets)
  const hit = [];
  const hb = (bone, w, h, d, oy, part) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat); m.position.y = oy; m.userData.part = part; bones[bone].add(m); hit.push(m); return m; };
  if (kind !== 'soldier') {
    hb('head', .27 * hs, .32 * hs, .29 * hs, .14 * hs, 0);
    hb('chest', .42 * g, .38, .28 * g * Math.sqrt(P.belly), .12, 1);
    hb('hips', .38 * g, .34, .27 * g * Math.sqrt(P.belly), .14, 1);
    hb('uaL', .12, .3 * P.armLen, .12, -.15 * P.armLen, 2); hb('faL', .11, .36 * P.armLen, .11, -.18 * P.armLen, 2);
    hb('uaR', .12, .3 * P.armLen, .12, -.15 * P.armLen, 3); hb('faR', .11, .36 * P.armLen, .11, -.18 * P.armLen, 3);
    hb('thL', .17, .46 * P.legLen, .17, -.23 * P.legLen, 4); hb('shL', .13, .46 * P.legLen, .13, -.23 * P.legLen, 4);
    hb('thR', .17, .46 * P.legLen, .17, -.23 * P.legLen, 5); hb('shR', .13, .46 * P.legLen, .13, -.23 * P.legLen, 5);
  }
  const bind = {}; for (const n of names) bind[n] = bones[n].position.clone();
  return { kind, group, mesh, bones, bind, P, eyes, stumps, hit, seed, st: { phase: r() * 6, hit: 0, hitZ: 0, twT: 0, tw: { x: 0, y: 0, z: 0 }, twTarget: { x: 0, y: 0, z: 0 }, lost: 0 } };
}

// ---------- humanoid animation ----------
export function poseHumanoid(c, dt, s) {
  const b = c.bones, P = c.P, st = c.st, T = s.t;
  for (const n in b) { b[n].rotation.set(0, 0, 0); }
  b.hips.position.copy(c.bind.hips);
  c.mesh.rotation.set(0, 0, 0); c.mesh.position.set(0, 0, 0);
  const mul = s.frozen ? .3 : 1;
  // head twitches: snappy for the thin ones, slow drift for the rest
  st.twT -= dt * mul;
  if (st.twT <= 0) {
    const big = c.kind === 'thin';
    st.twT = big ? .15 + Math.random() * .5 : 1 + Math.random() * 3;
    st.twTarget = { x: (Math.random() - .5) * (big ? 1.1 : .3), y: (Math.random() - .5) * (big ? 1.4 : .4), z: (Math.random() - .5) * (big ? 1.2 : .3) };
  }
  const k = c.kind === 'thin' ? 1 : Math.min(1, dt * 3);
  st.tw.x += (st.twTarget.x - st.tw.x) * k; st.tw.y += (st.twTarget.y - st.tw.y) * k; st.tw.z += (st.twTarget.z - st.tw.z) * k;
  st.hit = Math.max(0, st.hit - dt * 4);

  const mode = s.mode;
  if (mode === 'crawl') {
    st.phase += dt * mul * Math.max(.4, s.speed) / .8 * Math.PI * 2;
    const ph = st.phase;
    b.hips.position.y = .3; b.hips.rotation.x = 1.4;
    b.spine.rotation.x = .05; b.chest.rotation.x = -.1 + Math.sin(ph) * .05;
    b.neck.rotation.x = -.6; b.head.rotation.x = -.7 + st.tw.x * .5; b.head.rotation.z = P.headTilt + st.tw.z;
    b.uaL.rotation.x = -2.7 + Math.sin(ph) * .55; b.uaR.rotation.x = -2.7 - Math.sin(ph) * .55;
    b.uaL.rotation.z = -.35; b.uaR.rotation.z = .35;
    b.faL.rotation.x = -.3 - Math.max(0, Math.cos(ph)) * .7; b.faR.rotation.x = -.3 - Math.max(0, -Math.cos(ph)) * .7;
    b.thL.rotation.x = .1 + Math.sin(ph) * .12; b.thR.rotation.x = .1 - Math.sin(ph) * .12;
    b.shL.rotation.x = .4; b.shR.rotation.x = .3;
    b.jaw.rotation.x = .3 + Math.max(0, Math.sin(T * 2.3 + c.seed)) * .4;
  } else if (mode === 'soldier' || mode === 'down') {
    st.phase += dt * s.speed / 1.3 * Math.PI * 2;
    const ph = st.phase, A = Math.min(.55, s.speed * .14);
    b.thL.rotation.x = -Math.sin(ph) * A; b.thR.rotation.x = Math.sin(ph) * A;
    b.shL.rotation.x = .1 + Math.max(0, Math.cos(ph)) * A * 1.4; b.shR.rotation.x = .1 + Math.max(0, -Math.cos(ph)) * A * 1.4;
    b.hips.position.y -= Math.abs(Math.sin(ph)) * .03 * Math.min(1, s.speed);
    b.uaR.rotation.set(-1.25, 0, .2); b.faR.rotation.x = -.45;
    b.uaL.rotation.set(-1.35, .55, -.1); b.faL.rotation.x = -.5;
    const pitch = s.pitch || 0;
    b.chest.rotation.x = -pitch * .3; b.neck.rotation.x = -pitch * .3; b.head.rotation.x = -pitch * .4;
    b.uaR.rotation.x -= pitch * .6; b.uaL.rotation.x -= pitch * .6;
    if (s.sprint) { b.spine.rotation.x = .25; b.uaR.rotation.x = -.6; b.uaL.rotation.x = -.9; }
  } else {
    const run = mode === 'run', moving = s.speed > .05;
    st.phase += dt * mul * s.speed / (run ? 2.0 : 1.25) * Math.PI * 2;
    const ph = st.phase, A = (run ? .75 : .42) * P.stride * Math.min(1, s.speed * 1.5 + .1);
    b.thL.rotation.x = -Math.sin(ph) * A; b.thR.rotation.x = Math.sin(ph) * A * (P.limp ? .5 : 1);
    let kl = .12 + Math.max(0, Math.cos(ph)) * (run ? 1.2 : .6) * Math.min(1, s.speed + .2);
    let kr = .12 + Math.max(0, -Math.cos(ph)) * (run ? 1.2 : .6) * (P.limp ? .35 : 1) * Math.min(1, s.speed + .2);
    if (P.backKnee) { kl = -kl * 1.2; kr = -kr * 1.2; }
    b.shL.rotation.x = kl; b.shR.rotation.x = kr;
    b.hips.position.y -= Math.abs(Math.sin(ph)) * (run ? .07 : .035) + (P.limp ? Math.max(0, Math.sin(ph)) * .05 : 0);
    b.hips.rotation.z = Math.sin(ph) * (.05 + P.waddle) + (P.limp ? .06 : 0);
    b.hips.rotation.y = Math.sin(ph) * .1;
    b.spine.rotation.x = P.hunch * .6 + (run ? .35 : 0); b.chest.rotation.x = P.hunch * .4;
    b.chest.rotation.y = -Math.sin(ph) * .12;
    b.neck.rotation.x = -P.hunch * .5 - (run ? .25 : 0);
    b.head.rotation.set(-P.hunch * .3 + st.tw.x, st.tw.y, P.headTilt + st.tw.z);
    b.jaw.rotation.x = .1 + (Math.sin(T * 2.7 + c.seed) * .5 + .5) * .3 * P.jawLoose;
    // arms
    if (c.kind === 'stalker') {
      // the lantern held out in front in the left hand, the cleaver hanging in the right
      b.uaL.rotation.set(-.62 + Math.sin(ph) * .05, 0, -.14); b.faL.rotation.x = -.55;
      b.uaR.rotation.set(.06 - Math.sin(ph) * .12, 0, .1); b.faR.rotation.x = -.22;
      b.head.rotation.set(.3 + st.tw.x * .3, st.tw.y * .4, .5);
      b.spine.rotation.x += .08;
    } else if (c.kind === 'brute') {
      // heavy arms hanging forward, swinging like weights
      b.uaL.rotation.set(-.35 + Math.sin(ph) * .35, 0, -.28); b.uaR.rotation.set(-.35 - Math.sin(ph) * .35, 0, .28);
      b.faL.rotation.x = -.5; b.faR.rotation.x = -.5;
      b.head.rotation.x += .25;
    } else if (c.kind === 'screamer') {
      // arms dangling behind, the head thrust forward on the long neck
      b.uaL.rotation.set(.35 + Math.sin(ph) * .25, 0, -.12); b.uaR.rotation.set(.35 - Math.sin(ph) * .25, 0, .12);
      b.faL.rotation.x = -.15; b.faR.rotation.x = -.15;
      b.neck.rotation.x += .5; b.head.rotation.x -= .45;
    } else if (c.kind === 'weeper') {
      b.uaL.rotation.set(-1.9 + Math.sin(ph) * .3, 0, -.25); b.uaR.rotation.set(-1.9 - Math.sin(ph) * .3, 0, .25);
      b.faL.rotation.x = -.2; b.faR.rotation.x = -.2; b.haL.rotation.x = -.5; b.haR.rotation.x = -.5;
    } else if (c.kind === 'bloater') {
      b.uaL.rotation.set(-.7 + Math.sin(ph) * .2, 0, -.75); b.uaR.rotation.set(-.7 - Math.sin(ph) * .2, 0, .75);
      b.faL.rotation.x = -.5; b.faR.rotation.x = -.5;
    } else if (c.kind === 'thin') {
      b.uaL.rotation.set(-1.45 + Math.sin(ph * .5) * .3 + st.tw.x * .4, 0, .05); b.uaR.rotation.set(-1.6 + Math.cos(ph * .5) * .3 - st.tw.y * .3, 0, -.05);
      b.faL.rotation.x = -.15 + st.tw.z * .5; b.faR.rotation.x = -.35 - st.tw.x * .4;
      b.haL.rotation.x = -.4; b.haR.rotation.x = -.5;
    } else if (run && P.pump) {
      b.uaL.rotation.set(Math.sin(ph) * .9 - .4, 0, -.1); b.uaR.rotation.set(-Math.sin(ph) * .9 - .4, 0, .1);
      b.faL.rotation.x = -1.2; b.faR.rotation.x = -1.2;
    } else {
      b.uaL.rotation.set(-1.4 + Math.sin(ph * .5 + 1) * .14 + P.armOff, 0, .1); b.uaR.rotation.set(-1.4 + Math.cos(ph * .5) * .14 - P.armOff, 0, -.1);
      b.faL.rotation.x = -.25; b.faR.rotation.x = -.3;
      if (P.armStyle === 1 && !run) {   // arms hanging, swinging loosely
        b.uaL.rotation.set(.05 + Math.sin(ph) * .22, 0, -.06); b.uaR.rotation.set(.05 - Math.sin(ph) * .22, 0, .06);
        b.faL.rotation.x = -.1; b.faR.rotation.x = -.12;
      } else if (P.armStyle === 2 && !run) { b.uaL.rotation.set(.1 + Math.sin(ph) * .18, 0, -.08); b.faL.rotation.x = -.1; }
      if (P.oneArm && !run) { b.uaR.rotation.set(.1 * Math.sin(ph) + .05, 0, .12); b.faR.rotation.x = -.15; }
    }
    // a shoulder that rolls with each step, a head that lolls
    b.chest.rotation.z += Math.sin(ph) * P.roll;
    b.neck.rotation.z += Math.sin(T * .7 + c.seed) * P.loll;
    if (!moving) { b.chest.rotation.z = Math.sin(T * 1.3 + c.seed) * .06; }
    if (mode === 'tear') {
      const w = T * 9 + c.seed;
      b.spine.rotation.x = .3; b.head.rotation.x = -.2 + st.tw.x;
      b.uaL.rotation.set(-1.75 + Math.sin(w) * .45, 0, -.1); b.uaR.rotation.set(-1.75 + Math.sin(w + Math.PI) * .45, 0, .1);
      b.faL.rotation.x = -.3 - Math.max(0, Math.sin(w)) * .7; b.faR.rotation.x = -.3 - Math.max(0, -Math.sin(w)) * .7;
      b.jaw.rotation.x = .3 + Math.abs(Math.sin(w * .5)) * .4;
    } else if (mode === 'climb') {
      b.thL.rotation.x = -1.2; b.shL.rotation.x = 1.5; b.thR.rotation.x = -.5; b.shR.rotation.x = .9;
      b.uaL.rotation.set(-1.8, 0, -.2); b.uaR.rotation.set(-1.7, 0, .2); b.spine.rotation.x = .7;
    } else if (mode === 'rise') {
      b.uaL.rotation.set(-2.75 + Math.sin(T * 4 + c.seed) * .3, 0, -.25); b.uaR.rotation.set(-2.55 + Math.cos(T * 4) * .3, 0, .25);
      b.faL.rotation.x = -.4; b.faR.rotation.x = -.6;
      b.spine.rotation.x = .5; b.head.rotation.x = -.5; b.jaw.rotation.x = .7;
    } else if (mode === 'ceiling') {
      // spread like a spider against the ceiling (the group itself is tilted flat)
      const w = T * 1.6 + c.seed;
      b.thL.rotation.set(-.7, 0, -.8); b.thR.rotation.set(-.7, 0, .8); b.shL.rotation.x = 1.7; b.shR.rotation.x = 1.7;
      b.uaL.rotation.set(-2.1 + Math.sin(w) * .15, 0, -.95); b.uaR.rotation.set(-2.1 + Math.cos(w * 1.3) * .15, 0, .95);
      b.faL.rotation.x = -1.1; b.faR.rotation.x = -1.1; b.haL.rotation.x = -.6; b.haR.rotation.x = -.6;
      b.spine.rotation.x = -.1; b.chest.rotation.y = Math.sin(w * .5) * .1;
      b.neck.rotation.x = .5; b.head.rotation.set(.5 + st.tw.x * .5, st.tw.y, st.tw.z);
      b.jaw.rotation.x = .6 + Math.sin(w * 3) * .25;
    } else if (mode === 'scream') {
      b.head.rotation.x = -.75 + st.tw.x * .3; b.neck.rotation.x = -.4; b.jaw.rotation.x = c.kind === 'screamer' ? 1.3 + Math.sin(T * 40) * .08 : 1.0;
      b.uaL.rotation.set(-.5, 0, -1.1); b.uaR.rotation.set(-.5, 0, 1.1);
      b.faL.rotation.x = -.8; b.faR.rotation.x = -.8; b.spine.rotation.x = -.25;
    } else if (mode === 'feed') {
      // kneeling over a body, tearing at it, the head jerking down to eat
      const w = T * 2.2 + c.seed, bite = Math.max(0, Math.sin(w * 1.7));
      b.hips.position.y = .42; b.hips.rotation.x = .25;
      b.thL.rotation.set(-1.35, 0, -.15); b.thR.rotation.set(-1.25, 0, .15); b.shL.rotation.x = 2.3; b.shR.rotation.x = 2.2;
      b.spine.rotation.x = .75 + bite * .15; b.chest.rotation.x = .35; b.neck.rotation.x = .3 + bite * .35; b.head.rotation.set(.3 + bite * .4, st.tw.y * .4, st.tw.z);
      b.uaL.rotation.set(-.9 + Math.sin(w) * .4, 0, -.2); b.uaR.rotation.set(-.85 - Math.sin(w * 1.3) * .4, 0, .2);
      b.faL.rotation.x = -1.0 - Math.max(0, Math.sin(w)) * .5; b.faR.rotation.x = -1.1 - Math.max(0, -Math.sin(w * 1.3)) * .5;
      b.jaw.rotation.x = .2 + bite * .6;
    } else if (mode === 'trip') {
      // down on the knees and hands, then back up
      const k = s.k || 0, down = k < .25 ? k / .25 : k > .8 ? 1 - (k - .8) / .2 : 1, e = down * down * (3 - 2 * down);
      b.hips.position.y = c.bind.hips.y - e * .5; b.hips.rotation.x = e * .3;
      b.thL.rotation.x = -e * 1.5; b.thR.rotation.x = -e * 1.3; b.shL.rotation.x = e * 2.2; b.shR.rotation.x = e * 2.0;
      b.spine.rotation.x = e * .8; b.neck.rotation.x = -e * .4; b.head.rotation.x = -e * .3 + st.tw.x;
      b.uaL.rotation.set(-1.2 * e, 0, -.15); b.uaR.rotation.set(-1.25 * e, 0, .15); b.faL.rotation.x = -.2 * e; b.faR.rotation.x = -.2 * e;
    } else if (mode === 'weep') {
      // crouched low, face in the hands, shoulders shaking with sobs
      const sob = Math.max(0, Math.sin(T * 5.5 + c.seed)) * (Math.sin(T * .9) > -.3 ? 1 : .2);
      b.hips.position.y = .4; b.hips.rotation.x = .2;
      b.thL.rotation.set(-1.9, 0, -.2); b.thR.rotation.set(-1.9, 0, .2); b.shL.rotation.x = 2.5; b.shR.rotation.x = 2.5;
      b.spine.rotation.x = .85 + sob * .06; b.chest.rotation.x = .25; b.neck.rotation.x = .5; b.head.rotation.set(.45, 0, sob * .05);
      b.uaL.rotation.set(-1.3, 0, .35 + sob * .05); b.uaR.rotation.set(-1.3, 0, -.35 - sob * .05);
      b.faL.rotation.x = -2.0; b.faR.rotation.x = -2.0; b.haL.rotation.x = -.3; b.haR.rotation.x = -.3;
    } else if (mode === 'charge') {
      b.spine.rotation.x = .7; b.chest.rotation.x = .2; b.neck.rotation.x = -.5; b.head.rotation.x = -.2;
      b.uaL.rotation.set(.6, 0, -.3); b.uaR.rotation.set(.6, 0, .3); b.faL.rotation.x = -.6; b.faR.rotation.x = -.6;
    } else if (mode === 'daze') {
      const w = T * 3 + c.seed;
      b.spine.rotation.x = .2; b.chest.rotation.z = Math.sin(w) * .25; b.head.rotation.set(.5, Math.sin(w * 1.4) * .5, Math.sin(w) * .4);
      b.uaL.rotation.set(.1, 0, -.15); b.uaR.rotation.set(.1, 0, .15); b.faL.rotation.x = -.1; b.faR.rotation.x = -.1;
      b.hips.rotation.z = Math.sin(w) * .1;
    }
    // a flashlight in the eyes: one arm comes up, the head turns away
    if (s.shield) {
      b.uaL.rotation.set(-2.35, 0, .55); b.faL.rotation.x = -1.7; b.haL.rotation.x = -.3;
      b.head.rotation.y += .6; b.head.rotation.x += .25; b.spine.rotation.x -= .15;
    }
  }
  // attack swing overlay
  if (s.swing > 0 && mode !== 'scream') {
    const u = Math.min(1, s.swing), k2 = Math.sin(u * Math.PI);
    if (mode === 'crawl') { b.uaL.rotation.x -= k2 * .9; b.head.rotation.x -= k2 * .4; b.jaw.rotation.x = .2 + k2 * .8; }
    else if (s.atk === 1) {   // grab: both arms out wide, then clamping shut
      b.uaL.rotation.set(-1.55 - k2 * .15, 0, -.7 * (1 - u) + .15); b.uaR.rotation.set(-1.5 - k2 * .15, 0, .7 * (1 - u) - .15);
      b.faL.rotation.x = -.2 - u * .7; b.faR.rotation.x = -.2 - u * .7;
      b.spine.rotation.x += k2 * .35; b.jaw.rotation.x = .3 + k2 * .5;
    } else if (s.atk === 2) {   // bite: the head lunges forward, jaws wide
      b.spine.rotation.x += k2 * .5; b.chest.rotation.x += k2 * .2; b.neck.rotation.x += k2 * .3; b.head.rotation.x -= k2 * .5;
      b.jaw.rotation.x = .2 + k2 * 1.0;
      b.uaL.rotation.x = -1.3 - k2 * .4; b.uaR.rotation.x = -1.3 - k2 * .4; b.faL.rotation.x = -.6; b.faR.rotation.x = -.6;
    } else if (s.atk === 3) {   // smash: both fists up over the head and down
      const up = u < .45 ? u / .45 : 1 - (u - .45) / .55;
      b.uaL.rotation.set(-1.2 - up * 1.8, 0, -.2); b.uaR.rotation.set(-1.2 - up * 1.8, 0, .2);
      b.faL.rotation.x = -.4 - up * .5; b.faR.rotation.x = -.4 - up * .5;
      b.spine.rotation.x += (1 - up) * .55 - .1; b.jaw.rotation.x = .4;
    } else {   // swipe: the right arm sweeps across
      b.uaR.rotation.set(-1.45 - k2 * .8, 0, .95 - u * 1.5); b.faR.rotation.x = -.25 - k2 * .3;
      b.uaL.rotation.x = -1.3 - k2 * .3; b.chest.rotation.y -= (u - .5) * .9;
      b.spine.rotation.x += k2 * .2; b.jaw.rotation.x = .2 + k2 * .6;
    }
  }
  // hit flinch
  // ---- what is broken stays broken ----
  if (P.neckBreak) { b.neck.rotation.z += P.neckBreak.z * .4; b.head.rotation.z += P.neckBreak.z * .6; b.neck.rotation.x += P.neckBreak.x * .5; b.head.rotation.x += P.neckBreak.x * .4; }
  if (P.twist) { b.chest.rotation.y += P.twist; b.hips.rotation.y -= P.twist * .4; }
  if (P.badElbow && mode !== 'crawl') b['fa' + P.badElbow].rotation.x = .9 + Math.sin(T * 1.7 + c.seed) * .1;   // bent the wrong way
  if (P.badKnee && mode !== 'crawl' && mode !== 'weep' && mode !== 'feed') { b['sh' + P.badKnee].rotation.x = -.5; b['th' + P.badKnee].rotation.z += (P.badKnee === 'L' ? -1 : 1) * .25; }
  if (P.jawHang) { b.jaw.rotation.x = Math.max(b.jaw.rotation.x, P.jawHang.x); b.jaw.rotation.z = P.jawHang.z; }
  // ---- the head snaps round to look at you ----
  if (s.look) {
    const ly = Math.max(-1.6, Math.min(1.6, s.look.y)), lx = Math.max(-.6, Math.min(.6, s.look.x));
    b.neck.rotation.y += ly * .45; b.head.rotation.y += ly * .55; b.head.rotation.x += lx;
    if (Math.abs(s.look.y) > 1.6) b.chest.rotation.y += (s.look.y - ly) * .5;   // the body follows, too far
  }
  // ---- spasms: a sudden fit of jerks through the neck, chest and one arm ----
  st.spT = (st.spT ?? 2 + Math.random() * 4) - dt;
  if (st.spT <= 0 && P.spasm) { st.spasm = .2 + Math.random() * .3; st.spT = (s.alert ? 1.5 : 3) + Math.random() * 5 / (P.spasm * 4 + .5); }
  if (st.spasm > 0) {
    st.spasm -= dt;
    const j = () => (Math.random() - .5) * .7;
    b.neck.rotation.x += j(); b.neck.rotation.z += j(); b.head.rotation.y += j(); b.chest.rotation.z += j() * .5;
    const arm = c.seed % 2 ? 'R' : 'L'; b['ua' + arm].rotation.x += j(); b['fa' + arm].rotation.x += j();
  }
  // knocked off balance: reeling back, arms thrown out, knees giving
  if (s.stagger) {
    st.stag = Math.min(1, (st.stag || 0) + dt * 8);
  } else st.stag = Math.max(0, (st.stag || 0) - dt * 4);
  if (st.stag > 0) {
    const k = st.stag, back = st.hitBack ?? 1;
    b.spine.rotation.x -= .5 * k * back; b.chest.rotation.x -= .2 * k * back; b.head.rotation.x -= .45 * k * back;
    b.uaL.rotation.x = lerpN(b.uaL.rotation.x, .35, k); b.uaR.rotation.x = lerpN(b.uaR.rotation.x, .25, k);
    b.uaL.rotation.z -= .6 * k; b.uaR.rotation.z += .6 * k;
    b.hips.position.y -= .06 * k; b.shL.rotation.x += .4 * k; b.shR.rotation.x += .3 * k;
  }
  // hit reactions: thrown back by a shot from the front (forward from behind), twisted by
  // one from the side; a head shot snaps the head, an arm flies back, a leg buckles
  if (st.hit > 0) {
    const h = Math.min(1.2, st.hit) ** 2, back = st.hitBack ?? 1, side = st.hitSide ?? st.hitZ;
    switch (st.hitPart) {
      case 0: b.head.rotation.x -= h * 1.1 * back; b.neck.rotation.x -= h * .4 * back; b.head.rotation.z += h * side * .6; b.spine.rotation.x -= h * .2 * back; break;
      case 2: case 3: { const sd = st.hitPart === 2 ? 'L' : 'R'; b['ua' + sd].rotation.x += h * 1.4; b['ua' + sd].rotation.z += (sd === 'L' ? -1 : 1) * h * .7; b['fa' + sd].rotation.x -= h * .6; b.chest.rotation.y += (sd === 'L' ? 1 : -1) * h * .4; break; }
      case 4: case 5: { const sd = st.hitPart === 4 ? 'L' : 'R'; b.hips.position.y -= h * .12; b['th' + sd].rotation.x -= h * .6; b['sh' + sd].rotation.x += h * 1.0; b.hips.rotation.z += (sd === 'L' ? -1 : 1) * h * .2; b.spine.rotation.x += h * .3; break; }
      default: b.spine.rotation.x -= h * .55 * back; b.chest.rotation.x -= h * .25 * back; b.chest.rotation.z += h * side * .5; b.chest.rotation.y += h * side * .35; b.head.rotation.x -= h * .35 * back;
    }
  }
  // blown-off parts collapse to the joint
  const L = st.lost;
  b.head.scale.setScalar(L & 1 ? .001 : 1);
  b.faL.scale.setScalar(L & 2 ? .001 : 1);
  b.faR.scale.setScalar(L & 4 ? .001 : 1);
  b.thL.scale.setScalar(L & 8 ? .001 : 1);
  b.thR.scale.setScalar(L & 16 ? .001 : 1);
  if (P.noJaw) b.jaw.scale.setScalar(.001);
  if (P.swell) b['ua' + P.swell].scale.set(1.35, 1, 1.35);
}

// Two-bone arm IK: bend the upper arm and forearm of `side` ('L' / 'R') so the palm reaches `target`
// (world space). `pole` (world space, a direction) is where the elbow points. Bones hang along local −Y.
const DOWN = V(0, -1, 0), _q = new THREE.Quaternion(), _v = V(0, 0, 0), _w = V(0, 0, 0);
export function solveArmIK(c, side, target, pole) {
  const ua = c.bones['ua' + side], fa = c.bones['fa' + side], ha = c.bones['ha' + side];
  const L1 = fa.position.length(), L2 = ha.position.length() + .06;   // the palm sits a little past the wrist
  ua.parent.updateMatrixWorld(true);
  const S = ua.getWorldPosition(V(0, 0, 0));
  const toT = target.clone().sub(S);
  const d = Math.min(Math.max(toT.length(), Math.abs(L1 - L2) + .01), L1 + L2 - .001);
  const dir = toT.normalize();
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  const E = S.clone().addScaledVector(dir, a).addScaledVector(perp, h);
  const T = S.clone().addScaledVector(dir, d);
  // upper arm: point local −Y at the elbow, expressed in the chest's space
  ua.parent.getWorldQuaternion(_q).invert();
  _v.copy(E).sub(S).normalize().applyQuaternion(_q);
  ua.quaternion.setFromUnitVectors(DOWN, _v);
  ua.updateMatrixWorld(true);
  // forearm: point at the palm from the elbow, in the upper arm's space
  ua.getWorldQuaternion(_q).invert();
  _w.copy(T).sub(E).normalize().applyQuaternion(_q);
  fa.quaternion.setFromUnitVectors(DOWN, _w);
  fa.updateMatrixWorld(true);
  ha.rotation.set(0, 0, 0);
}

// Fall over once killed. variant: 0 backwards, 1 forwards, 2 crumple sideways.
export function poseDeath(c, t, variant, crawled) {
  const b = c.bones, m = c.mesh;
  const k = Math.min(1, t / .7), e = k * k * (3 - 2 * k);
  if (crawled) { m.position.y = 0; return; }
  if (variant === 0) {
    m.rotation.x = -e * 1.5; b.thL.rotation.x = -e * .5; b.shL.rotation.x = e * .7; b.uaL.rotation.x = -2.6 * e; b.uaR.rotation.x = -2.2 * e;
    b.head.rotation.x = -.5 * e; b.jaw.rotation.x = .6;
  } else if (variant === 1) {
    m.rotation.x = e * 1.45; b.uaL.rotation.x = -2.8 * e; b.uaR.rotation.x = -2.9 * e; b.head.rotation.y = .8 * e; b.shR.rotation.x = e * .8;
  } else if (variant === 3) {
    // the knees go first, then it pitches forward onto its face
    const k1 = Math.min(1, t / .4), k2 = Math.max(0, Math.min(1, (t - .35) / .5)), e2 = k2 * k2 * (3 - 2 * k2);
    b.hips.position.y = c.bind.hips.y - k1 * .45; b.thL.rotation.x = -1.4 * k1; b.thR.rotation.x = -1.3 * k1; b.shL.rotation.x = 2.1 * k1; b.shR.rotation.x = 2.0 * k1;
    m.rotation.x = e2 * 1.2; m.position.y = -e2 * .15; b.uaL.rotation.x = -.3; b.uaR.rotation.x = -.2; b.head.rotation.y = .6 * e2;
  } else if (variant === 4) {
    // spun round by the hit, falling sideways
    m.rotation.y = e * 1.7; m.rotation.z = Math.max(0, (k - .3) / .7) * 1.4; b.thL.rotation.x = -.5 * e; b.shL.rotation.x = .9 * e;
    b.uaL.rotation.set(-1.6 * e, 0, -.6 * e); b.uaR.rotation.x = -.4 * e; b.head.rotation.z = .5 * e;
  } else {
    b.hips.position.y = c.bind.hips.y * (1 - e * .7);
    b.thL.rotation.x = -1.4 * e; b.shL.rotation.x = 2.3 * e; b.thR.rotation.x = -1.2 * e; b.shR.rotation.x = 2.1 * e;
    m.rotation.z = Math.max(0, (k - .5) * 2) * 1.35; b.spine.rotation.x = .6 * e;
    b.uaL.rotation.x = -.4; b.uaR.rotation.x = -.2;
  }
}

// ---------- hellhound ----------
export function buildDog(seed, material, extras = {}) {
  const r = rng(seed + 5);
  const names = ['root', 'hips', 'chest', 'neck', 'head', 'jaw', 'flU', 'flL', 'frU', 'frL', 'blU', 'blL', 'brU', 'brL', 'tail', 'tail2'];
  const parent = { hips: 'root', chest: 'hips', neck: 'chest', head: 'neck', jaw: 'head', flU: 'chest', flL: 'flU', frU: 'chest', frL: 'frU', blU: 'hips', blL: 'blU', brU: 'hips', brL: 'brU', tail: 'hips', tail2: 'tail' };
  const local = {
    root: V(0, 0, 0), hips: V(0, .58, -.34), chest: V(0, .04, .64), neck: V(0, .1, .12), head: V(0, .14, .12), jaw: V(0, -.04, .06),
    flU: V(-.11, -.06, .02), flL: V(0, -.27, .03), frU: V(.11, -.06, .02), frL: V(0, -.27, .03),
    blU: V(-.12, -.04, 0), blL: V(0, -.28, -.05), brU: V(.12, -.04, 0), brL: V(0, -.28, -.05),
    tail: V(0, .05, -.12), tail2: V(0, .06, -.22)
  };
  const bones = {}, list = [], I = {};
  names.forEach((n, i) => { const b = new THREE.Bone(); b.name = n; b.position.copy(local[n]); bones[n] = b; list.push(b); I[n] = i; });
  names.forEach(n => { if (parent[n]) bones[parent[n]].add(bones[n]); });
  bones.root.updateMatrixWorld(true);
  const wp = n => bones[n].getWorldPosition(new THREE.Vector3());
  const mb = new MeshBuilder(true), full = [0, 1, 1, 0];
  const hips = wp('hips'), chest = wp('chest');
  mb.tube({ a: hips.clone().add(V(0, 0, -.12)), b: chest.clone().add(V(0, .02, .14)), radii: [.1, .14, .15, .16, .19, .17, .12], sx: .85, sz: 1.1, seg: 8, uv: full, wobble: .15, rnd: r,
    weight: t => [[I.hips, 1 - t], [I.chest, t]] });
  const neck = wp('neck'), head = wp('head');
  mb.tube({ a: chest.clone().add(V(0, .04, .06)), b: head, radii: [.11, .09, .08], seg: 6, uv: full, weight: Wseg(I.chest, I.neck, I.head, .4), capA: false });
  mb.tube({ a: head.clone().add(V(0, .01, -.08)), b: head.clone().add(V(0, -.02, .27)), radii: [.08, .11, .1, .07, .05, .035], sx: .95, sz: .9, seg: 7, uv: full, weight: W1(I.head), wobble: .1, rnd: r });
  const jaw = wp('jaw');
  mb.tube({ a: jaw.clone().add(V(0, 0, -.04)), b: jaw.clone().add(V(0, -.02, .2)), radii: [.06, .05, .035, .02], sx: .9, sz: .55, seg: 6, uv: full, weight: W1(I.jaw) });
  for (const s of [-1, 1]) mb.tube({ a: head.clone().add(V(s * .06, .08, -.02)), b: head.clone().add(V(s * .08, .2, -.06)), radii: [.035, .02, .002], seg: 4, uv: full, weight: W1(I.head), capA: false });
  for (const L of ['fl', 'fr', 'bl', 'br']) {
    const u = wp(L + 'U'), l = wp(L + 'L'), paw = l.clone().add(V(0, -.26, L[0] === 'b' ? .03 : 0));
    mb.tube({ a: u.clone().add(V(0, .08, 0)), b: l, radii: [.07, .06, .045], seg: 6, uv: full, weight: Wseg(L[0] === 'f' ? I.chest : I.hips, I[L + 'U'], I[L + 'L'], .3) });
    mb.tube({ a: l, b: paw, radii: [.04, .03, .03, .04], seg: 5, uv: full, weight: W1(I[L + 'L']) });
  }
  const tl = wp('tail'), t2 = wp('tail2');
  mb.tube({ a: tl, b: t2, radii: [.04, .03], seg: 4, uv: full, weight: W1(I.tail), capA: false });
  mb.tube({ a: t2, b: t2.clone().add(V(0, .05, -.2)), radii: [.03, .015, .002], seg: 4, uv: full, weight: W1(I.tail2), capA: false });
  const mesh = new THREE.SkinnedMesh(mb.geometry(), material);
  mesh.add(bones.root); mesh.bind(new THREE.Skeleton(list)); mesh.frustumCulled = false;
  const group = new THREE.Group(); group.add(mesh);
  const eyes = [];
  if (extras.glowMat) for (const s of [-1, 1]) { const sp = new THREE.Sprite(extras.glowMat); sp.scale.set(.1, .1, 1); sp.position.set(s * .05, .06, .14); bones.head.add(sp); eyes.push(sp); }
  const hit = [];
  const hb = (bone, w, h, d, oz, part) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat); m.position.z = oz; m.userData.part = part; bones[bone].add(m); hit.push(m); };
  hb('head', .2, .2, .34, .1, 0); hb('hips', .3, .32, .5, .2, 1); hb('chest', .3, .34, .4, 0, 1);
  hb('flU', .1, .5, .1, 0, 4); hb('frU', .1, .5, .1, 0, 5); hb('blU', .1, .5, .1, 0, 4); hb('brU', .1, .5, .1, 0, 5);
  const bind = {}; for (const n of names) bind[n] = bones[n].position.clone();
  return { kind: 'dog', group, mesh, bones, bind, eyes, stumps: {}, hit, seed, st: { phase: 0, hit: 0, hitZ: 0, lost: 0 } };
}
export function poseDog(c, dt, s) {
  const b = c.bones, st = c.st;
  for (const n in b) b[n].rotation.set(0, 0, 0);
  b.hips.position.copy(c.bind.hips);
  st.phase += dt * (s.speed / 1.7 + .3) * Math.PI * 2;
  const ph = st.phase, A = Math.min(1, s.speed / 4);
  b.flU.rotation.x = Math.sin(ph) * .8 * A; b.frU.rotation.x = Math.sin(ph + .4) * .8 * A;
  b.flL.rotation.x = -Math.max(0, Math.sin(ph + 1)) * .9 * A; b.frL.rotation.x = -Math.max(0, Math.sin(ph + 1.4)) * .9 * A;
  b.blU.rotation.x = Math.sin(ph + Math.PI) * .8 * A; b.brU.rotation.x = Math.sin(ph + Math.PI + .4) * .8 * A;
  b.blL.rotation.x = Math.max(0, Math.sin(ph + Math.PI + 1)) * .9 * A; b.brL.rotation.x = Math.max(0, Math.sin(ph + Math.PI + 1.4)) * .9 * A;
  b.hips.rotation.x = Math.sin(ph * 2) * .08 * A;
  b.hips.position.y += Math.abs(Math.sin(ph)) * .06 * A;
  b.neck.rotation.x = .3 + Math.sin(ph * 2) * .1 * A; b.head.rotation.x = -.35;
  b.jaw.rotation.x = .25 + (s.swing > 0 ? Math.sin(s.swing * Math.PI) * .7 : Math.abs(Math.sin(s.t * 6)) * .2);
  b.tail.rotation.x = -.6 + Math.sin(ph) * .2; b.tail.rotation.y = Math.sin(s.t * 9) * .3;
  if (s.swing > 0) { b.chest.rotation.x = -Math.sin(s.swing * Math.PI) * .4; b.neck.rotation.x -= .4; }
  if (st.hit > 0) { st.hit = Math.max(0, st.hit - dt * 4); b.chest.rotation.z = st.hit * .4; }
}
export function poseDogDeath(c, t) {
  const k = Math.min(1, t / .5);
  c.mesh.rotation.z = k * 1.45;
  c.bones.flU.rotation.x = .6 * k; c.bones.blU.rotation.x = -.6 * k; c.bones.jaw.rotation.x = .8;
}

// Static (non-skinned) chunk thrown off when a limb is shot away.
export function buildGib(part, material) {
  const mb = new MeshBuilder(false);
  if (part === 'head') mb.tube({ a: V(0, -.12, 0), b: V(0, .14, 0), radii: [.07, .11, .12, .1, .05, 0], seg: 7, uv: atlasUV('head'), weight: W1(0), capB: false, wobble: .1 });
  else if (part === 'armL' || part === 'armR') mb.tube({ a: V(0, .15, 0), b: V(0, -.18, 0), radii: [.05, .045, .035, .04], seg: 6, uv: atlasUV('fore'), weight: W1(0) });
  else mb.tube({ a: V(0, .4, 0), b: V(0, -.4, 0), radii: [.09, .08, .06, .05, .05], seg: 6, uv: atlasUV('legs'), weight: W1(0) });
  return new THREE.Mesh(mb.geometry(), material);
}
