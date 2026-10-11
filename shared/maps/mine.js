// Hollow Pit Mine: the lift shaft has come down. Find dynamite and the blasting machine, pack the
// charges into the blocked drift, fire them from a safe distance, wait out the dust, and climb out.
const R = 'rock';
export default {
  id: 'mine',
  name: 'Hollow Pit Mine',
  blurb: 'The lift is gone. Find dynamite and the blasting machine, and blow a way out through the rock.',
  notePrefix: 'm',
  rescue: 'Grey light at the end of the drift. CLIMB.',
  underground: true,
  // miners in overalls and helmets
  clothes: [{ top: [62, 64, 68], pants: [48, 50, 52], style: 'overalls' }, { top: [88, 74, 52], pants: [60, 54, 44], style: 'overalls' }, { top: [46, 54, 66], pants: [40, 44, 50], style: 'shirt' }, { top: [70, 66, 58], pants: [52, 48, 42], style: 'overalls' }],
  helmets: .6,
  ambience: ['drip', 'drip', 'rumble', 'tap', 'creak'],
  hasPower: false,
  navBounds: [-8.5, -14.5, 60.5, 18.5],
  fog: { color: 0x040404, near: 1, far: 18 },
  ambient: 0x0e0f12,
  zones: [
    { id: 'E', name: 'Lamp Room', rects: [[-8, -5, 8, 5]], start: true, floor: 'gravel', ceil: 3.0 },
    { id: 'H', name: 'Haulage Way', rects: [[8, -2, 44, 2]], floor: 'gravel', ceil: 2.8 },
    { id: 'F', name: "Foreman's Office", rects: [[-8, 5, 2, 13]], floor: 'planks', ceil: 2.8 },
    { id: 'S', name: 'The Stope', rects: [[16, 2, 32, 18]], floor: 'gravel', ceil: 4.6 },
    { id: 'M', name: 'Powder Magazine', rects: [[16, -14, 26, -2]], floor: 'gravel', ceil: 2.8 },
    { id: 'P', name: 'Pump Room', rects: [[44, -8, 56, 8]], floor: 'concrete', ceil: 3.4 }
  ],
  walls: [
    // lamp room
    { axis: 'x', at: -5, from: -8, to: 8, h: 3.0, mat: R, open: [{ t: -4, w: 2, type: 'window', id: 'eN', out: -1, lat: 2 }] },
    { axis: 'z', at: -8, from: -5, to: 5, h: 3.0, mat: R, open: [{ t: 0, w: 2, type: 'window', id: 'eW', out: -1, lat: 2 }] },
    { axis: 'x', at: 5, from: -8, to: 8, h: 3.0, mat: R, open: [{ t: -3, w: 2.4, type: 'door', id: 'dEF' }] },
    { axis: 'z', at: 8, from: -5, to: 5, h: 3.0, mat: R, open: [{ t: 0, w: 2.4, type: 'door', id: 'dEH' }] },
    // haulage way
    { axis: 'x', at: -2, from: 8, to: 44, h: 2.8, mat: R, open: [{ t: 12, w: 2, type: 'window', id: 'hN1', out: -1, lat: 2 }, { t: 21, w: 2.4, type: 'door', id: 'dHM' }, { t: 37, w: 2, type: 'window', id: 'hN2', out: -1, lat: 2 }] },
    { axis: 'x', at: 2, from: 8, to: 44, h: 2.8, mat: R, open: [{ t: 12, w: 2, type: 'window', id: 'hS1', out: 1, lat: 2 }, { t: 24, w: 2.4, type: 'door', id: 'dHS' }, { t: 38, w: 2, type: 'window', id: 'hS2', out: 1, lat: 2 }] },
    // foreman's office
    { axis: 'z', at: -8, from: 5, to: 13, h: 2.8, mat: R, open: [{ t: 9, w: 2, type: 'window', id: 'fW', out: -1, lat: 2 }] },
    { axis: 'x', at: 13, from: -8, to: 2, h: 2.8, mat: R, open: [] },
    { axis: 'z', at: 2, from: 5, to: 13, h: 2.8, mat: R, open: [] },
    // the stope
    { axis: 'z', at: 16, from: 2, to: 18, h: 4.6, mat: R, open: [{ t: 12, w: 2, type: 'window', id: 'sW', out: -1, lat: 3 }] },
    { axis: 'x', at: 18, from: 16, to: 32, h: 4.6, mat: R, open: [{ t: 24, w: 2, type: 'window', id: 'sS', out: 1, lat: 3 }] },
    { axis: 'z', at: 32, from: 2, to: 18, h: 4.6, mat: R, open: [{ t: 10, w: 2, type: 'window', id: 'sE', out: 1, lat: 3 }] },
    // powder magazine
    { axis: 'z', at: 16, from: -14, to: -2, h: 2.8, mat: R, open: [] },
    { axis: 'x', at: -14, from: 16, to: 26, h: 2.8, mat: R, open: [{ t: 21, w: 2, type: 'window', id: 'mN', out: -1, lat: 2 }] },
    { axis: 'z', at: 26, from: -14, to: -2, h: 2.8, mat: R, open: [] },
    // pump room; the blocked drift to the surface is in its east wall
    { axis: 'x', at: -8, from: 44, to: 56, h: 3.4, mat: R, open: [{ t: 50, w: 2, type: 'window', id: 'pN', out: -1, lat: 2 }] },
    { axis: 'x', at: 8, from: 44, to: 56, h: 3.4, mat: R, open: [{ t: 52, w: 2, type: 'window', id: 'pS', out: 1, lat: 2 }] },
    { axis: 'z', at: 44, from: -8, to: 8, h: 3.4, mat: R, open: [{ t: 0, w: 2.4, type: 'door', id: 'dHP' }] },
    { axis: 'z', at: 56, from: -8, to: 8, h: 3.4, mat: R, open: [{ t: 0, w: 2.4, type: 'door', id: 'gate' }] }
  ],
  doors: [
    { id: 'dEH', cost: 500, zones: ['E', 'H'], label: 'Haulage Way' },
    { id: 'dEF', key: 'foreman', zones: ['E', 'F'], label: "Foreman's Office" },
    { id: 'dHS', cost: 1000, zones: ['H', 'S'], label: 'The Stope' },
    { id: 'dHM', cost: 1250, zones: ['H', 'M'], label: 'Powder Magazine' },
    { id: 'dHP', cost: 1500, zones: ['H', 'P'], label: 'Pump Room' },
    { id: 'gate', locked: true, exit: true, rubble: true, zones: ['P'], label: 'Blocked Drift' }
  ],
  exit: [56.3, -1.4, 60, 1.4],
  objectives: [
    { id: 'collect', item: 'dynamite', n: 3, text: 'Find dynamite ({n}/3)', hint: 'Loose sticks of dynamite lie around the workings. They glint in torchlight.' },
    { id: 'collect', item: 'detonator', n: 1, text: "Get the blasting machine from the foreman's office", hint: "The blasting machine is in the foreman's office, off the lamp room. Its door needs the foreman's key." },
    { id: 'use', spot: 'charges', prompt: 'Pack the charges into the rockfall', text: 'Set the charges at the blocked drift in the pump room', hint: 'The blocked drift is in the east wall of the pump room.', noise: 22 },
    { id: 'use', spot: 'plunger', prompt: 'Fire the charges', text: 'Get back to the haulage way and fire the charges', hint: 'Get well clear, back in the haulage way, and fire them. It will wake everything.', noise: 70, checkpoint: true },
    { id: 'hold', text: 'Wait for the dust to settle  {t}', hint: 'Stay alive while the dust settles. Everything heard that.', time: 90 },
    { id: 'exit', text: 'Climb out through the blasted drift', hint: 'The drift in the pump room is open. Climb.' }
  ],
  spots: [{ id: 'charges', x: 54.6, z: 0, r: 1.6 }, { id: 'plunger', x: 38, z: 0, r: 1.6 }],
  randomItems: [
    { kind: 'dynamite', n: 3, spots: [{ x: 18, z: -12 }, { x: 24.5, z: -4.5 }, { x: 27.5, z: 16.5 }, { x: 54, z: 6.5 }, { x: 42, z: -1.4 }] },
    { kind: 'key', n: 1, spots: [{ x: -6, z: -4.2, key: 'foreman' }, { x: 45.6, z: 7.2, key: 'foreman' }] }
  ],
  items: [
    { kind: 'detonator', x: -5, z: 11, y: .87 },
    { kind: 'weapon', w: 'ppsh', x: 19, z: 16.5 }, { kind: 'weapon', w: 'mg42', x: 45.5, z: -5 }, { kind: 'weapon', w: 'dbl', x: -7, z: 12.2 },
    { kind: 'battery', x: 5, z: -4.2 }, { kind: 'battery', x: 30, z: 1.4 }, { kind: 'battery', x: 17, z: 4 }, { kind: 'battery', x: 17, z: -3 }, { kind: 'battery', x: 45, z: 6 }, { kind: 'battery', x: -2, z: 12.3 },
    { kind: 'medkit', x: -7, z: -4.2 }, { kind: 'medkit', x: 30, z: 12 }, { kind: 'medkit', x: 50.5, z: 6.5 }, { kind: 'medkit', x: 20, z: -4.5 },
    { kind: 'ammo', x: 6, z: 4.2 }, { kind: 'ammo', x: 20, z: -1.4 }, { kind: 'ammo', x: 24, z: 10 }, { kind: 'ammo', x: 45, z: -7.4 },
    { kind: 'grenade', x: 16.7, z: 17.3 }, { kind: 'grenade', x: 19, z: -13.2 }
  ],
  notes: [
    { note: 'm1', title: 'Shift board, lamp room', x: -2, z: -4.4, y: .02 },
    { note: 'm2', title: "Foreman's daybook", x: -6, z: 12.2, y: .02 },
    { note: 'm3', title: 'Magazine inventory', x: 22, z: -13.3, y: .02 },
    { note: 'm4', title: 'Letter never sent', x: 26, z: 4, y: .02 },
    { note: 'm5', title: 'Chalked on the pump housing', x: 50, z: -2.3, y: .02 }
  ],
  hides: [
    { id: 'hE1', x: -7.55, z: 3.5, nx: 1, nz: 0 }, { id: 'hH1', x: 10.5, z: -1.55, nx: 0, nz: 1 }, { id: 'hS1', x: 31.55, z: 6, nx: -1, nz: 0 },
    { id: 'hM1', x: 25.55, z: -8, nx: -1, nz: 0 }, { id: 'hP1', x: 55.55, z: -5, nx: -1, nz: 0 }, { id: 'hF1', x: 1.55, z: 10.5, nx: -1, nz: 0 }
  ],
  // optional: the foreman's safe (combination on a payroll slip) and the pump levers (order on a
  // warning plate) that open the tool chest
  puzzles: [
    { id: 'safeF', type: 'code', stash: { kind: 'safe', x: 1.55, z: 7, nx: -1, nz: 0 }, clue: 'payroll', clueSpots: [{ x: 13, z: 1.4 }, { x: 30, z: 8 }, { x: 48, z: -4 }],
      reward: [{ kind: 'weapon', w: 'stg' }, { kind: 'medkit' }, { kind: 'battery' }], secret: 'm-safe' },
    { id: 'levers', type: 'sequence', stash: { kind: 'footlocker', x: 53, z: -7.6, nx: 0, nz: 1 },
      switches: [{ x: 46, z: 7.8, nx: 0, nz: -1, label: 'red lever', color: 0xa02018, model: 'lever' }, { x: 47.5, z: 7.8, nx: 0, nz: -1, label: 'yellow lever', color: 0xb09020, model: 'lever' }, { x: 49, z: 7.8, nx: 0, nz: -1, label: 'black lever', color: 0x202020, model: 'lever' }],
      clue: 'warning', clueSpots: [{ x: 42, z: 1.4 }, { x: 51, z: 4.5 }, { x: 28, z: 14 }],
      reward: [{ kind: 'grenade' }, { kind: 'grenade' }, { kind: 'medkit' }, { kind: 'ammo' }], secret: 'm-levers' }
  ],
  // night conditions
  collapses: [{ x0: 31.5, z0: -2, x1: 35, z1: .2 }, { x0: 20, z0: 6, x1: 25, z1: 9 }],
  extraLurkers: [{ x: 36, z: -.8 }, { x: 18, z: 8 }, { x: 48, z: -5 }],
  weeperPool: [{ x: 25.3, z: -13.3, rot: 2.36 }],
  weepers: [{ x: 31.3, z: 17.3, rot: .79 }],
  lurkers: [{ x: 12, z: .8 }, { x: 20, z: 12 }, { x: 27, z: 7 }, { x: 22, z: -9 }, { x: 50, z: -3 }, { x: -4, z: 10 }],
  ceilings: [{ x: 18, z: 0 }, { x: 34, z: .5 }, { x: 48, z: 2 }],
  // she comes down the shaft after you have found the dynamite
  stalker: { x: 30, z: 15, afterObj: 1, delay: 20, spawns: [{ x: 30, z: 15 }, { x: 21, z: -12 }, { x: 50, z: 5 }, { x: 40, z: 0 }, { x: -5, z: 9 }] },
  wallBuys: [
    { w: 'kar98k', cost: 500, x: -7.84, z: -2, nx: 1, nz: 0, y: 1.5 },
    { w: 'mp40', cost: 1000, x: 30, z: -1.84, nx: 0, nz: 1, y: 1.5 },
    { w: 'thompson', cost: 1200, x: 16.16, z: 8, nx: 1, nz: 0, y: 1.6 },
    { w: 'trench', cost: 1500, x: 25.84, z: -5, nx: -1, nz: 0, y: 1.5 },
    { w: 'stg', cost: 1600, x: 47, z: -7.84, nx: 0, nz: 1, y: 1.6 }
  ],
  props: [
    // lamp room
    { kind: 'lamprack', x: 4, z: -4.7, w: 3, d: .5, h: 1.8, collide: true },
    { kind: 'table', x: 2.5, z: 2.5, w: 2, d: 1, h: .8, collide: true },
    { kind: 'bench', x: -4, z: 4.5, w: 2.2, d: .5, h: .45, collide: true },
    // haulage way: rails down the middle, a cart parked to one side
    { kind: 'rails', x: 26, z: 0, w: 36, d: 1, h: .05 },
    { kind: 'minecart', x: 33, z: -1.2, w: 1.8, d: .9, h: 1.1, collide: true },
    { kind: 'minecart', x: 14.5, z: 1.2, w: 1.8, d: .9, h: 1.1, collide: true },
    // office
    { kind: 'desk', x: -5, z: 11, w: 2, d: .8, h: .85, collide: true },
    { kind: 'cabinet', x: -7.6, z: 6.2, w: .6, d: 1.4, h: 2, collide: true },
    { kind: 'chair', x: -5, z: 10.2, w: .5, d: .5, h: .9 },
    // stope
    { kind: 'minecart', x: 21, z: 15.5, w: 1.8, d: .9, h: 1.1, collide: true },
    { kind: 'crate', x: 17.2, z: 10.5, w: 1, d: 1, h: 1, collide: true },
    { kind: 'debris', x: 26, z: 13, w: 1.6, d: .3, h: .1 },
    // magazine: crates of explosives and the serum barrels
    { kind: 'crate', x: 17.2, z: -9, w: 1, d: 1, h: 1, collide: true },
    { kind: 'crate', x: 17.2, z: -7.9, w: 1, d: 1, h: .9, collide: true },
    { kind: 'barrels', x: 23.5, z: -11.5, w: 2, d: 1, h: 1.1, collide: true },
    // pump room
    { kind: 'pump', x: 50, z: -4.5, w: 3, d: 2, h: 2.2, collide: true },
    { kind: 'pump', x: 52.5, z: 4.6, w: 2, d: 2, h: 1.8, collide: true },
    { kind: 'water', x: 50, z: 0, w: 11, d: 14, h: .02 }
  ],
  groundSpawns: [{ x: 20, z: 10 }, { x: 28, z: 14 }, { x: 23, z: 16 }, { x: 50, z: 3 }],
  playerSpawns: [{ x: -2, z: 1 }, { x: 2, z: 1 }, { x: -2, z: -2 }, { x: 2, z: -2 }],
  lights: [
    { x: 0, y: 2.8, z: 0, color: 0xffc27a, int: .9, dist: 11, flicker: true },
    { x: 14, y: 2.6, z: 0, color: 0xffb060, int: .7, dist: 9, flicker: true },
    { x: 26, y: 2.6, z: 0, color: 0xffb060, int: .6, dist: 9 },
    { x: 38, y: 2.6, z: 0, color: 0xffb060, int: .7, dist: 9, flicker: true },
    { x: 24, y: 4.3, z: 10, color: 0xffd8a0, int: .9, dist: 14, flicker: true },
    { x: 21, y: 2.6, z: -8, color: 0xff6040, int: .6, dist: 9 },
    { x: 50, y: 3.1, z: 0, color: 0xc8e0ff, int: .8, dist: 12, flicker: true },
    { x: -3, y: 2.6, z: 9, color: 0xffc27a, int: .6, dist: 9 }
  ],
  decor: {}
};
