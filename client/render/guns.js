// Low-poly weapon models built from boxes and cylinders. Barrel points along -z, muzzle offset in userData.
import * as THREE from 'three';
import { lam } from './psx.js';

export function gunMats(TX) {
  return {
    metal: lam(TX.metal), dark: lam(TX.metalDark), wood: lam(TX.gwood), grip: lam(TX.grip), brass: lam(null, { color: 0xa88638 }),
    blade: lam(null, { color: 0xb6bac0 }), olive: lam(null, { color: 0x4a5a2a }),
    sleeve: lam(null, { color: 0x4c5634 }), skin: lam(null, { color: 0xb08868 })
  };
}

export function buildGun(id, GM) {
  const g = new THREE.Group();
  const M = k => GM[k];
  const b = (w, h, d, x, y, z, m, rx = 0) => { const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(m)); s.position.set(x, y, z); s.rotation.x = rx; g.add(s); return s; };
  const cyl = (r, len, x, y, z, m, seg = 8, r2) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r2 === undefined ? r : r2, len, seg), M(m)); s.rotation.x = Math.PI / 2; s.position.set(x, y, z); g.add(s); return s; };
  let muzzle = -.3;
  switch (id) {
    case 'm1911':
      b(.034, .045, .2, 0, 0, -.05, 'metal'); b(.03, .11, .045, 0, -.07, .025, 'grip', .28);
      b(.01, .012, .02, 0, .03, -.13, 'metal'); b(.02, .02, .05, 0, -.035, -.02, 'dark'); g.userData.mag = [b(.024, .08, .036, 0, -.1, .035, 'dark', .28)]; muzzle = -.16; break;
    case 'mp40':
      b(.045, .055, .3, 0, 0, -.08, 'metal'); cyl(.012, .2, 0, .005, -.33, 'metal');
      g.userData.mag = [b(.03, .19, .045, 0, -.12, -.13, 'dark')]; b(.034, .1, .045, 0, -.07, .03, 'grip', .3);
      b(.016, .016, .2, 0, -.01, .16, 'metal'); b(.012, .03, .012, 0, .04, -.2, 'metal'); muzzle = -.44; break;
    case 'thompson': {
      b(.05, .065, .32, 0, 0, -.1, 'metal'); cyl(.014, .2, 0, .01, -.36, 'metal');
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .045, 10), M('dark')); drum.rotation.z = Math.PI / 2; drum.position.set(0, -.085, -.12); g.add(drum); g.userData.mag = [drum];
      b(.034, .09, .045, 0, -.06, -.28, 'wood', -.2); b(.034, .1, .045, 0, -.07, .02, 'wood', .3); b(.045, .07, .24, 0, -.02, .19, 'wood');
      muzzle = -.47; break;
    }
    case 'ppsh': {
      b(.05, .06, .34, 0, 0, -.1, 'metal'); cyl(.024, .22, 0, .01, -.36, 'dark', 8);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .05, 10), M('dark')); drum.rotation.z = Math.PI / 2; drum.position.set(0, -.08, -.1); g.add(drum); g.userData.mag = [drum];
      b(.045, .08, .3, 0, -.03, .17, 'wood', .1); muzzle = -.48; break;
    }
    case 'trench':
      cyl(.017, .62, 0, .012, -.3, 'metal'); cyl(.013, .45, 0, -.024, -.22, 'dark');
      b(.048, .042, .15, 0, -.03, -.25, 'wood'); b(.048, .065, .17, 0, 0, 0, 'metal');
      b(.04, .075, .27, 0, -.035, .21, 'wood', .12); muzzle = -.62; break;
    case 'dbl':
      cyl(.016, .6, -.017, .012, -.3, 'metal'); cyl(.016, .6, .017, .012, -.3, 'metal');
      b(.06, .05, .2, 0, -.02, -.12, 'wood'); b(.05, .07, .14, 0, 0, .04, 'metal');
      b(.045, .085, .28, 0, -.045, .22, 'wood', .15); muzzle = -.6; break;
    case 'kar98k':
      b(.045, .05, .86, 0, -.012, -.16, 'wood'); cyl(.011, .26, 0, .02, -.66, 'metal');
      b(.03, .04, .2, 0, .035, -.03, 'metal'); b(.07, .012, .012, .04, .045, .03, 'metal');
      b(.045, .095, .26, 0, -.045, .33, 'wood', .1); b(.01, .03, .01, 0, .05, -.62, 'metal'); muzzle = -.8; break;
    case 'stg':
      b(.05, .065, .36, 0, 0, -.06, 'metal'); cyl(.012, .17, 0, .01, -.32, 'metal');
      g.userData.mag = [b(.03, .1, .045, 0, -.085, -.13, 'dark', -.15), b(.03, .09, .045, 0, -.165, -.105, 'dark', -.45)];
      b(.034, .1, .045, 0, -.075, .06, 'grip', .3); b(.04, .075, .24, 0, -.01, .24, 'wood'); muzzle = -.42; break;
    case 'fg42':
      b(.05, .06, .4, 0, 0, -.05, 'metal'); cyl(.012, .22, 0, .012, -.36, 'metal');
      g.userData.mag = [b(.08, .02, .1, -.05, -.01, -.06, 'dark')]; b(.034, .1, .045, 0, -.075, .05, 'grip', .45);
      b(.03, .06, .22, 0, -.005, .24, 'metal'); b(.005, .12, .005, .02, -.07, -.38, 'metal', .3); b(.005, .12, .005, -.02, -.07, -.38, 'metal', .3);
      muzzle = -.48; break;
    case 'mg42':
      b(.065, .085, .5, 0, 0, -.04, 'metal'); cyl(.03, .42, 0, .012, -.52, 'dark', 10); cyl(.012, .14, 0, .012, -.78, 'metal');
      b(.05, .095, .24, 0, -.02, .32, 'metal'); b(.034, .1, .045, 0, -.08, .1, 'grip', .3);
      g.userData.mag = [b(.1, .03, .05, -.07, -.01, -.06, 'brass')]; b(.012, .16, .012, .03, -.09, -.6, 'metal', .4); b(.012, .16, .012, -.03, -.09, -.6, 'metal', .4);
      muzzle = -.86; break;
    case 'grenade': {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .1, 6), GM.olive); g.add(s);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .2, 5), GM.wood); h.position.y = -.14; g.add(h);
      muzzle = 0; break;
    }
    case 'knife': {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(.012, .035, .2), GM.blade); blade.position.z = -.14; g.add(blade);
      const hilt = new THREE.Mesh(new THREE.BoxGeometry(.03, .04, .11), GM.grip); g.add(hilt);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(.06, .015, .015), GM.metal); guard.position.z = -.05; g.add(guard);
      muzzle = 0; break;
    }
  }
  g.userData.muzzle = muzzle;
  for (const m of g.userData.mag || []) m.userData.home = m.position.clone();
  g.userData.hold = HOLD[id] || HOLD.m1911;
  return g;
}

