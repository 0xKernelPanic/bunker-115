// Particles, tracers, flying limbs, explosions, gas clouds and lightning.
import * as THREE from 'three';
import { R } from '../../shared/util.js';

export const COL = { blood: [.5, .02, .01], dust: [.45, .42, .36], wood: [.5, .36, .2], green: [.5, 1, .35], fire: [1, .55, .15], ice: [.7, .9, 1], spark: [.7, .85, 1], gas: [.45, .7, .2], dirt: [.25, .2, .14] };

export class FX {
  constructor(scene, TX) {
    this.scene = scene; this.TX = TX;
    const N = this.N = 1400;
    this.pPos = new Float32Array(N * 3); this.pCol = new Float32Array(N * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.pGeo = g;
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true }));
    pts.frustumCulled = false; scene.add(pts);
    this.parts = []; for (let i = 0; i < N; i++) { this.parts.push({ life: 0, vx: 0, vy: 0, vz: 0, g: 9 }); this.pPos[i * 3 + 1] = -999; }
    this.pi = 0;
    this.tracers = []; this.gibs = []; this.sprites = [];
    this.light = new THREE.PointLight(0xffa040, 0, 12, 1.5); scene.add(this.light);
    this.lightT = 0;
    this.flash = 0;
  }
  emit(p, n, col, speed, grav = 9, life = .6, up = 1) {
    for (let i = 0; i < n; i++) {
      const k = this.pi; this.pi = (this.pi + 1) % this.N;
      const q = this.parts[k]; q.life = life * R(.6, 1.3); q.g = grav;
      q.vx = R(-1, 1) * speed; q.vy = R(-.2, 1) * speed * up; q.vz = R(-1, 1) * speed;
      this.pPos[k * 3] = p.x; this.pPos[k * 3 + 1] = p.y; this.pPos[k * 3 + 2] = p.z;
      const v = R(.7, 1.1);
      this.pCol[k * 3] = col[0] * v; this.pCol[k * 3 + 1] = col[1] * v; this.pCol[k * 3 + 2] = col[2] * v;
    }
    this.pGeo.attributes.color.needsUpdate = true;
  }
  tracer(a, b, color, life = .12) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, fog: false }));
    this.scene.add(l); this.tracers.push({ l, t: life, life });
  }
  sprite(map, pos, scale, life, opts = {}) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, color: opts.color || 0xffffff, opacity: opts.opacity ?? 1 }));
    s.position.copy(pos); s.scale.set(scale, scale, 1); this.scene.add(s);
    this.sprites.push({ s, t: life, life, grow: opts.grow || 0, rise: opts.rise || 0, op: opts.opacity ?? 1 });
    return s;
  }
  pulse(pos, color, intensity, t) { this.light.color.setHex(color); this.light.position.copy(pos); this.light.intensity = intensity; this.lightT = t; this.lightMax = t; this.lightI = intensity; }
  gib(mesh, pos, vel) {
    mesh.position.copy(pos); this.scene.add(mesh);
    this.gibs.push({ m: mesh, v: vel.clone(), spin: new THREE.Vector3(R(-8, 8), R(-8, 8), R(-8, 8)), t: 7 });
    if (this.gibs.length > 24) { const o = this.gibs.shift(); this.scene.remove(o.m); }
  }
  explosion(p, r, kind) {
    if (kind === 'gas') {
      for (let i = 0; i < 6; i++) this.sprite(this.TX.smoke, p.clone().add(new THREE.Vector3(R(-1, 1), R(-.3, .8), R(-1, 1))), R(1.5, 2.6), R(1.5, 2.5), { color: 0x8acc40, opacity: .8, grow: 1.2, rise: .2 });
      this.emit(p, 40, COL.gas, 3, 2, 1.0);
      this.emit(p, 30, COL.blood, 4, 9, .8);
      this.pulse(p, 0x9adc40, 2, .4);
      return;
    }
    const col = kind === 'ray' ? 0x8dff6a : kind === 'freeze' ? 0x9fe8ff : 0xffa040;
    this.sprite(this.TX.glowWhite, p, r * 1.2, .25, { additive: true, color: col, grow: 3 });
    for (let i = 0; i < 5; i++) this.sprite(this.TX.smoke, p.clone().add(new THREE.Vector3(R(-.6, .6), R(0, .6), R(-.6, .6))), R(1, 2), R(1, 1.8), { color: 0x555048, opacity: .7, grow: .8, rise: .6 });
    this.emit(p, 50, kind === 'ray' ? COL.green : COL.fire, 6, 6, .6);
    this.emit(p, 25, COL.dirt, 5, 12, .9);
    this.pulse(p, col, 4, .35);
    this.flash = Math.max(this.flash, .12);
  }
  lightning(x, z) {
    const pts = []; let px = x, py = 30, pz = z;
    while (py > 0) { pts.push(new THREE.Vector3(px, py, pz)); px += R(-1.2, 1.2); pz += R(-1.2, 1.2); py -= R(1.5, 3); }
    pts.push(new THREE.Vector3(x, 0, z));
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, fog: false }));
    this.scene.add(l); this.tracers.push({ l, t: .3, life: .3 });
    const p = new THREE.Vector3(x, 1, z);
    this.sprite(this.TX.glowBlue, p, 4, .5, { additive: true, grow: 2 });
    this.emit(p, 30, COL.spark, 5, 6, .5);
    this.pulse(p, 0xbfd8ff, 5, .4);
    this.flash = Math.max(this.flash, .25);
  }
  update(dt) {
    const P = this.pPos;
    for (let k = 0; k < this.N; k++) {
      const q = this.parts[k]; if (q.life <= 0) continue;
      q.life -= dt; q.vy -= q.g * dt;
      let y = P[k * 3 + 1] + q.vy * dt;
      P[k * 3] += q.vx * dt; P[k * 3 + 2] += q.vz * dt;
      if (y < .03) { y = .03; q.vx *= .4; q.vz *= .4; q.vy = 0; }
      P[k * 3 + 1] = q.life <= 0 ? -999 : y;
    }
    this.pGeo.attributes.position.needsUpdate = true;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; t.t -= dt; t.l.material.opacity = Math.max(0, t.t / t.life);
      if (t.t <= 0) { this.scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i]; s.t -= dt;
      const k = Math.max(0, s.t / s.life);
      s.s.material.opacity = s.op * k;
      if (s.grow) s.s.scale.multiplyScalar(1 + s.grow * dt);
      s.s.position.y += s.rise * dt;
      if (s.t <= 0) { this.scene.remove(s.s); s.s.material.dispose(); this.sprites.splice(i, 1); }
    }
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const g = this.gibs[i]; g.t -= dt;
      g.v.y -= 11 * dt; g.m.position.addScaledVector(g.v, dt);
      g.m.rotation.x += g.spin.x * dt; g.m.rotation.y += g.spin.y * dt; g.m.rotation.z += g.spin.z * dt;
      if (g.m.position.y < .08) { g.m.position.y = .08; g.v.multiplyScalar(.35); g.v.y = Math.abs(g.v.y) * .3; g.spin.multiplyScalar(.5); }
      if (g.t < 1) g.m.position.y -= dt * .2;
      if (g.t <= 0) { this.scene.remove(g.m); this.gibs.splice(i, 1); }
    }
    if (this.lightT > 0) { this.lightT -= dt; this.light.intensity = Math.max(0, this.lightI * this.lightT / this.lightMax); }
    this.flash = Math.max(0, this.flash - dt * 1.5);
  }
}
