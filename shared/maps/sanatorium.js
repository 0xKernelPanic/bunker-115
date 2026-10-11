// Wolf Hollow Sanatorium: restore power with three fuses, radio for help, survive until the truck
// arrives, then run for the courtyard gate.
const IN = 3.4;
export default {
  id: 'sanatorium',
  name: 'Wolf Hollow Sanatorium',
  blurb: 'Find three fuses, bring the power back, radio for help and survive until the truck arrives.',
  notePrefix: 's',
  rescue: 'Headlights at the gate. RUN.',
  clothes: [{ top: [150, 156, 140], pants: [140, 146, 132], style: 'pyjamas' }, { top: [120, 130, 140], pants: [110, 116, 120], style: 'gown' }, { top: [74, 78, 64], pants: [50, 52, 46], style: 'uniform' }, { top: [170, 166, 150], pants: [150, 146, 130], style: 'coat' }],
  ambience: ['drip', 'drip', 'creak', 'pipes'],
  hasPower: true,
  navBounds: [-12.5, -20.5, 48.5, 24.5],
  fog: { color: 0x07090a, near: 1, far: 21 },
  fogPowered: 26,
  ambient: 0x12161c,
  zones: [
    { id: 'R', name: 'Reception', rects: [[-8, -6, 8, 6]], start: true, floor: 'tiles', ceil: IN },
    { id: 'C', name: 'Morgue', rects: [[-4, -20, 8, -6]], floor: 'tiles', ceil: IN },
    { id: 'O', name: 'Ward', rects: [[8, -3, 36, 3]], floor: 'tiles', ceil: IN },
    { id: 'K', name: 'Boiler Room', rects: [[36, -10, 48, 2]], floor: 'concrete', ceil: IN },
    { id: 'S', name: 'Operating Theatre', rects: [[24, 3, 36, 15]], floor: 'tiles', ceil: IN },
    { id: 'D', name: 'Courtyard', rects: [[-12, 6, 12, 24]], floor: 'ground', ceil: 0 }
  ],
  walls: [
    { axis: 'x', at: -6, from: -8, to: 8, h: IN, mat: 'plaster', open: [{ t: -6, w: 2, type: 'window', id: 'rN', out: -1, lat: 1 }, { t: 2, w: 2.4, type: 'door', id: 'dRC' }] },
    { axis: 'x', at: 6, from: -12, to: 12, h: IN, mat: 'plaster', open: [{ t: 0, w: 2.4, type: 'door', id: 'dRD' }] },
    { axis: 'z', at: -8, from: -6, to: 6, h: IN, mat: 'plaster', open: [{ t: -2.5, w: 2, type: 'window', id: 'rW1', out: -1, lat: 2 }, { t: 2.5, w: 2, type: 'window', id: 'rW2', out: -1, lat: 2 }] },
    { axis: 'z', at: 8, from: -6, to: 6, h: IN, mat: 'plaster', open: [{ t: 0, w: 2.4, type: 'door', id: 'dRO' }] },
    { axis: 'z', at: -4, from: -20, to: -6, h: IN, mat: 'plaster', open: [{ t: -14, w: 2, type: 'window', id: 'cW', out: -1, lat: 2 }] },
    { axis: 'z', at: 8, from: -20, to: -6, h: IN, mat: 'plaster', open: [] },
    { axis: 'x', at: -20, from: -4, to: 8, h: IN, mat: 'plaster', open: [{ t: 2, w: 2, type: 'window', id: 'cN', out: -1, lat: 2 }] },
    { axis: 'x', at: -3, from: 8, to: 36, h: IN, mat: 'plaster', open: [{ t: 14, w: 2, type: 'window', id: 'oN1', out: -1, lat: 3 }, { t: 30, w: 2, type: 'window', id: 'oN2', out: -1, lat: 3 }] },
    { axis: 'x', at: 3, from: 8, to: 36, h: IN, mat: 'plaster', open: [{ t: 17, w: 2, type: 'window', id: 'oS', out: 1, lat: 2 }, { t: 30, w: 2.4, type: 'door', id: 'dOS' }] },
    { axis: 'z', at: 36, from: -10, to: 15, h: IN, mat: 'concrete', open: [{ t: 0, w: 2.4, type: 'door', id: 'dOK' }, { t: 10, w: 2, type: 'window', id: 'sE', out: 1, lat: 1.5 }] },
    { axis: 'x', at: -10, from: 36, to: 48, h: IN, mat: 'concrete', open: [{ t: 42, w: 2, type: 'window', id: 'kN', out: -1, lat: 3 }] },
    { axis: 'x', at: 2, from: 36, to: 48, h: IN, mat: 'concrete', open: [] },
    { axis: 'z', at: 48, from: -10, to: 2, h: IN, mat: 'concrete', open: [{ t: -4, w: 2, type: 'window', id: 'kE', out: 1, lat: 3 }] },
    { axis: 'z', at: 24, from: 3, to: 15, h: IN, mat: 'plaster', open: [] },
    { axis: 'x', at: 15, from: 24, to: 36, h: IN, mat: 'plaster', open: [{ t: 30, w: 2, type: 'window', id: 'sS', out: 1, lat: 3 }] },
    { axis: 'z', at: -12, from: 6, to: 24, h: 3.6, mat: 'stone', open: [{ t: 15, w: 2, type: 'window', id: 'dW', out: -1, lat: 3 }] },
    { axis: 'z', at: 12, from: 6, to: 24, h: 3.6, mat: 'stone', open: [] },
    { axis: 'x', at: 24, from: -12, to: 12, h: 3.6, mat: 'stone', open: [{ t: 0, w: 2.4, type: 'door', id: 'gate' }] }
  ],
  doors: [
    { id: 'dRO', cost: 750, zones: ['R', 'O'], label: 'Ward' },
    { id: 'dRD', cost: 1000, zones: ['R', 'D'], label: 'Courtyard' },
    { id: 'dRC', key: 'morgue', zones: ['R', 'C'], label: 'Morgue' },
    { id: 'dOK', cost: 1250, zones: ['O', 'K'], label: 'Boiler Room' },
    { id: 'dOS', cost: 1500, zones: ['O', 'S'], label: 'Operating Theatre' },
    { id: 'gate', locked: true, exit: true, zones: ['D'], label: 'Gate' }
  ],
  exit: [-1.4, 24.3, 1.4, 28],
  objectives: [
    { id: 'fuses', text: 'Find the fuses ({n}/3)', hint: 'Three fuses were pulled and hidden around the building. They glint when your torch finds them.' },
    { id: 'fusebox', text: 'Restore power in the boiler room', hint: 'The fuse box is on the far wall of the boiler room, past the ward.' },
    { id: 'radio', text: 'Call for help on the reception radio', hint: 'The radio is on the reception desk, where you started.', checkpoint: true },
    { id: 'hold', text: 'Survive until the truck arrives  {t}', hint: 'Stay alive until the truck comes. Board up broken windows (hold F) and keep moving.', time: 180, open: ['dRD'] },
    { id: 'exit', text: 'Get to the courtyard gate', hint: 'The courtyard gate is open. Run for it.' }
  ],
  fusebox: { x: 47.84, z: -.5, nx: -1, nz: 0 },
  radio: { x: -3, z: -4.3, y: 1.1, nx: 0, nz: 1 },
  fuseSpots: [{ x: 5.5, z: -19 }, { x: 33.6, z: -2.2, y: .82 }, { x: 46.8, z: -9.2 }, { x: 33, z: 6.3, y: .95 }, { x: -10.5, z: 22.5 }],
  items: [
    { kind: 'key', key: 'morgue', x: 30.4, z: 8.4, y: 1.0 },
    { kind: 'weapon', w: 'dbl', x: -1.5, z: -19 }, { kind: 'weapon', w: 'mg42', x: 40, z: 1.2 },
    { kind: 'weapon', w: 'fg42', x: 9, z: 8 }, { kind: 'weapon', w: 'ppsh', x: 35, z: 2.2 },
    { kind: 'battery', x: 6.5, z: -5.5 }, { kind: 'battery', x: 12, z: 2.2 }, { kind: 'battery', x: -3, z: -7 },
    { kind: 'battery', x: 38.5, z: -3 }, { kind: 'battery', x: -11, z: 7 }, { kind: 'battery', x: 25.5, z: 14 },
    { kind: 'medkit', x: 7.3, z: 5.3 }, { kind: 'medkit', x: 28, z: -2.5 }, { kind: 'medkit', x: 47, z: -6 },
    { kind: 'medkit', x: 35, z: 14.2 }, { kind: 'medkit', x: 7, z: -7.5 },
    { kind: 'ammo', x: -7.2, z: -5.3 }, { kind: 'ammo', x: 20, z: 2.5 }, { kind: 'ammo', x: 2, z: -7.2 },
    { kind: 'ammo', x: 36.8, z: 1.4 }, { kind: 'ammo', x: 10.5, z: 23 }, { kind: 'ammo', x: 24.6, z: 4 },
    { kind: 'grenade', x: 31.5, z: -2.5 }, { kind: 'grenade', x: -11, z: 23.2 }
  ],
  notes: [
    { note: 's1', title: 'Admissions ledger', x: -1.6, z: -4.3, y: 1.1 },
    { note: 's2', title: "A patient's diary", x: 33.8, z: -2.3, y: .82 },
    { note: 's3', title: 'Note pinned in the morgue', x: 4, z: -11, y: 1.0 },
    { note: 's4', title: "Dr Kessler's journal", x: 33, z: 6.5, y: .95 },
    { note: 's5', title: 'Maintenance memo', x: 46.6, z: 1.1, y: 1.02 },
    { note: 's6', title: 'Letter from a nurse', x: -6, z: 21.5, y: .5 },
    { note: 's7', title: 'Radio log', x: 13, z: 2.4 },
    { note: 's8', title: 'The last page', x: 1, z: -15.5, y: 1.0 }
  ],
  hides: [
    { id: 'hR1', x: 7.55, z: 3.5, nx: -1, nz: 0 }, { id: 'hR2', x: -4, z: 5.55, nx: 0, nz: -1 },
    { id: 'hC1', x: 7.55, z: -9, nx: -1, nz: 0 }, { id: 'hC2', x: 5.5, z: -6.45, nx: 0, nz: -1 },
    { id: 'hO1', x: 12, z: -2.55, nx: 0, nz: 1 }, { id: 'hO2', x: 31.5, z: 2.55, nx: 0, nz: -1 },
    { id: 'hK1', x: 36.45, z: -4, nx: 1, nz: 0 }, { id: 'hK2', x: 47.55, z: -7.5, nx: -1, nz: 0 },
    { id: 'hS1', x: 35.55, z: 6, nx: -1, nz: 0 }, { id: 'hS2', x: 24.45, z: 6.2, nx: 1, nz: 0 }
  ],
  // weepers crouch in dark corners, facing the wall
  weepers: [{ x: 7.3, z: -19.3, rot: 2.36 }, { x: 40, z: -9.4, rot: 3.14 }],
  // optional: the reception safe (combination on a page from the duty log) and the boiler valves
  // (order in the pressure log) that unlock the tool cabinet
  puzzles: [
    { id: 'safeR', type: 'code', stash: { kind: 'safe', x: 4, z: 5.55, nx: 0, nz: -1 }, clue: 'dutylog', clueSpots: [{ x: 22, z: -2.2 }, { x: 6.5, z: -15 }, { x: 27, z: 13 }],
      reward: [{ kind: 'weapon', w: 'fg42' }, { kind: 'medkit' }, { kind: 'battery' }], secret: 's-safe' },
    { id: 'valves', type: 'sequence', stash: { kind: 'cabinet', x: 44.5, z: -9.57, nx: 0, nz: 1 },
      switches: [{ x: 42, z: 1.8, nx: 0, nz: -1, label: 'red valve', color: 0xa02018, model: 'valve' }, { x: 43.5, z: 1.8, nx: 0, nz: -1, label: 'green valve', color: 0x2a7a30, model: 'valve' }, { x: 45, z: 1.8, nx: 0, nz: -1, label: 'blue valve', color: 0x2a4a9a, model: 'valve' }],
      clue: 'pressure', clueSpots: [{ x: 30, z: 12.5 }, { x: 34, z: 9 }, { x: 26.5, z: 5.5 }],
      reward: [{ kind: 'grenade' }, { kind: 'grenade' }, { kind: 'medkit' }, { kind: 'ammo' }], secret: 's-valves' }
  ],
  // night conditions: where rubble can come down, extra bodies, extra weepers
  collapses: [{ x0: 21, z0: -3, x1: 23.5, z1: .6 }, { x0: 4, z0: 9, x1: 8, z1: 12 }],
  extraLurkers: [{ x: 10, z: -1 }, { x: 31, z: -1 }, { x: 44, z: -1 }, { x: 32, z: 6.5 }],
  weeperPool: [{ x: 24.7, z: -2.4, rot: -2.36 }, { x: -11.3, z: 23.3, rot: -.79 }],
  lurkers: [{ x: 15, z: 1 }, { x: 26, z: -1.6 }, { x: 2, z: -17 }, { x: 41, z: -2 }, { x: 28, z: 11 }, { x: -6, z: 12 }],
  ceilings: [{ x: 18, z: 0 }, { x: 31, z: .5 }, { x: 2, z: -9 }],
  // she comes some time after the power is back, from wherever is furthest from you
  stalker: { x: 44, z: -3, after: 'fusebox', delay: 25, spawns: [{ x: -2, z: -18.5 }, { x: 20, z: 0 }, { x: 33, z: 12.5 }, { x: 44, z: -3 }, { x: -5, z: -2 }, { x: 13, z: 0 }] },
  traps: [{ id: 'tO', cost: 1000, sx: 19, sz: -2.84, snx: 0, snz: 1, area: [20.2, -2.85, 25, 2.85] }],
  wallBuys: [
    { w: 'kar98k', cost: 500, x: -7.84, z: 0, nx: 1, nz: 0, y: 1.6 },
    { w: 'mp40', cost: 1000, x: 10.5, z: -2.84, nx: 0, nz: 1, y: 1.6 },
    { w: 'thompson', cost: 1200, x: -3.84, z: -9, nx: 1, nz: 0, y: 1.6 },
    { w: 'trench', cost: 1500, x: -11.84, z: 9.5, nx: 1, nz: 0, y: 1.6 },
    { w: 'stg', cost: 1600, x: 39, z: -9.84, nx: 0, nz: 1, y: 1.6 }
  ],
  props: [
    { kind: 'desk', x: -3, z: -4.3, w: 3.2, d: .8, h: 1.05, collide: true },
    { kind: 'bench', x: 4, z: -5.4, w: 2, d: .5, h: .45, collide: true },
    { kind: 'cabinet', x: 7.5, z: -4.4, w: .6, d: 1.4, h: 2, collide: true },
    { kind: 'wheelchair', x: -6.5, z: 4.6, w: .7, d: .8, h: .9, collide: true },
    { kind: 'slab', x: 0, z: -11, w: 1, d: 2.2, h: .9, collide: true },
    { kind: 'slab', x: 4, z: -11, w: 1, d: 2.2, h: .9, collide: true },
    { kind: 'slab', x: 1, z: -15.5, w: 1, d: 2.2, h: .9, collide: true },
    { kind: 'drawers', x: -3.5, z: -17.5, w: .7, d: 2.4, h: 2.2, collide: true },
    { kind: 'bed', x: 33.5, z: -2.25, w: 2.1, d: .9, h: .75, collide: true },
    { kind: 'bed', x: 27, z: 2.25, w: 2.1, d: .9, h: .75, collide: true },
    { kind: 'bed', x: 17.2, z: -2.25, w: 2.1, d: .9, h: .75, collide: true },
    { kind: 'optable', x: 30, z: 8.5, w: 2.2, d: 1, h: .95, collide: true },
    { kind: 'cart', x: 33, z: 6.3, w: .9, d: .5, h: .9, collide: true },
    { kind: 'boiler', x: 43, z: -6, w: 2.6, d: 2.6, h: 3, collide: true },
    { kind: 'crate', x: 46.9, z: 1.1, w: 1, d: 1, h: 1, collide: true },
    { kind: 'crate', x: 37, z: -9, w: 1, d: 1, h: 1, collide: true },
    { kind: 'fountain', x: 0, z: 15, w: 3, d: 3, h: .8, collide: true },
    { kind: 'bench', x: -6, z: 21.5, w: 2, d: .5, h: .45, collide: true },
    { kind: 'tree', x: -8, z: 12 },
    { kind: 'tree', x: 7, z: 17.5 },
    { kind: 'grave', x: 4, z: 21 }, { kind: 'grave', x: 5.5, z: 21.4 }, { kind: 'grave', x: 7, z: 21 },
    { kind: 'bed', x: 23, z: 2.25, w: 2.1, d: .9, h: .75, collide: true },
    { kind: 'cabinet', x: 35.55, z: 12, w: .6, d: 1.4, h: 2, collide: true },
    { kind: 'debris', x: 18, z: .8, w: 1.4, d: .25, h: .08 },
    { kind: 'debris', x: -2, z: 1, w: 1.2, d: .25, h: .08 }
  ],
  groundSpawns: [{ x: -8, z: 20 }, { x: 8, z: 21.5 }, { x: -9, z: 9 }, { x: 6, z: 10 }, { x: -3, z: 22 }],
  playerSpawns: [{ x: -2, z: 2 }, { x: 2, z: 2 }, { x: -2, z: -1 }, { x: 2, z: -1 }],
  lights: [
    { x: -3, y: 3.1, z: 1, color: 0xff3a20, int: .7, dist: 11, flicker: true },
    { x: 4, y: 3.1, z: -2, color: 0xffc27a, int: 1.1, dist: 13, flicker: true, power: true },
    { x: 2, y: 3.1, z: -13, color: 0x9fd0b0, int: 1.0, dist: 12, flicker: true, power: true },
    { x: 14, y: 3.1, z: 0, color: 0xffd8a0, int: 1.0, dist: 12, power: true },
    { x: 24, y: 3.1, z: 0, color: 0xffd8a0, int: 1.0, dist: 12, power: true, flicker: true },
    { x: 33, y: 3.1, z: 0, color: 0xffd8a0, int: 1.0, dist: 12, power: true },
    { x: 42, y: 3.1, z: -4, color: 0xff9a50, int: 1.2, dist: 13, power: true },
    { x: 30, y: 3.1, z: 9, color: 0xe8f0ff, int: 1.5, dist: 13, power: true },
    { x: -10.5, y: 3.0, z: 7.5, color: 0xffb070, int: .7, dist: 12, flicker: true }
  ],
  decor: { trees: { cx: 18, cz: 2, rmin: 20, rmax: 52, n: 60, exclude: [-16, -24, 52, 28] }, sandbags: 0, crosses: 9 }
};