// where the right hand (grip) and the left hand (support) sit on each model
const HOLD = {
  m1911: [[0, -.07, .03], null], mp40: [[0, -.07, .03], [0, -.13, -.13]], thompson: [[0, -.07, .02], [0, -.06, -.28]],
  ppsh: [[0, -.06, .04], [0, -.04, -.25]], trench: [[0, -.06, .06], [0, -.05, -.25]], dbl: [[0, -.06, .08], [0, -.04, -.14]],
  kar98k: [[0, -.05, .12], [0, -.04, -.3]], stg: [[0, -.075, .06], [0, -.03, -.22]], fg42: [[0, -.075, .05], [0, -.03, -.2]],
  mg42: [[0, -.08, .1], [0, -.03, -.3]]
};

// First-person forearms and hands reaching to the grip points.
export function addArms(model, mats) {
  const [r, l] = model.userData.hold;
  const limb = (from, to) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), len = a.distanceTo(b);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.085, .08, len), mats.sleeve);
    arm.position.copy(a).add(b).multiplyScalar(.5); arm.lookAt(b); model.add(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(.065, .075, .095), mats.skin);
    hand.position.copy(b); hand.lookAt(a); model.add(hand);
  };
  limb([.13, -.3, .16], r);
  if (l) limb([-.26, -.32, .02], l);
}
