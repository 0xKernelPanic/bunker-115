// Keeps one animated character per zombie / dog / teammate in sync with interpolated snapshots.
import * as THREE from 'three';
import { lam, basic } from './psx.js';
import { characterAtlas, dogAtlas, stalkerAtlas, labelTex } from './textures.js';
import { buildHumanoid, poseHumanoid, poseDeath, buildDog, poseDog, poseDogDeath, buildGib, solveArmIK } from './rig.js';
import { buildGun } from './guns.js';
import { COL } from './fx.js';
import { ZFLAG, PARTS, ATK_SHIFT } from '../../shared/sim.js';
import { R, rng } from '../../shared/util.js';

const HITC = new THREE.Color(0x6a0000), BLACK = new THREE.Color(0);

export class Entities {
  // helmets: how many of the dead still wear one (miners mostly do)
  constructor(scene, TX, fx, GMw, clothes, helmets) {
    this.scene = scene; this.fx = fx; this.TX = TX; this.GMw = GMw;
    // each map dresses its dead differently: soldiers, patients, servants
    this.atlases = {
      walker: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(s => characterAtlas('walker', s, clothes ? { uniform: clothes[s % clothes.length].top, pants: clothes[(s + (s > 4 ? 1 : 0)) % clothes.length].pants, style: clothes[s % clothes.length].style } : { style: 'uniform' })),
      thin: [0, 1, 2].map(s => characterAtlas('thin', s + 10)),
      bloater: [0, 1].map(s => characterAtlas('bloater', s + 20)),
      screamer: [0, 1].map(s => characterAtlas('screamer', s + 30)),
      brute: [0, 1].map(s => characterAtlas('brute', s + 40)),
      weeper: [0].map(s => characterAtlas('weeper', s + 50))
    };
    this.gibMats = {};
    this.stalkerTex = stalkerAtlas();
    const da = dogAtlas(); this.dogTex = da;
    this.extras = {
      eyeGeo: new THREE.BoxGeometry(.035, .02, .01),
      stumpMat: lam(null, { color: 0x5a0a06 }), helmet: lam(TX.rust), cleaverMat: lam(null, { color: 0x8a8c90 }), helmetGeo: new THREE.SphereGeometry(.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2)
    };
    this.soldierHelmet = lam(null, { color: 0x3e4a2a });
    if (helmets !== undefined) this.extras.helmetChance = helmets;
    // the dead have milky eyes painted on; only the thin ones catch the light, faintly
    this.paleEyes = { eyeMat: basic({ color: 0xb8c4b8 }), glowMat: new THREE.SpriteMaterial({ map: TX.glowEye, color: 0x8090a0, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }) };
    this.dogEyes = { glowMat: new THREE.SpriteMaterial({ map: TX.glowEye, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }) };
    this.z = new Map(); this.corpses = []; this.players = new Map();
  }
  // An old oil lantern hanging from the Matron's left hand. Its light is one shared PointLight
  // owned by the game (so the shader never changes); this is the lamp and its glow.
  addLantern(c) {
    const L = new THREE.Group(), metal = this.extras.cleaverMat, dark = lam(null, { color: 0x1c1a16 });
    const glass = basic({ color: 0xffc070 });
    const box = (w, h, d, y, m) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.y = y; L.add(k); return k; };
    box(.11, .02, .11, -.13, dark); box(.08, .1, .08, -.07, glass); box(.1, .03, .1, 0, dark); box(.04, .03, .04, .03, dark);
    for (const [x, z] of [[-.045, -.045], [.045, -.045], [-.045, .045], [.045, .045]]) { const k = new THREE.Mesh(new THREE.BoxGeometry(.01, .12, .01), metal); k.position.set(x, -.07, z); L.add(k); }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.04, .006, 4, 8, Math.PI), metal); handle.position.y = .05; L.add(handle);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.TX.glowWhite, color: 0xffa040, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    glow.scale.set(.7, .7, 1); glow.position.y = -.07; L.add(glow);
    L.position.set(0, -.12, .02);
    c.bones.haL.add(L);
    c.lantern = { group: L, glow, glass, lit: 1 };
  }
  // keep the lantern hanging straight down whatever the arm does; dim it while she is down
  updateLantern(c, dt, time, down) {
    const ln = c.lantern; if (!ln) return;
    c.group.updateMatrixWorld(true);
    ln.group.quaternion.copy(c.bones.haL.getWorldQuaternion(new THREE.Quaternion()).invert());
    // on the last night every fall leaves the flame lower (lampMax is set by the game)
    ln.lit += ((down ? 0 : this.lampMax ?? 1) - ln.lit) * Math.min(1, dt * (down ? 6 : 1.5));
    const f = ln.lit * (.82 + Math.sin(time * 13.1) * .06 + Math.sin(time * 7.3 + 1) * .08 + (Math.random() < .03 ? -.3 : 0));
    ln.flame = Math.max(0, f);
    ln.glow.material.opacity = ln.flame; ln.glow.visible = ln.flame > .02;
    ln.glass.color.setRGB(1 * Math.max(.15, ln.flame), .75 * Math.max(.12, ln.flame), .44 * Math.max(.1, ln.flame));
  }
  // where the lantern is and how bright, for the game's lantern light (null when there is no Matron)
  lanternState() {
    for (const c of this.z.values()) if (c.lantern) return { pos: c.lantern.glow.getWorldPosition(new THREE.Vector3()), flame: c.lantern.flame || 0 };
    return null;
  }
  atlasFor(type, id) {
    const k = type === 'crawler' ? 'walker' : type;
    const list = this.atlases[k] || this.atlases.walker;
    return list[id % list.length];
  }
  makeZombie(id, type) {
    let c;
    if (type === 'dog') {
      const m = lam(this.dogTex.map, { skinning: true, emissive: 0xffffff, emissiveMap: this.dogTex.emissive });
      c = buildDog(id, m, Object.assign({}, this.extras, this.dogEyes));
    } else if (type === 'stalker') {
      c = buildHumanoid('stalker', id, lam(this.stalkerTex, { skinning: true }), this.extras);
      c.tex = this.stalkerTex;
      c.group.scale.setScalar(1.08);
      this.addLantern(c);
    } else {
      const tex = this.atlasFor(type, id);
      const m = lam(tex, { skinning: true });
      c = buildHumanoid(type === 'crawler' ? 'walker' : type, id, m, this.extras);   // eyes are painted, deep in the sockets
      c.tex = tex;
      // not everyone was the same height
      const hr = rng(id * 13 + 7)();
      c.group.scale.setScalar(type === 'bloater' ? 1 + hr * .06 : type === 'brute' ? 1.18 + hr * .06 : type === 'weeper' ? .95 : .92 + hr * .16);
    }
    c.mat = c.mesh.material;
    c.group.rotation.order = 'YXZ';
    c.type = type; c.id = id;
    for (const h of c.hit) h.userData.zid = id;
    c.last = null; c.speed = 0; c.swingT = 0; c.prevSwing = false; c.flashT = 0;
    this.scene.add(c.group);
    return c;
  }
  // zs: [{id,type,x,z,y,rot,state,lost,flags}] already interpolated
  // eye: where the player is looking from (the dead turn their heads to it)
  sync(zs, dt, time, eye) {
    const seen = new Set();
    for (const s of zs) {
      seen.add(s.id);
      let c = this.z.get(s.id);
      if (!c) { c = this.makeZombie(s.id, s.type); this.z.set(s.id, c); c.group.position.set(s.x, s.y, s.z); c.group.rotation.y = s.rot; }
      const g = c.group;
      const sp = dt > 0 ? Math.hypot(s.x - g.position.x, s.z - g.position.z) / dt : 0;
      c.speed += (Math.min(sp, 8) - c.speed) * Math.min(1, dt * 6);
      g.position.set(s.x, s.y, s.z); g.rotation.y = s.rot;
      const swing = !!(s.flags & ZFLAG.swing);
      if (swing && !c.prevSwing) c.swingT = .001;
      c.prevSwing = swing;
      if (c.swingT > 0) { c.swingT += dt; if (c.swingT > .45) c.swingT = 0; }
      if (c.st.lost !== s.lost) this.applyLost(c, s.lost);
      c.flashT = Math.max(0, c.flashT - dt);
      if (c.mat.emissive && c.type !== 'dog') c.mat.emissive.copy(c.flashT > 0 ? HITC : BLACK);
      if (c.type === 'dog') { poseDog(c, dt, { speed: c.speed, t: time, swing: c.swingT / .45 }); continue; }
      const state = s.state;
      if (state !== c.lastState) { c.stateT = 0; c.lastState = state; }
      c.stateT = (c.stateT || 0) + dt;
      for (const e of c.eyes) e.visible = state !== 'dormant' && state !== 'stun';
      // ceiling crawlers lie flat against the ceiling, face down, and swing upright as they drop
      g.rotation.x = state === 'ceiling' ? Math.PI / 2 : state === 'drop' ? Math.PI / 2 * Math.max(0, 1 - c.stateT / .45) : 0;
      if (state === 'dormant' || state === 'wake' || state === 'stun') {
        poseHumanoid(c, dt, { mode: 'walk', speed: 0, t: time, swing: 0 });
        const variant = c.seed % 2;
        if (state === 'dormant') poseDeath(c, 1, variant, false);
        else if (state === 'wake') poseDeath(c, .7 * Math.max(0, 1 - c.stateT / 1.5), variant, false);
        else poseDeath(c, Math.min(.7, c.stateT * 1.5), 2, false);
        this.updateLantern(c, dt, time, true);
        continue;
      }
      // some of them move in jerks, like stop-motion: the pose only changes a few times a second
      const P = c.P;
      c.poseAcc = (c.poseAcc || 0) + dt;
      if (P && P.choppy && c.posed && c.poseAcc < 1 / P.choppy) { this.updateLantern(c, dt, time, false); continue; }
      const pdt = c.poseAcc; c.poseAcc = 0; c.posed = true;
      // the head snaps round to you: it sees you, or you are close and in front of it
      let look = null;
      if (eye && !['dormant', 'ceiling', 'weep', 'feed', 'stun', 'tear', 'climb', 'rise', 'trip'].includes(state)) {
        const dx = eye.x - s.x, dz = eye.z - s.z, d = Math.hypot(dx, dz), a = s.rot;
        const lz = dx * Math.sin(a) + dz * Math.cos(a), lx = dx * Math.cos(a) - dz * Math.sin(a), rel = Math.atan2(lx, lz);
        if ((s.flags & ZFLAG.alert) || (d < 8 && Math.cos(rel) > .1)) look = { y: rel, x: Math.atan2(1.55 * c.group.scale.y - eye.y, Math.max(d, .5)) * .8 };
      }
      c.lookT = (c.lookT || 0) - pdt;
      if (c.lookT <= 0 || (!look) !== (!c.lookNow)) { c.lookT = .25 + Math.random() * .9; c.lookNow = look; }
      let mode = 'walk';
      if (state === 'feed') { mode = 'feed'; if (!c.food) this.addFood(c); }
      else if (state === 'trip' || state === 'weep' || state === 'charge' || state === 'daze') mode = state;
      else if (state === 'howl') mode = 'scream';
      else if ((state === 'rush' || state === 'flee') && c.speed > 1.6) mode = 'run';
      else if (state === 'rise') mode = 'rise';
      else if (state === 'tear') mode = 'tear';
      else if (state === 'ceiling') mode = 'ceiling';
      else if (state === 'climb') mode = (s.flags & ZFLAG.crawl) ? 'crawl' : 'climb';
      else if (s.flags & ZFLAG.crawl) mode = 'crawl';
      else if (s.flags & ZFLAG.scream) mode = 'scream';
      else if ((s.flags & ZFLAG.run) && c.speed > 1.6) mode = 'run';
      poseHumanoid(c, pdt, { mode, speed: c.speed, t: time, swing: c.swingT / .45, look: c.lookNow, alert: !!(s.flags & ZFLAG.alert), atk: (s.flags >> ATK_SHIFT) & 3, shield: !!(s.flags & ZFLAG.shield), stagger: !!(s.flags & ZFLAG.stagger), k: c.stateT / 1.8 });
      this.updateLantern(c, dt, time, false);
    }
    for (const [id, c] of this.z) if (!seen.has(id)) { this.scene.remove(c.group); this.z.delete(id); }
    // corpses
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const k = this.corpses[i]; k.t += dt;
      if (k.c.type === 'dog') poseDogDeath(k.c, k.t);
      else { poseHumanoid(k.c, 0, { mode: k.crawl ? 'crawl' : 'walk', speed: 0, t: time, swing: 0 }); poseDeath(k.c, k.t, k.variant, k.crawl); }
      if (k.t > 4) k.c.group.position.y -= dt * .35;
      if (k.t > 6) { this.scene.remove(k.c.group); this.corpses.splice(i, 1); }
    }
  }
  applyLost(c, lost) {
    const add = lost & ~c.st.lost;
    c.st.lost = lost;
    for (const [bit, part] of [[1, 'head'], [2, 'armL'], [4, 'armR'], [8, 'legL'], [16, 'legR']]) {
      const on = !!(lost & bit);
      if (c.stumps[part]) c.stumps[part].visible = on;
      if (on) for (const h of c.hit) if (h.userData.part === PARTS.indexOf(part)) h.userData.dead = true;
      if (add & bit) this.spawnGib(c, part);
    }
  }
  spawnGib(c, part) {
    if (c.type === 'dog' || !c.tex) return;
    const key = c.tex.uuid;
    if (!this.gibMats[key]) this.gibMats[key] = lam(c.tex);
    const bone = { head: 'head', armL: 'faL', armR: 'faR', legL: 'thL', legR: 'thR' }[part];
    const p = c.bones[bone].getWorldPosition(new THREE.Vector3());
    if (part.startsWith('leg')) p.y -= .35; else if (part.startsWith('arm')) p.y -= .15;
    const m = buildGib(part, this.gibMats[key]);
    const out = new THREE.Vector3(R(-1, 1), 0, R(-1, 1)).normalize();
    this.fx.gib(m, p, new THREE.Vector3(out.x * R(1.5, 3), R(2, 4.5), out.z * R(1.5, 3)));
    this.fx.emit(p, part === 'head' ? 34 : 20, COL.blood, part === 'head' ? 3 : 2.2, 9, .9);
  }
  // dir: the direction the shot travelled, so the body reacts to where it came from
  hit(zid, part, point, dir) {
    const c = this.z.get(zid); if (!c) return;
    c.st.hit = Math.min(1.4, c.st.hit + 1); c.st.hitZ = R(-1, 1); c.flashT = .06; c.st.hitPart = part;
    if (dir) {
      const a = c.group.rotation.y, fx = Math.sin(a), fz = Math.cos(a);
      c.st.hitBack = -(dir.x * fx + dir.z * fz); c.st.hitSide = dir.x * fz - dir.z * fx;
    } else { c.st.hitBack = 1; c.st.hitSide = c.st.hitZ; }
    if (point) this.fx.emit(point, 7, COL.blood, 1.6, 9, .5);
  }
  kill(e) {
    const c = this.z.get(e.z); if (!c) return;
    this.z.delete(e.z);
    for (const h of c.hit) h.userData.dead = true;
    const pos = c.group.position.clone();
    if (e.lost !== c.st.lost) this.applyLost(c, e.lost);
    if (c.type === 'dog') {
      this.fx.explosion(pos.clone().setY(.6), 1.5, 'fire');
      this.scene.remove(c.group);
      return;
    }
    if (e.cls === 'explosive' || e.cls === 'nuke' && Math.random() < .5) {
      for (const p of ['armL', 'armR', 'legL', 'legR']) if (Math.random() < .5 && !(c.st.lost & { armL: 2, armR: 4, legL: 8, legR: 16 }[p])) { c.st.lost |= { armL: 2, armR: 4, legL: 8, legR: 16 }[p]; this.spawnGib(c, p); if (c.stumps[p]) c.stumps[p].visible = true; }
      this.fx.emit(pos.clone().setY(1), 30, COL.blood, 3, 9, .8);
    }
    if (e.cls === 'trap') { c.mat.emissive && c.mat.emissive.setHex(0x3050a0); this.fx.emit(pos.clone().setY(1.2), 25, COL.spark, 3, 4, .5); }
    if (e.cls === 'nuke') c.mat.emissive && c.mat.emissive.setHex(0x402010);
    // the Matron's lantern falls from her hand, rolls a little and goes out
    if (c.lantern) {
      const ln = c.lantern, at = ln.group.getWorldPosition(new THREE.Vector3());
      c.bones.haL.remove(ln.group); this.scene.add(ln.group);
      ln.group.position.set(at.x + .35, .12, at.z + .2); ln.group.rotation.set(0, 0, Math.PI / 2);
      ln.glass.color.setRGB(.15, .12, .1);
      let f = 1; const out = () => { f -= .04; ln.glow.material.opacity = Math.max(0, f) * (.6 + Math.random() * .4); ln.glow.visible = f > 0; if (f > 0) setTimeout(out, 60); };
      out();
      c.lantern = null;
    }
    const crawl = !!(c.st.lost & 24);
    this.corpses.push({ c, t: 0, variant: rng(e.z)() * 5 | 0, crawl });
    if (this.corpses.length > 14) { const o = this.corpses.shift(); this.scene.remove(o.c.group); }
  }
  // the body a feeder kneels over: a dead walker that never gets up, left behind afterwards
  addFood(c) {
    const body = this.makeZombie(90000 + c.id, 'walker');
    for (const h of body.hit) h.userData.dead = true;
    for (const e of body.eyes) e.visible = false;
    poseHumanoid(body, 0, { mode: 'walk', speed: 0, t: 0, swing: 0 });
    poseDeath(body, 1, 0, false);
    const a = c.group.rotation.y;
    body.group.position.set(c.group.position.x + Math.sin(a) * .75, 0, c.group.position.z + Math.cos(a) * .75);
    body.group.rotation.y = a + Math.PI / 2;
    c.food = body;
    this.fx.emit(body.group.position.clone().setY(.2), 10, COL.blood, .8, 6, .6);
  }
  hitTargets() {
    const out = [];
    for (const c of this.z.values()) for (const h of c.hit) if (!h.userData.dead) out.push(h);
    return out;
  }
  zombieView(id) { return this.z.get(id); }

  // ---------- teammates ----------
  syncPlayers(ps, meId, dt, time) {
    const seen = new Set();
    for (const p of ps) {
      if (p.id === meId) continue;
      seen.add(p.id);
      let v = this.players.get(p.id);
      if (!v) v = this.makePlayer(p);
      const g = v.c.group;
      const sp = dt > 0 ? Math.hypot(p.x - g.position.x, p.z - g.position.z) / dt : 0;
      v.speed += (Math.min(sp, 8) - v.speed) * Math.min(1, dt * 6);
      g.visible = p.st !== 'x' && p.st !== 'e';
      g.position.set(p.x, p.y, p.z); g.rotation.y = p.yaw + Math.PI;
      if (v.gunId !== (p.w[p.cur] && p.w[p.cur].id)) this.setPlayerGun(v, p.w[p.cur]);
      this.poseTeammate(v, p, dt, time);
      v.label.position.set(p.x, p.st === 'd' ? .9 : 2.15, p.z);
      v.label.visible = p.st !== 'x' && p.st !== 'e';
      v.reviveIcon.visible = p.st === 'd';
      v.reviveIcon.position.set(p.x, 1.4 + Math.sin(time * 4) * .08, p.z);
    }
    for (const [id, v] of this.players) if (!seen.has(id)) { this.scene.remove(v.c.group, v.label, v.reviveIcon); this.players.delete(id); }
  }
  // Legs and body from the soldier pose; the gun follows the aim, and both hands are bent onto it.
  poseTeammate(v, p, dt, time) {
    const c = v.c, aim = v.aim;
    if (p.st === 'd') {
      poseHumanoid(c, dt, { mode: 'soldier', speed: 0, t: time, pitch: 0 });
      c.mesh.rotation.x = -1.35; c.mesh.position.y = .15;
      aim.visible = false;
      return;
    }
    c.mesh.rotation.x = 0; c.mesh.position.y = 0;
    poseHumanoid(c, dt, { mode: 'soldier', speed: v.speed, t: time, pitch: p.pitch, sprint: p.sp });
    aim.visible = !!v.gun;
    if (!v.gun) return;
    // blend between hip, aiming down the sights, low ready (sprint) and a tilted reload
    const k = Math.min(1, dt * 10), want = { sp: p.sp ? 1 : 0, ads: p.ads && !p.sp ? 1 : 0, rl: p.rl && !p.sp ? 1 : 0 };
    for (const n in want) v.blend[n] += (want[n] - v.blend[n]) * k;
    const B = v.blend, pitch = p.pitch || 0;
    aim.position.set(.02 - B.ads * .1, 1.36 + B.ads * .1, .04);
    aim.rotation.set(-pitch * (1 - B.sp) + B.sp * .75 + B.rl * .35, B.sp * .55, B.rl * .5, 'YXZ');
    const g = v.gun, [grip, support] = g.userData.hold, pistol = !support;
    const want0 = pistol ? [.06, -.06, .42] : [.13, -.13 + B.ads * .03, .3];
    g.position.set(want0[0] + grip[0], want0[1] - grip[1], want0[2] + grip[2]);   // the gun is turned 180° about y
    c.group.updateMatrixWorld(true);
    const toWorld = a => g.localToWorld(new THREE.Vector3(a[0], a[1], a[2]));
    const gq = c.group.getWorldQuaternion(new THREE.Quaternion());
    const pole = x => new THREE.Vector3(x, -1, -.25).applyQuaternion(gq);
    solveArmIK(c, 'R', toWorld(grip), pole(.8));
    const mag = g.userData.mag && g.userData.mag[0];
    const left = B.rl > .5 && mag ? mag.getWorldPosition(new THREE.Vector3())
      : pistol ? toWorld([grip[0] + .05, grip[1] + .01, grip[2] - .03]) : toWorld(support);
    solveArmIK(c, 'L', left, pole(-.8));
  }
  makePlayer(p) {
    const hex = p.color || '#e9c46a';
    const tex = characterAtlas('soldier', p.id.length * 7 + p.id.charCodeAt(p.id.length - 1), { uniform: [70, 76, 52], pants: [58, 62, 46], patch: hex });
    const c = buildHumanoid('soldier', 3, lam(tex, { skinning: true }), { helmet: this.soldierHelmet, helmetGeo: this.extras.helmetGeo });
    this.scene.add(c.group);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(p.name, hex), transparent: true, depthWrite: false, fog: false }));
    label.scale.set(1.1, .2, 1); this.scene.add(label);
    const reviveIcon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.TX.glowWhite, color: 0xff4040, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    reviveIcon.scale.set(.5, .5, 1); reviveIcon.visible = false; this.scene.add(reviveIcon);
    const aim = new THREE.Group(); c.group.add(aim);
    const v = { c, label, reviveIcon, speed: 0, gun: null, gunId: null, aim, blend: { sp: 0, ads: 0, rl: 0 } };
    this.players.set(p.id, v);
    return v;
  }
  setPlayerGun(v, w) {
    if (v.gun) v.aim.remove(v.gun);
    v.gunId = w && w.id;
    v.gun = null;
    if (!w) return;
    v.gun = buildGun(w.id, this.GMw);
    v.gun.rotation.set(0, Math.PI, 0);
    v.aim.add(v.gun);
  }
  playerMuzzle(id) {
    const v = this.players.get(id); if (!v || !v.gun) return null;
    return v.gun.localToWorld(new THREE.Vector3(0, 0, v.gun.userData.muzzle || -.3));
  }
  playerHead(id) {
    const v = this.players.get(id); if (!v) return null;
    return v.c.bones.head.getWorldPosition(new THREE.Vector3());
  }
}
