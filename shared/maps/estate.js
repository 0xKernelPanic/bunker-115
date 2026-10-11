// Kessler Estate: the doctor's manor in the valley. Find fuel and the car keys, get the car in the
// garage running while the noise draws everything in, then drive away.
const W = 'wallpaper';
export default {
  id: 'estate',
  name: 'Kessler Estate',
  blurb: "Fuel the doctor's car, find his keys and keep the engine turning while the dead close in.",
  notePrefix: 'e',
  rescue: 'The engine catches! Get in the car!',
  clothes: [{ top: [26, 26, 30], pants: [24, 24, 28], style: 'servant' }, { top: [86, 70, 52], pants: [70, 58, 44], style: 'overalls' }, { top: [52, 38, 50], pants: [40, 30, 36], style: 'suit' }, { top: [130, 120, 100], pants: [60, 50, 40], style: 'shirt' }],
  ambience: ['clock', 'creak', 'piano', 'crow'],
  hasPower: false,
  navBounds: [-18.5, -16.5, 30.5, 22.5],
  fog: { color: 0x07080a, near: 1, far: 22 },
  ambient: 0x141820,
  zones: [
    { id: 'H', name: 'Hall', rects: [[-6, -6, 6, 6]], start: true, floor: 'planks', ceil: 3.8 },
    { id: 'L', name: 'Library', rects: [[-18, -6, -6, 6]], floor: 'planks', ceil: 3.8 },
    { id: 'S', name: 'Study', rects: [[-18, -16, -6, -6]], floor: 'planks', ceil: 3.4 },
    { id: 'D', name: 'Dining Room', rects: [[6, -6, 18, 6]], floor: 'planks', ceil: 3.8 },
    { id: 'K', name: 'Kitchen', rects: [[6, -16, 18, -6]], floor: 'tiles', ceil: 3.2 },
    { id: 'G', name: 'Garden', rects: [[-18, 6, 18, 22]], floor: 'ground', ceil: 0 },
    { id: 'R', name: 'Garage', rects: [[18, 6, 30, 22]], floor: 'concrete', ceil: 4 }
  ],
  walls: [
    { axis: 'x', at: -6, from: -6, to: 6, h: 3.8, mat: W, open: [{ t: -3, w: 2, type: 'window', id: 'hN1', out: -1, lat: 1.2 }, { t: 3, w: 2, type: 'window', id: 'hN2', out: -1, lat: 1.2 }] },
    { axis: 'x', at: 6, from: -18, to: 18, h: 3.8, mat: W, open: [{ t: 0, w: 2.4, type: 'door', id: 'dHG' }] },
    { axis: 'x', at: 6, from: 18, to: 30, h: 4, mat: 'concrete', open: [{ t: 24, w: 2, type: 'window', id: 'rN', out: -1, lat: 2 }] },
    { axis: 'z', at: -6, from: -6, to: 6, h: 3.8, mat: W, open: [{ t: 0, w: 2.4, type: 'door', id: 'dHL' }] },
    { axis: 'z', at: 6, from: -6, to: 6, h: 3.8, mat: W, open: [{ t: 0, w: 2.4, type: 'door', id: 'dHD' }] },
    { axis: 'z', at: -18, from: -16, to: 6, h: 3.8, mat: W, open: [{ t: -11, w: 2, type: 'window', id: 'sW', out: -1, lat: 2 }, { t: 0, w: 2, type: 'window', id: 'lW', out: -1, lat: 2 }] },
    { axis: 'z', at: -18, from: 6, to: 22, h: 3, mat: 'stone', open: [{ t: 14, w: 2, type: 'window', id: 'gW', out: -1, lat: 3 }] },
    { axis: 'x', at: -6, from: -18, to: -6, h: 3.8, mat: W, open: [{ t: -12, w: 2.4, type: 'door', id: 'dLS' }] },
    { axis: 'x', at: -16, from: -18, to: -6, h: 3.4, mat: W, open: [{ t: -12, w: 2, type: 'window', id: 'sN', out: -1, lat: 2 }] },
    { axis: 'z', at: -6, from: -16, to: -6, h: 3.4, mat: W, open: [] },
    { axis: 'x', at: -6, from: 6, to: 18, h: 3.8, mat: W, open: [{ t: 12, w: 2.4, type: 'door', id: 'dDK' }] },
    { axis: 'x', at: -16, from: 6, to: 18, h: 3.2, mat: 'plaster', open: [{ t: 12, w: 2, type: 'window', id: 'kN', out: -1, lat: 2 }] },
    { axis: 'z', at: 6, from: -16, to: -6, h: 3.2, mat: 'plaster', open: [] },
    { axis: 'z', at: 18, from: -16, to: 6, h: 3.8, mat: W, open: [{ t: -11, w: 2, type: 'window', id: 'kE', out: 1, lat: 2 }, { t: 0, w: 2, type: 'window', id: 'dE', out: 1, lat: 2 }] },
    { axis: 'z', at: 18, from: 6, to: 22, h: 4, mat: 'concrete', open: [{ t: 14, w: 2.4, type: 'door', id: 'dGR' }] },
    { axis: 'x', at: 22, from: -18, to: 18, h: 3, mat: 'stone', open: [{ t: -8, w: 2, type: 'window', id: 'gS1', out: 1, lat: 3 }, { t: 8, w: 2, type: 'window', id: 'gS2', out: 1, lat: 3 }] },
    { axis: 'x', at: 22, from: 18, to: 30, h: 4, mat: 'concrete', open: [{ t: 24, w: 2, type: 'window', id: 'rS', out: 1, lat: 2 }] },
    { axis: 'z', at: 30, from: 6, to: 22, h: 4, mat: 'concrete', open: [{ t: 14, w: 2, type: 'window', id: 'rE', out: 1, lat: 3 }] }
  ],
  doors: [
    { id: 'dHL', cost: 750, zones: ['H', 'L'], label: 'Library' },
    { id: 'dHD', cost: 750, zones: ['H', 'D'], label: 'Dining Room' },
    { id: 'dDK', cost: 1000, zones: ['D', 'K'], label: 'Kitchen' },
    { id: 'dLS', key: 'study', zones: ['L', 'S'], label: 'Study' },
    { id: 'dHG', cost: 1000, zones: ['H', 'G'], label: 'Garden' },
    { id: 'dGR', cost: 1250, zones: ['G', 'R'], label: 'Garage' }
  ],
  exit: [21.4, 12.2, 22.95, 15.8],
  objectives: [
    { id: 'collect', item: 'fuel', n: 2, text: 'Find fuel for the car ({n}/2)', hint: 'Two cans of fuel are somewhere in the house or the grounds.' },
    { id: 'collect', item: 'carkey', n: 1, text: "Find the car keys in the doctor's study", hint: 'The keys are on the desk in the locked study. The study key was left in the kitchen.' },
    { id: 'use', spot: 'car', prompt: 'Fill the tank and try the engine', text: 'Get the car running in the garage', hint: 'The car is in the garage, at the far end of the garden.', noise: 34, checkpoint: true },
    { id: 'hold', text: 'The engine will not catch. Keep it turning  {t}', hint: 'Keep them off you until the engine catches. Stay near the car.', time: 120 },
    { id: 'exit', text: 'Get in the car', hint: 'The engine is running. Get in.' }
  ],
  spots: [{ id: 'car', x: 24, z: 11, r: 1.6 }],
  randomItems: [{ kind: 'fuel', n: 2, spots: [{ x: 16.3, z: -14.6, y: .97 }, { x: -15.5, z: 20.5 }, { x: -16.6, z: 4.6 }, { x: 28.8, z: 19.5, y: .92 }] }],
  items: [
    { kind: 'key', key: 'study', x: 8.6, z: -15.2, y: .97 },
    { kind: 'carkey', x: -12.4, z: -14.6, y: .87 },
    { kind: 'weapon', w: 'dbl', x: 20, z: 8 }, { kind: 'weapon', w: 'fg42', x: -10, z: -10 },
    { kind: 'battery', x: 4.5, z: -5.2 }, { kind: 'battery', x: -10.5, z: 1.2, y: .82 }, { kind: 'battery', x: 14, z: -8 }, { kind: 'battery', x: 26, z: 20.5 }, { kind: 'battery', x: 4, z: 20 },
    { kind: 'medkit', x: -4.8, z: 4.8 }, { kind: 'medkit', x: 16.5, z: 4.5 }, { kind: 'medkit', x: -16.5, z: -8 }, { kind: 'medkit', x: 21.2, z: 20.8 },
    { kind: 'ammo', x: 4.8, z: 4.8 }, { kind: 'ammo', x: -7.4, z: -4.6 }, { kind: 'ammo', x: 10.6, z: -10.2, y: .82 }, { kind: 'ammo', x: 26, z: 8 }, { kind: 'ammo', x: -8, z: 18 },
    { kind: 'grenade', x: 13, z: 1.2, y: .82 }, { kind: 'grenade', x: 28.5, z: 8.5 }
  ],
  notes: [
    { note: 'e1', title: 'Telegram', x: 1.5, z: -4.6, y: .02 },
    { note: 'e2', title: "Margarete's diary", x: -12, z: -.4, y: .82 },
    { note: 'e3', title: "The butler's list", x: 11, z: -9.6, y: .82 },
    { note: 'e4', title: 'Ledger, page 115', x: -11.4, z: -14.3, y: .87 },
    { note: 'e5', title: "Chauffeur's note", x: 28.7, z: 21, y: .92 }
  ],
  hides: [
    { id: 'hH1', x: 5.55, z: -4, nx: -1, nz: 0 }, { id: 'hL1', x: -12, z: 5.55, nx: 0, nz: -1 },
    { id: 'hS1', x: -6.45, z: -12, nx: -1, nz: 0 }, { id: 'hD1', x: 8, z: -5.55, nx: 0, nz: 1 },
    { id: 'hK1', x: 17.55, z: -8, nx: -1, nz: 0 }, { id: 'hR1', x: 29.55, z: 10, nx: -1, nz: 0 }
  ],
  // weepers crouch in dark corners, facing the wall
  weepers: [{ x: 17.4, z: -14.2, rot: 1.57 }, { x: -17.3, z: 5.3, rot: -.79 }],
  // optional: three books on the library shelves open a hidden compartment (order in a child's
  // poem), and the study safe is set to Margarete's birthday
  puzzles: [
    { id: 'books', type: 'sequence', stash: { kind: 'shelf', x: -17.75, z: -3.5, nx: 1, nz: 0 },
      switches: [{ x: -16.9, z: -5.3, nx: 0, nz: 1, label: 'book of Psalms', hint: 'the prayer', color: 0x5a1a14, model: 'book' }, { x: -15.9, z: -5.3, nx: 0, nz: 1, label: 'anatomy atlas', hint: 'the body', color: 0x1e3a28, model: 'book' }, { x: -8.2, z: -5.3, nx: 0, nz: 1, label: 'copy of the Odyssey', hint: 'the long way home', color: 0x2a2440, model: 'book' }],
      clue: 'poem', clueSpots: [{ x: 8, z: 4.6 }, { x: 15.5, z: -9 }, { x: 3, z: -4.2 }],
      reward: [{ kind: 'weapon', w: 'thompson' }, { kind: 'battery' }, { kind: 'medkit' }], secret: 'e-books' },
    { id: 'safeS', type: 'code', stash: { kind: 'safe', x: -8, z: -15.55, nx: 0, nz: 1 }, clue: 'birthday', clueSpots: [{ x: -15, z: 2 }, { x: 10, z: 3.5 }, { x: 2, z: 4.5 }],
      reward: [{ kind: 'grenade' }, { kind: 'ammo' }, { kind: 'medkit' }], secret: 'e-safe' }
  ],
  // night conditions: where rubble can come down, extra bodies, extra weepers
  collapses: [{ x0: 14.5, z0: -5.5, x1: 17.5, z1: -2.5 }, { x0: -14, z0: 8, x1: -10, z1: 10.5 }],
  extraLurkers: [{ x: -14, z: 3 }, { x: 10, z: -12 }, { x: 25, z: 18.5 }],
  weeperPool: [{ x: 6.7, z: -15.3, rot: -2.36 }, { x: 18.7, z: 6.8, rot: -2.36 }],
  lurkers: [{ x: -10, z: 2.5 }, { x: 15, z: 3.5 }, { x: 13, z: -12.5 }, { x: -14, z: -9 }, { x: 21, z: 18 }],
  ceilings: [{ x: 9.5, z: -10 }, { x: -2, z: -2 }],
  stalker: { x: -14, z: 18, afterObj: 1, delay: 10, spawns: [{ x: -12, z: 3 }, { x: -12, z: -10 }, { x: 12, z: 4 }, { x: 12, z: -12 }, { x: -14, z: 18 }, { x: 10, z: 20 }, { x: 26, z: 8 }] },
  wallBuys: [
    { w: 'kar98k', cost: 500, x: 0, z: -5.84, nx: 0, nz: 1, y: 1.6 },
    { w: 'mp40', cost: 1000, x: 12, z: 5.84, nx: 0, nz: -1, y: 1.6 },
    { w: 'thompson', cost: 1200, x: -17.84, z: 3.5, nx: 1, nz: 0, y: 1.6 },
    { w: 'stg', cost: 1600, x: 20.5, z: 6.16, nx: 0, nz: 1, y: 1.6 }
  ],
  props: [
    { kind: 'piano', x: -3.6, z: -4.6, w: 1.6, d: .8, h: 1.1, collide: true },
    { kind: 'rug', x: 0, z: .5, w: 5, d: 3.4, h: .02 },
    { kind: 'armchair', x: -4.6, z: 2.6, w: .9, d: .9, h: .9, collide: true },
    { kind: 'armchair', x: 4.6, z: 2.4, w: .9, d: .9, h: .9, collide: true },
    { kind: 'clock', x: 4.9, z: -5.55, w: .6, d: .45, h: 2.2, collide: true },
    { kind: 'chair', x: 10, z: -1.1, w: .5, d: .5, h: .9 }, { kind: 'chair', x: 12, z: -1.1, w: .5, d: .5, h: .9 }, { kind: 'chair', x: 14, z: 1.1, w: .5, d: .5, h: .9 }, { kind: 'chair', x: 10, z: 1.1, w: .5, d: .5, h: .9 },
    { kind: 'table', x: -12, z: 0, w: 2.2, d: 1.1, h: .8, collide: true },
    { kind: 'shelf', x: -16.4, z: -5.6, w: 2.4, d: .5, h: 2.8, collide: true },
    { kind: 'shelf', x: -8.2, z: -5.6, w: 2.4, d: .5, h: 2.8, collide: true },
    { kind: 'shelf', x: -17.6, z: -14.2, w: .5, d: 2.6, h: 2.6, collide: true },
    { kind: 'desk', x: -12, z: -14.6, w: 2.2, d: .9, h: .85, collide: true },
    { kind: 'table', x: 12, z: 0, w: 5, d: 1.4, h: .8, collide: true },
    { kind: 'counter', x: 9.2, z: -15.4, w: 3.4, d: .8, h: .95, collide: true },
    { kind: 'counter', x: 15.2, z: -15.4, w: 3.4, d: .8, h: .95, collide: true },
    { kind: 'stove', x: 17.3, z: -12.6, w: .8, d: 1, h: .95, collide: true },
    { kind: 'table', x: 11, z: -10, w: 1.6, d: 1, h: .8, collide: true },
    { kind: 'car', x: 24, z: 14, w: 2, d: 4.2, h: 1.5, collide: true },
    { kind: 'counter', x: 28.9, z: 19.8, w: 1, d: 2.4, h: .9, collide: true },
    { kind: 'crate', x: 19.4, z: 20.6, w: 1, d: 1, h: 1, collide: true },
    { kind: 'fountain', x: 0, z: 14, w: 2.4, d: 2.4, h: .8, collide: true },
    { kind: 'tree', x: -10, z: 11 }, { kind: 'tree', x: 10, z: 12 }, { kind: 'tree', x: 13, z: 19 },
    { kind: 'grave', x: -12, z: 16 }, { kind: 'grave', x: -10.5, z: 16.4 }, { kind: 'grave', x: 12, z: 16.5 },
    { kind: 'bench', x: -4, z: 20.5, w: 2, d: .5, h: .45, collide: true },
    { kind: 'cabinet', x: 17.6, z: 2.6, w: .6, d: 2, h: 1.2, collide: true },
    { kind: 'debris', x: 2, z: 2.5, w: 1.4, d: .25, h: .08 }
  ],
  groundSpawns: [{ x: -12, z: 18 }, { x: 12, z: 18.5 }, { x: 0, z: 20 }, { x: -5, z: 10 }, { x: 6, z: 9 }],
  playerSpawns: [{ x: -2, z: 2 }, { x: 2, z: 2 }, { x: -2, z: -1 }, { x: 2, z: -1 }],
  lights: [
    { x: 0, y: 3.3, z: 0, color: 0xffc27a, int: 1.0, dist: 13, flicker: true },
    { x: -12, y: 2.6, z: 0, color: 0xffb070, int: .7, dist: 10, flicker: true },
    { x: -12, y: 2.4, z: -12, color: 0x9fd0a0, int: .8, dist: 10 },
    { x: 12, y: 2.0, z: 0, color: 0xff9a40, int: .9, dist: 10, flicker: true },
    { x: 12, y: 2.7, z: -11, color: 0xffd8a0, int: .7, dist: 10, flicker: true },
    { x: 24, y: 3.6, z: 14, color: 0xd8e4ff, int: 1.1, dist: 13, flicker: true },
    { x: -16, y: 2.8, z: 8, color: 0xffb070, int: .6, dist: 12, flicker: true }
  ],
  decor: { trees: { cx: 6, cz: 3, rmin: 22, rmax: 52, n: 60, exclude: [-22, -20, 34, 26] }, sandbags: 0, crosses: 6 }
};
