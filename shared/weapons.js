// Weapon table. rate = seconds between shots, spread = cone, head = headshot multiplier, noise = how far zombies hear it (m).
// range: [full damage up to, weakest at] in metres (shotguns fall to nothing, the rest to half).
// pierce: how many more bodies a round goes through. recoil: up = climb per shot, side = random
// sideways, drift = steady pull to one side. zoom: degrees of field of view lost aiming down the
// sights. chamber: a tactical reload leaves one in the chamber. shell: loaded one round at a time.
export const WEAPONS = {
  m1911: { name: 'M1911', cls: 'pistol', dmg: 40, mag: 8, res: 48, rate: .16, auto: false, reload: 1.6, spread: .008, head: 2.5, kick: .7, snd: 'pistol', noise: 20,
    range: [12, 30], recoil: { up: 1.1, side: .4, drift: 0 }, zoom: 10, chamber: true },
  kar98k: { name: 'Kar98k', cls: 'rifle', dmg: 190, mag: 5, res: 30, rate: 1.0, auto: false, reload: 2.6, spread: .002, head: 3, kick: 1.4, snd: 'rifle', noise: 30,
    pierce: 2, recoil: { up: 2.6, side: .3, drift: 0 }, zoom: 26 },
  mp40: { name: 'MP40', cls: 'smg', dmg: 42, mag: 32, res: 96, rate: .11, auto: true, reload: 2.2, spread: .022, head: 2, kick: .35, snd: 'smg', noise: 24,
    range: [10, 28], recoil: { up: .45, side: .3, drift: .12 }, zoom: 14 },
  trench: { name: 'Trench Gun', cls: 'shotgun', dmg: 50, pellets: 7, mag: 6, res: 30, rate: .7, auto: false, reload: 2.8, spread: .07, head: 1.5, kick: 1.5, snd: 'shotgun', noise: 28,
    range: [5, 18], recoil: { up: 2.4, side: .8, drift: 0 }, zoom: 10, shell: .45 },
  dbl: { name: 'Double-Barrel', cls: 'shotgun', dmg: 55, pellets: 8, mag: 2, res: 24, rate: .25, auto: false, reload: 2.2, spread: .09, head: 1.5, kick: 1.8, snd: 'shotgun', noise: 28,
    range: [5, 16], recoil: { up: 3, side: 1, drift: 0 }, zoom: 8 },
  thompson: { name: 'Thompson', cls: 'smg', dmg: 46, mag: 20, res: 100, rate: .085, auto: true, reload: 2.4, spread: .024, head: 2, kick: .35, snd: 'smg', noise: 24,
    range: [10, 28], recoil: { up: .55, side: .35, drift: -.15 }, zoom: 14 },
  ppsh: { name: 'PPSh-41', cls: 'smg', dmg: 40, mag: 71, res: 142, rate: .055, auto: true, reload: 3.0, spread: .03, head: 2, kick: .3, snd: 'smg', noise: 24,
    range: [9, 26], recoil: { up: .38, side: .4, drift: .2 }, zoom: 12 },
  stg: { name: 'STG-44', cls: 'rifle', dmg: 55, mag: 30, res: 120, rate: .1, auto: true, reload: 2.3, spread: .016, head: 2.2, kick: .45, snd: 'rifleAuto', noise: 28,
    recoil: { up: .6, side: .25, drift: .1 }, zoom: 18, chamber: true },
  fg42: { name: 'FG42', cls: 'rifle', dmg: 65, mag: 20, res: 100, rate: .09, auto: true, reload: 2.4, spread: .018, head: 2.2, kick: .5, snd: 'rifleAuto', noise: 28,
    pierce: 1, recoil: { up: .7, side: .3, drift: -.1 }, zoom: 20, chamber: true },
  mg42: { name: 'MG42', cls: 'lmg', dmg: 60, mag: 125, res: 250, rate: .055, auto: true, reload: 4.6, spread: .032, head: 2, kick: .3, snd: 'mg', noise: 34,
    pierce: 1, recoil: { up: .5, side: .5, drift: .15 }, zoom: 12, adsSpeed: 5 }
};
// how much of the damage is left at this distance
export function falloff(d, dist) {
  if (!d.range) return 1;
  const [a, b] = d.range, t = Math.min(1, Math.max(0, (dist - a) / (b - a)));
  return 1 - t * (d.cls === 'shotgun' ? 1 : .5);
}
// how many rounds a reload can bring the magazine up to
export function capacity(d, current) { return d.mag + (d.chamber && current > 0 ? 1 : 0); }

export function wdef(id) { return WEAPONS[id] || WEAPONS.m1911; }

export const KNIFE_DMG = 150;
export const GRENADE = { fuse: 2.3, radius: 5.5, dmg: 700, max: 4, start: 2 };
