// The Bunker: two brick rooms. Hold out until dawn, then leave through the east hatch.
export default {
  id: 'bunkier',
  name: 'The Bunker',
  blurb: 'Two brick rooms and six windows. Hold out until dawn, then get out.',
  notePrefix: 'b',
  rescue: 'Engines in the fog. It is dawn. Get out!',
  clothes: null,
  ambience: ['artillery', 'drip', 'creak'],
  hasPower: false,
  navBounds: [-10.5, -8.5, 24.5, 8.5],
  fog: { color: 0x080a0b, near: 1, far: 22 },
  ambient: 0x161a22,
  zones: [
    { id: 'A', name: 'Bunker', rects: [[-10, -8, 10, 8]], start: true, floor: 'planks', ceil: 3.2 },
    { id: 'B', name: 'Back Room', rects: [[10, -6, 24, 6]], floor: 'planks', ceil: 3.2 }
  ],
  walls: [
    { axis: 'x', at: -8, from: -10, to: 10, mat: 'brick', open: [{ t: -5, w: 2, type: 'window', id: 'a1', out: -1 }, { t: 5, w: 2, type: 'window', id: 'a2', out: -1 }] },
    { axis: 'x', at: 8, from: -10, to: 10, mat: 'brick', open: [{ t: 0, w: 2, type: 'window', id: 'a3', out: 1 }] },
    { axis: 'z', at: -10, from: -8, to: 8, mat: 'brick', open: [{ t: 0, w: 2, type: 'window', id: 'a4', out: -1 }] },
    { axis: 'z', at: 10, from: -8, to: 8, mat: 'brick', open: [{ t: 0, w: 3, type: 'door', id: 'd1' }] },
    { axis: 'x', at: -6, from: 10, to: 24, mat: 'brick', open: [{ t: 17, w: 2, type: 'window', id: 'b1', out: -1 }] },
    { axis: 'x', at: 6, from: 10, to: 24, mat: 'brick', open: [] },
    { axis: 'z', at: 24, from: -6, to: 6, mat: 'brick', open: [{ t: 0, w: 2, type: 'door', id: 'gate' }] }
  ],
  doors: [
    { id: 'd1', cost: 750, zones: ['A', 'B'], label: 'Back Room' },
    { id: 'gate', locked: true, exit: true, zones: ['B'], label: 'Hatch' }
  ],
  exit: [24.3, -1.1, 28, 1.1],
  objectives: [
    { id: 'hold', text: 'Hold out until dawn  {t}', hint: 'Board up the windows (hold F), keep your back to a wall, and do not get cornered.', time: 600, open: ['d1'], checkpointAt: 300 },
    { id: 'exit', text: 'Get out through the east hatch', hint: 'The hatch in the back room is open. Go.' }
  ],
  items: [
    { kind: 'weapon', w: 'dbl', x: 22, z: -2 },
    { kind: 'battery', x: -8, z: -6 }, { kind: 'battery', x: 22, z: 4.5 }, { kind: 'battery', x: 4, z: 6.8 },
    { kind: 'medkit', x: -8.5, z: 6.8 }, { kind: 'medkit', x: 12, z: -4.6 },
    { kind: 'ammo', x: 8, z: 6.5 }, { kind: 'ammo', x: 20, z: -4.5 }, { kind: 'ammo', x: -8.8, z: 2 },
    { kind: 'grenade', x: 0, z: 6.8 }
  ],
  notes: [
    { note: 'b1', title: 'Field diary, page 12', x: -8.7, z: -6.8, y: 1.02 },
    { note: 'b2', title: 'Orders', x: 2, z: -6.5 },
    { note: 'b3', title: 'Scrawled on a ration tin', x: 22.8, z: -4.8, y: 1.02 }
  ],
  hides: [
    { id: 'hA1', x: -9.55, z: 3, nx: 1, nz: 0 }, { id: 'hA2', x: -1.5, z: -7.55, nx: 0, nz: 1 },
    { id: 'hB1', x: 23.55, z: -3.4, nx: -1, nz: 0 }
  ],
  // a weeper crouches against the back room wall
  weepers: [{ x: 16.5, z: 5.35, rot: 0 }],
  // optional: the ammo locker in the back room, its combination scribbled on a map
  puzzles: [
    { id: 'locker', type: 'code', stash: { kind: 'footlocker', x: 13, z: -5.6, nx: 0, nz: 1 }, clue: 'margin', clueSpots: [{ x: -6, z: 6.5 }, { x: 4.5, z: -3 }],
      reward: [{ kind: 'weapon', w: 'fg42' }, { kind: 'grenade' }, { kind: 'ammo' }], secret: 'b-locker' }
  ],
  // night conditions: where rubble can come down, extra bodies
  collapses: [{ x0: -4, z0: -4, x1: -1, z1: -1 }, { x0: 18, z0: 1, x1: 21, z1: 4 }],
  extraLurkers: [{ x: 5, z: -4 }, { x: 19, z: -3 }],
  lurkers: [{ x: -5, z: 3 }, { x: 16, z: 2 }],
  ceilings: [{ x: 5, z: -4 }],
  stalker: { x: 20, z: 0, at: 300, spawns: [{ x: -6, z: -5 }, { x: 6, z: -6 }, { x: 20, z: 0 }, { x: 13, z: 4 }] },
  wallBuys: [
    { w: 'kar98k', cost: 500, x: 0, z: -7.84, nx: 0, nz: 1, y: 1.6 },
    { w: 'trench', cost: 1500, x: -9.84, z: -3.5, nx: 1, nz: 0, y: 1.6 },
    { w: 'mp40', cost: 1000, x: 14, z: 5.84, nx: 0, nz: -1, y: 1.6 },
    { w: 'thompson', cost: 1200, x: 3.5, z: 7.84, nx: 0, nz: -1, y: 1.6 }
  ],
  props: [
    { kind: 'crate', x: 8.7, z: -6.7, w: 1.1, d: 1.1, h: 1.0, collide: true },
    { kind: 'crate', x: 22.8, z: -4.8, w: 1.1, d: 1.1, h: 1.0, collide: true },
    { kind: 'crate', x: -8.8, z: -6.8, w: 1, d: 1, h: 1, collide: true },
    { kind: 'crate', x: -9.2, z: -2, w: 1, d: 1, h: 1, collide: true },
    { kind: 'crate', x: 6, z: 7.3, w: 1.2, d: .8, h: .8, collide: true },
    { kind: 'debris', x: 3, z: 3, w: 1.6, d: .25, h: .08 },
    { kind: 'debris', x: -3, z: -2, w: 1.3, d: .25, h: .08 }
  ],
  groundSpawns: [],
  playerSpawns: [{ x: 0, z: 3 }, { x: 2, z: 3 }, { x: -2, z: 3 }, { x: 0, z: 1 }],
  lights: [
    { x: -4.5, y: 2.75, z: 0, color: 0xffb070, int: 1.0, dist: 13, flicker: true },
    { x: 5, y: 2.75, z: -1, color: 0xffb868, int: .9, dist: 13, flicker: true },
    { x: 17, y: 2.75, z: 0, color: 0xff6a40, int: .8, dist: 12, flicker: true }
  ],
  decor: { trees: { cx: 7, cz: 0, rmin: 16, rmax: 46, n: 46, exclude: [-14, -11, 28, 11] }, sandbags: 9, crosses: 7 }
};
