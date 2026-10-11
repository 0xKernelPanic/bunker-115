// Wolf Hollow Waterworks: the last night. Serum 115 went into the valley's water here. Drain the
// three serum tanks, open the main sluice and flush the works while everything comes for you.
// With the serum gone the Matron can finally die: put her down for good, then leave by the yard gate.
export default {
  id: 'waterworks',
  name: 'Wolf Hollow Waterworks',
  blurb: 'The last night. Drain the serum from the valley\'s water, and end the Matron for good.',
  last: true,
  notePrefix: 'w',
  rescue: 'The tanks are empty. Her lantern is coming. FINISH IT.',
  // waterworks men, laboratory staff and the guards they posted
  clothes: [{ top: [62, 64, 68], pants: [48, 50, 52], style: 'overalls' }, { top: [150, 148, 138], pants: [60, 58, 54], style: 'coat' }, { top: [70, 72, 60], pants: [56, 58, 48], style: 'uniform' }, { top: [88, 74, 52], pants: [60, 54, 44], style: 'overalls' }],
  ambience: ['drip', 'drip', 'creak', 'rumble'],
  hasPower: false,
  navBounds: [-8.5, -14, 54.5, 22.5],
  fog: { color: 0x06080a, near: 1, far: 20 },
  ambient: 0x10141a,
  zones: [
    { id: 'G', name: 'Gatehouse', rects: [[-8, -6, 4, 6]], start: true, floor: 'concrete', ceil: 3.2 },
    { id: 'Y', name: 'Yard', rects: [[4, -10, 22, 10]], floor: 'ground', ceil: 0 },
    { id: 'P', name: 'Pump Hall', rects: [[22, -10, 40, 10]], floor: 'concrete', ceil: 6 },
    { id: 'F', name: 'Filter Beds', rects: [[22, 10, 40, 22]], floor: 'tiles', ceil: 4 },
    { id: 'L', name: 'Dosing Laboratory', rects: [[10, 10, 22, 20]], floor: 'tiles', ceil: 3.2 },
    { id: 'C', name: 'Pipe Gallery', rects: [[40, -4, 54, 4]], floor: 'concrete', ceil: 2.6 }
  ],
  walls: [
    // gatehouse
    { axis: 'x', at: -6, from: -8, to: 4, h: 3.2, mat: 'brick', open: [{ t: -3, w: 2, type: 'window', id: 'gS', out: -1, lat: 2 }] },
    { axis: 'x', at: 6, from: -8, to: 4, h: 3.2, mat: 'brick', open: [{ t: -3, w: 2, type: 'window', id: 'gN', out: 1, lat: 2 }] },
    { axis: 'z', at: -8, from: -6, to: 6, h: 3.2, mat: 'brick', open: [{ t: 0, w: 2, type: 'window', id: 'gW', out: -1, lat: 2 }] },
    { axis: 'z', at: 4, from: -10, to: 10, h: 3.2, mat: 'brick', open: [{ t: 0, w: 2.4, type: 'door', id: 'dGY' }] },
    // the yard: a low stone wall with the gate out to the valley road
    { axis: 'x', at: -10, from: 4, to: 22, h: 3, mat: 'stone', open: [{ t: 7, w: 2, type: 'window', id: 'yS1', out: -1, lat: 3 }, { t: 13, w: 2.4, type: 'door', id: 'gate' }, { t: 19, w: 2, type: 'window', id: 'yS2', out: -1, lat: 3 }] },
    { axis: 'x', at: 10, from: 4, to: 22, h: 3.2, mat: 'stone', open: [{ t: 7, w: 2, type: 'window', id: 'yN', out: 1, lat: 3 }, { t: 16, w: 2.4, type: 'door', id: 'dYL' }] },
    { axis: 'z', at: 22, from: -10, to: 10, h: 6, mat: 'brick', open: [{ t: 0, w: 2.4, type: 'door', id: 'dYP' }] },
    // pump hall
    { axis: 'x', at: -10, from: 22, to: 40, h: 6, mat: 'brick', open: [{ t: 27, w: 2, type: 'window', id: 'pS1', out: -1, lat: 2 }, { t: 35, w: 2, type: 'window', id: 'pS2', out: -1, lat: 2 }] },
    { axis: 'x', at: 10, from: 22, to: 40, h: 6, mat: 'brick', open: [{ t: 31, w: 2.4, type: 'door', id: 'dPF' }] },
    { axis: 'z', at: 40, from: -10, to: 10, h: 6, mat: 'brick', open: [{ t: 0, w: 2.4, type: 'door', id: 'dPC' }, { t: 7, w: 2, type: 'window', id: 'pE', out: 1, lat: 2 }] },
    // filter beds
    { axis: 'x', at: 22, from: 22, to: 40, h: 4, mat: 'concrete', open: [{ t: 27, w: 2, type: 'window', id: 'fN1', out: 1, lat: 2 }, { t: 36, w: 2, type: 'window', id: 'fN2', out: 1, lat: 2 }] },
    { axis: 'z', at: 40, from: 10, to: 22, h: 4, mat: 'concrete', open: [{ t: 16, w: 2, type: 'window', id: 'fE', out: 1, lat: 2 }] },
    { axis: 'z', at: 22, from: 10, to: 22, h: 4, mat: 'concrete', open: [] },
    // dosing laboratory
    { axis: 'x', at: 20, from: 10, to: 22, h: 3.2, mat: 'plaster', open: [{ t: 14, w: 2, type: 'window', id: 'lN', out: 1, lat: 2 }] },
    { axis: 'z', at: 10, from: 10, to: 20, h: 3.2, mat: 'plaster', open: [{ t: 15, w: 2, type: 'window', id: 'lW', out: -1, lat: 2 }] },
    // pipe gallery
    { axis: 'x', at: -4, from: 40, to: 54, h: 2.6, mat: 'concrete', open: [{ t: 47, w: 2, type: 'window', id: 'cS', out: -1, lat: 2 }] },
    { axis: 'x', at: 4, from: 40, to: 54, h: 2.6, mat: 'concrete', open: [{ t: 50, w: 2, type: 'window', id: 'cN', out: 1, lat: 2 }] },
    { axis: 'z', at: 54, from: -4, to: 4, h: 2.6, mat: 'concrete', open: [] }
  ],
  doors: [
    { id: 'dGY', cost: 500, zones: ['G', 'Y'], label: 'Yard' },
    { id: 'dYP', cost: 1000, zones: ['Y', 'P'], label: 'Pump Hall' },
    { id: 'dPF', cost: 1250, zones: ['P', 'F'], label: 'Filter Beds' },
    { id: 'dYL', key: 'lab', zones: ['Y', 'L'], label: 'Dosing Laboratory' },
    { id: 'dPC', cost: 1500, zones: ['P', 'C'], label: 'Pipe Gallery' },
    { id: 'gate', locked: true, exit: true, zones: ['Y'], label: 'Yard Gate' }
  ],
  exit: [11.6, -13.6, 14.4, -10.3],
  objectives: [
    { id: 'collect', item: 'handwheel', n: 1, text: 'Find a valve handwheel', hint: 'The handwheels were taken off the drain valves so nobody could empty the tanks. One is still somewhere in the works.' },
    { id: 'use', spot: 'tankA', prompt: 'Open the drain on the serum tank', text: 'Drain the first serum tank, in the filter beds', hint: 'The serum tanks stand in the filter beds, through the pump hall. Draining one is loud.', noise: 26 },
    { id: 'use', spot: 'tankB', prompt: 'Open the drain on the serum tank', text: 'Drain the second serum tank', hint: 'The second tank is at the far end of the filter beds.', noise: 26 },
    { id: 'use', spot: 'tankC', prompt: 'Open the drain on the dosing tank', text: 'Drain the dosing tank in the laboratory', hint: 'The last tank is in the dosing laboratory, off the yard. Its door needs the laboratory key.', noise: 26 },
    { id: 'use', spot: 'sluice', prompt: 'Throw open the main sluice', text: 'Open the main sluice at the end of the pipe gallery', hint: 'The sluice wheel is at the far end of the pipe gallery, beyond the pump hall. Everything will hear it.', noise: 70 },
    { id: 'hold', text: 'The works are flushing  {t}', hint: 'Stay alive until the water runs clean. She can be hurt now.', time: 120, checkpoint: true },
    { id: 'kill', text: 'Put the Matron down for good  ({n}/3)', hint: 'Without the serum she is dying. Every time she falls she gets up weaker. Put her down three times.' },
    { id: 'exit', text: 'Get out through the yard gate', hint: 'The yard gate is open. Walk out into the morning.' }
  ],
  spots: [{ id: 'tankA', x: 28, z: 15.4, r: 1.6 }, { id: 'tankB', x: 35, z: 15.4, r: 1.6 }, { id: 'tankC', x: 16, z: 15.6, r: 1.6 }, { id: 'sluice', x: 51.2, z: 0, r: 1.6 }],
  randomItems: [
    { kind: 'handwheel', n: 1, spots: [{ x: -6.5, z: 4.4 }, { x: 20.5, z: -8.6 }, { x: 38.4, z: -8.4 }, { x: 24, z: 20.6 }] },
    { kind: 'key', n: 1, spots: [{ x: 38.4, z: 8.4, key: 'lab' }, { x: 24, z: -8.4, key: 'lab' }, { x: 38.6, z: 20.6, key: 'lab' }, { x: 52.6, z: 3 , key: 'lab' }] }
  ],
  items: [
    { kind: 'weapon', w: 'ppsh', x: 2.5, z: 4.6, y: .82 }, { kind: 'weapon', w: 'fg42', x: 13, z: 18.6, y: .97 }, { kind: 'weapon', w: 'mg42', x: 46, z: 3 }, { kind: 'weapon', w: 'dbl', x: 32, z: 20.6 },
    { kind: 'battery', x: -2, z: -4.8 }, { kind: 'battery', x: 6, z: 8.5 }, { kind: 'battery', x: 30, z: -8.6 }, { kind: 'battery', x: 23.5, z: 12 }, { kind: 'battery', x: 20.6, z: 11.6 }, { kind: 'battery', x: 44, z: -3 },
    { kind: 'medkit', x: -7, z: -4.8 }, { kind: 'medkit', x: 16, z: -8.8 }, { kind: 'medkit', x: 38.5, z: 0 }, { kind: 'medkit', x: 38.5, z: 12 }, { kind: 'medkit', x: 53, z: -3 },
    { kind: 'ammo', x: 3, z: -4.8 }, { kind: 'ammo', x: 6, z: -8.6 }, { kind: 'ammo', x: 24, z: 8.6 }, { kind: 'ammo', x: 30, z: 12 }, { kind: 'ammo', x: 42, z: 3 }, { kind: 'ammo', x: 53, z: 3 },
    { kind: 'grenade', x: 23.5, z: -2 }, { kind: 'grenade', x: 11, z: 11.5 }, { kind: 'grenade', x: 48, z: -3 }
  ],
  notes: [
    { note: 'w1', title: 'Notice nailed to the gatehouse door', x: 1, z: 4.4, y: .02 },
    { note: 'w2', title: 'Chlorination log', x: 30, z: -6, y: .02 },
    { note: 'w3', title: 'Dosing schedule', x: 18.6, z: 18.6, y: .97 },
    { note: 'w4', title: 'A nurse\'s cap, folded around a letter', x: 33, z: 12, y: .02 },
    { note: 'w5', title: 'Painted on the sluice housing', x: 49.5, z: -3.3, y: .02 }
  ],
  hides: [
    { id: 'hG1', x: -7.55, z: 3, nx: 1, nz: 0 }, { id: 'hY1', x: 21.55, z: -7, nx: -1, nz: 0 }, { id: 'hP1', x: 39.55, z: -6, nx: -1, nz: 0 },
    { id: 'hF1', x: 22.45, z: 19, nx: 1, nz: 0 }, { id: 'hL1', x: 10.45, z: 12, nx: 1, nz: 0 }, { id: 'hC1', x: 44, z: 3.55, nx: 0, nz: -1 }
  ],
  // optional: the superintendent's safe in the gatehouse, its combination on a scrap in the works
  puzzles: [
    { id: 'safeW', type: 'code', stash: { kind: 'safe', x: -7.45, z: -2.5, nx: 1, nz: 0 }, clue: 'chlorine', clueSpots: [{ x: 26, z: 6 }, { x: 37, z: 18 }, { x: 44, z: 1.5 }],
      reward: [{ kind: 'weapon', w: 'stg' }, { kind: 'grenade' }, { kind: 'grenade' }, { kind: 'medkit' }], secret: 'w-safe' }
  ],
  // night conditions
  collapses: [{ x0: 10, z0: -4, x1: 13, z1: -1 }, { x0: 30, z0: 2, x1: 34, z1: 5 }],
  extraLurkers: [{ x: 14, z: 4 }, { x: 28, z: -4 }, { x: 46, z: 1.5 }],
  weeperPool: [{ x: 39.3, z: 21.3, rot: -2.36 }, { x: 10.7, z: 19.3, rot: 2.36 }],
  weepers: [{ x: 39.3, z: -9.3, rot: -.79 }],
  lurkers: [{ x: 9, z: 4 }, { x: 18, z: -5 }, { x: 26, z: 2 }, { x: 36, z: -6 }, { x: 31, z: 18 }, { x: 14, z: 13 }, { x: 47, z: -1.5 }],
  ceilings: [{ x: 31, z: 0 }, { x: 25, z: 16 }, { x: 44, z: 0 }],
  // she comes to guard the serum once you start draining it; with the sluice open she can die
  stalker: { x: 36, z: 0, afterObj: 2, delay: 15, mortal: 5, spawns: [{ x: 36, z: 0 }, { x: 37, z: 19 }, { x: 52, z: 0 }, { x: 8, z: -8 }, { x: 16, z: 12 }] },
  wallBuys: [
    { w: 'kar98k', cost: 500, x: 1, z: -5.84, nx: 0, nz: 1, y: 1.5 },
    { w: 'mp40', cost: 1000, x: 22.16, z: -6, nx: 1, nz: 0, y: 1.6 },
    { w: 'thompson', cost: 1200, x: 34, z: 9.84, nx: 0, nz: -1, y: 1.6 },
    { w: 'trench', cost: 1500, x: 39.84, z: 14, nx: -1, nz: 0, y: 1.5 },
    { w: 'stg', cost: 1600, x: 47, z: -3.84, nx: 0, nz: 1, y: 1.5 }
  ],
  props: [
    // gatehouse
    { kind: 'desk', x: 0, z: 4.4, w: 2, d: .9, h: .85, collide: true },
    { kind: 'chair', x: 0, z: 3.6, w: .5, d: .5, h: .9 },
    { kind: 'table', x: 2.5, z: 4.6, w: 1.6, d: .9, h: .8, collide: true },
    { kind: 'cabinet', x: -7.6, z: -5, w: .6, d: 1.2, h: 2, collide: true },
    { kind: 'bench', x: -3, z: -5.5, w: 2.2, d: .5, h: .45, collide: true },
    // yard
    { kind: 'barrels', x: 18, z: -9.2, w: 2, d: 1, h: 1.1, collide: true },
    { kind: 'crate', x: 6, z: -9, w: 1.2, d: 1.2, h: 1, collide: true },
    { kind: 'crate', x: 20.6, z: 4, w: 1, d: 1, h: 1, collide: true },
    { kind: 'tree', x: 9, z: -3 },
    { kind: 'debris', x: 14, z: 2, w: 1.6, d: .3, h: .1 },
    // pump hall: two great pumps with the water channel between them
    { kind: 'pump', x: 28, z: -5, w: 4, d: 2.4, h: 2.6, collide: true },
    { kind: 'pump', x: 34, z: 5, w: 4, d: 2.4, h: 2.6, collide: true },
    { kind: 'water', x: 31, z: 0, w: 14, d: 3, h: .02 },
    { kind: 'pipe', x: 31, z: -9.6, w: 17, d: .3, h: 3.4 },
    { kind: 'pipe', x: 31, z: 9.6, w: 17, d: .3, h: 4.2 },
    // filter beds and their serum tanks
    { kind: 'tank', x: 28, z: 17.6, w: 2.4, d: 2.4, h: 3.2, collide: true, spot: 'tankA' },
    { kind: 'tank', x: 35, z: 17.6, w: 2.4, d: 2.4, h: 3.2, collide: true, spot: 'tankB' },
    { kind: 'water', x: 31, z: 12.6, w: 16, d: 2.6, h: .02 },
    { kind: 'pipe', x: 31, z: 21.6, w: 17, d: .3, h: 3.2 },
    // dosing laboratory
    { kind: 'tank', x: 16, z: 17.8, w: 2, d: 2, h: 2.6, collide: true, spot: 'tankC' },
    { kind: 'counter', x: 13, z: 19.2, w: 3, d: .8, h: .95, collide: true },
    { kind: 'counter', x: 19.4, z: 19.2, w: 2, d: .8, h: .95, collide: true },
    { kind: 'cart', x: 19, z: 12, w: 1, d: .6, h: .8, collide: true },
    { kind: 'drawers', x: 21.6, z: 15, w: .6, d: 1.2, h: 1.2, collide: true },
    // pipe gallery and the main sluice
    { kind: 'pipe', x: 47, z: -3.6, w: 14, d: .3, h: 1.6 },
    { kind: 'pipe', x: 47, z: 3.6, w: 14, d: .3, h: 2.1 },
    { kind: 'pump', x: 52.8, z: 0, w: 2, d: 2.2, h: 2, collide: true },
    { kind: 'water', x: 47, z: 0, w: 13, d: 6.5, h: .02 }
  ],
  groundSpawns: [{ x: 8, z: 6 }, { x: 18, z: 6 }, { x: 16, z: -6 }],
  playerSpawns: [{ x: -2, z: 1 }, { x: 1, z: 1 }, { x: -2, z: -2 }, { x: 1, z: -2 }],
  lights: [
    { x: -2, y: 2.9, z: 0, color: 0xffc27a, int: .9, dist: 11, flicker: true },
    { x: 13, y: 3.2, z: 0, color: 0xb8c8e0, int: .6, dist: 14 },
    { x: 26, y: 5.4, z: 0, color: 0xc8e0ff, int: .8, dist: 13, flicker: true },
    { x: 36, y: 5.4, z: 0, color: 0xffb060, int: .6, dist: 12 },
    { x: 31, y: 3.6, z: 16, color: 0x9fd0a0, int: .9, dist: 13, flicker: true },
    { x: 16, y: 2.9, z: 15, color: 0x9fd0a0, int: .7, dist: 10, flicker: true },
    { x: 47, y: 2.4, z: 0, color: 0xff6040, int: .7, dist: 10, flicker: true }
  ],
  decor: { trees: { cx: 23, cz: 6, rmin: 36, rmax: 62, n: 56, exclude: [-12, -18, 58, 26] }, sandbags: 0, crosses: 5 }
};
