// Fear grows in the dark, near the dead and when you are hurt. Past a point the game starts to lie:
// footsteps behind you, whispers, static on the radio, and a figure at the end of the corridor
// that is gone the moment you look straight at it. All of it is local to this player.
import * as THREE from 'three';
import { basic } from './render/psx.js';
import { buildHumanoid, poseHumanoid } from './render/rig.js';
import { Nav } from '../shared/nav.js';
import { SFX } from './audio.js';
import { R, pick, clamp } from '../shared/util.js';

export class Fear {
  constructor(scene, world) {
    this.scene = scene;
    this.nav = new Nav(world);
    this.level = 0;
    this.nextT = R(20, 35);
    this.radio = 0;
    // a pale, half-transparent Matron that is there and then is not
    const black = basic({ color: 0x9aa49a, skinning: true, fog: false, transparent: true, opacity: .42, depthWrite: false });
    this.ghost = buildHumanoid('stalker', 777, black, {});
    this.ghost.group.visible = false;
    scene.add(this.ghost.group);
    this.ghostT = 0;
  }
  rebuildNav() { this.nav.rebuild(); }
  // ctx: { dt, dark, chase, stalker, hpLow, hidden, cam, enabled }
  update(c) {
    const dt = c.dt;
    let rise = (c.dark ? .018 : 0) + c.chase * .06 + c.stalker * .05 + c.hpLow * .04 + (c.hidden && c.stalker > .3 ? .05 : 0);
    const fall = c.dark || c.chase > .2 ? 0 : .025;
    this.level = clamp(this.level + (rise - fall) * dt, 0, 1);
    this.radio = Math.max(0, this.radio - dt);
    this.updateGhost(c);
    if (!c.enabled || this.level < .45) return;
    this.nextT -= dt * (.5 + this.level);
    if (this.nextT > 0) return;
    this.nextT = R(14, 28);
    const cam = c.cam, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); fwd.y = 0; fwd.normalize();
    const kind = pick(this.level > .7 ? ['steps', 'whisper', 'ghost', 'ghost', 'radio'] : ['steps', 'whisper', 'radio']);
    if (kind === 'steps') {
      // footsteps right behind you
      for (let i = 0; i < 4; i++) setTimeout(() => SFX.step('concrete', cam.position.x - fwd.x * (3 - i * .4), cam.position.z - fwd.z * (3 - i * .4), false), i * 420);
    } else if (kind === 'whisper') SFX.scare('whisper', cam.position.x - fwd.x * 2 + R(-1, 1), cam.position.z - fwd.z * 2 + R(-1, 1));
    else if (kind === 'radio') this.radio = R(1, 2.5);
    else this.showGhost(cam, fwd);
  }
  showGhost(cam, fwd) {
    // somewhere ahead and a little to the side, out of reach, with a clear line of sight
    for (let k = 0; k < 20; k++) {
      const a = R(-.5, .5), d = R(9, 15);
      const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      const x = cam.position.x + dir.x * d, z = cam.position.z + dir.z * d;
      if (!this.nav.free(this.nav.cell(x, z)) || !this.nav.clearLine(cam.position.x, cam.position.z, x, z)) continue;
      const g = this.ghost.group;
      g.position.set(x, 0, z); g.rotation.y = Math.atan2(cam.position.x - x, cam.position.z - z);
      g.visible = true; this.ghostT = R(1.2, 2.2);
      poseHumanoid(this.ghost, 0, { mode: 'walk', speed: 0, t: 0, swing: 0 });
      return;
    }
  }
  updateGhost(c) {
    const g = this.ghost.group;
    if (!g.visible) return;
    this.ghostT -= c.dt;
    const to = g.position.clone().setY(1.5).sub(c.cam.position).normalize();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(c.cam.quaternion);
    // it is gone the moment you look right at it
    if (to.dot(fwd) > .985 || this.ghostT <= 0) {
      g.visible = false;
      if (this.ghostT > 0) SFX.sting();
    }
  }
}
