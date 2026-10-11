// Headless simulation checks: `node tools/smoke.mjs`.
import { Sim as RealSim } from '../shared/sim.js';
import { CONDITIONS, drawNight, nightLine } from '../shared/night.js';
// every test runs on a plain night unless it asks for conditions
class Sim extends RealSim { constructor(m, o = {}) { super(m, Object.assign({ night: [] }, o)); } }
import { NAV_INF } from '../shared/nav.js';
import { zoneAt } from '../shared/world.js';
import { WEAPONS as WEAPONS_ } from '../shared/weapons.js';
import MAPS from '../shared/maps/index.js';
import { findInteract, objective } from '../shared/interact.js';

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '  ok    ' : '  FAIL  ') + msg); if (!cond) fail = true; };
const god = sim => { for (const p of sim.players) { if (p.st === 'a') p.hp = Math.max(p.hp, 1e6); } };
const sim0 = sm => sm;
const run = (sim, secs, each) => { for (let t = 0; t < secs; t += .05) { if (each) each(); sim.step(.05); sim.events.length = 0; } };

// A bot that walks (teleports) to a point and presses F there.
function useAt(sim, p, x, z) {
  p.x = x; p.z = z;
  sim.handle(p.id, { t: 'state', x, z, y: 0, yaw: p.yaw, pitch: 0 });
  sim.handle(p.id, { t: 'use' });
}
// Shoot the nearest awake zombie every call (perfect aim).
function shootNearest(sim, p) {
  let best = null, bd = 1e9;
  for (const z of sim.zombies) {
    if (['approach', 'rise', 'dormant', 'ceiling'].includes(z.state) || z.type === 'stalker') continue;
    const d = Math.hypot(z.x - p.x, z.z - p.z); if (d < bd) { bd = d; best = z; }
  }
  if (!best || bd > 12) return;
  const w = p.w[p.cur]; if (w.mag <= 0) { w.mag = 8; }
  w.lastShot = -9;
  sim.handle(p.id, { t: 'shot', slot: p.cur, hits: [[best.id, Math.random() < .3 ? 0 : 1, 1]], end: [best.x, 1, best.z] });
}

console.log('[sanatorium] full escape');
{
  const sim = new Sim('sanatorium'), a = sim.addPlayer('a', 'A'), b = sim.addPlayer('b', 'B');
  sim.start(); a.pts = b.pts = 1e5;
  const map = sim.map;
  const keep = () => { god(sim); shootNearest(sim, a); shootNearest(sim, b); };
  // open the paid doors from the right side
  for (const id of ['dRO', 'dOK', 'dOS', 'dRD']) {
    const d = sim.world.doors[id];
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { a.x = d.x + dx * .9; a.z = d.z + dz * .9; const it = findInteract(sim.world, sim.W, a); if (it && it.kind === 'door') { sim.handle('a', { t: 'use' }); break; } }
  }
  ok(['dRO', 'dOK', 'dOS', 'dRD'].every(id => sim.W.doors[id]), 'paid doors open');
  // the morgue key lies in the operating theatre
  const key = sim.W.items.find(i => i.kind === 'key'); useAt(sim, a, key.x, key.z);
  ok(sim.W.keys.morgue, 'morgue key picked up');
  const md = sim.world.doors.dRC; useAt(sim, a, md.x, md.z + .9);
  ok(sim.W.doors.dRC, 'morgue unlocked with the key');
  // fuse box refuses without fuses
  useAt(sim, a, map.fusebox.x - .7, map.fusebox.z);
  ok(!sim.W.power, 'no power without fuses');
  for (const f of sim.W.items.filter(i => i.kind === 'fuse')) useAt(sim, b, f.x, f.z);
  ok(sim.W.fuses === 3 && objective(map, sim.W).id === 'fusebox', 'three fuses found, objective moves to the fuse box');
  useAt(sim, a, map.fusebox.x - .7, map.fusebox.z);
  ok(sim.W.power && objective(map, sim.W).id === 'radio', 'power restored');
  run(sim, 1, keep);
  ok(!sim.zombies.some(z => z.type === 'stalker'), 'the Matron does not appear the moment the power comes back');
  run(sim, 26, keep);
  const mat = sim.zombies.find(z => z.type === 'stalker');
  ok(!!mat, 'the stalker appears some time after the power comes back');
  if (mat) {
    const far = Math.min(...[a, b].map(p => sim.nav.distAt(sim.nav.field(p.x, p.z), mat.spawnX ?? mat.x, mat.spawnZ ?? mat.z) / 4));
    ok(far >= 18, `she arrives far from the players (${far.toFixed(0)} m of walking)`);
  }
  useAt(sim, a, map.radio.x, map.radio.z + .8);
  ok(objective(map, sim.W).id === 'hold', 'radio used, holdout started');
  for (const p of [a, b]) { p.x = -2; p.z = 2; }
  run(sim, 185, keep);
  ok(objective(map, sim.W).id === 'exit' && sim.W.doors.gate, 'truck arrived, the gate is open');
  useAt(sim, a, 0, 25); useAt(sim, b, 0, 25.5);
  run(sim, .2);
  ok(sim.W.phase === 'over' && sim.W.result === 'escaped', 'both players escaped, game won');
}

console.log('[bunkier] hold out until dawn');
{
  const sim = new Sim('bunkier'), a = sim.addPlayer('a', 'A'); sim.start();
  run(sim, 605, () => { god(sim); shootNearest(sim, a); });
  ok(objective(sim.map, sim.W).id === 'exit' && sim.W.doors.d1 && sim.W.doors.gate, 'dawn: back room and hatch open');
  ok(sim.W.stalker, 'the stalker came after 5 minutes');
  useAt(sim, a, 25.5, 0); run(sim, .1);
  ok(sim.W.result === 'escaped', 'escaped through the hatch');
}

console.log('[estate] fuel, keys, engine, drive');
{
  const sim = new Sim('estate'), a = sim.addPlayer('a', 'A'); sim.start(); a.pts = 1e5;
  const map = sim.map, keep = () => { god(sim); shootNearest(sim, a); };
  for (const id of ['dHL', 'dHD', 'dDK', 'dHG', 'dGR']) { const d = sim.world.doors[id]; for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { a.x = d.x + dx * .9; a.z = d.z + dz * .9; const it = findInteract(sim.world, sim.W, a); if (it && it.kind === 'door') { sim.handle('a', { t: 'use' }); break; } } }
  for (const f of sim.W.items.filter(i => i.kind === 'fuel')) useAt(sim, a, f.x, f.z);
  ok(sim.W.got.fuel === 2 && objective(map, sim.W).item === 'carkey', 'two fuel cans found');
  run(sim, 11, keep);
  ok(sim.W.stalker, 'the Matron follows you to the estate');
  const sk = sim.W.items.find(i => i.kind === 'key'); useAt(sim, a, sk.x, sk.z);
  const sd = sim.world.doors.dLS; useAt(sim, a, sd.x, sd.z + .9);
  ok(sim.W.doors.dLS, 'study unlocked with the key from the kitchen');
  const ck = sim.W.items.find(i => i.kind === 'carkey'); useAt(sim, a, ck.x, ck.z);
  ok(objective(map, sim.W).id === 'use', 'car keys found, objective: start the car');
  const car = map.spots[0]; useAt(sim, a, car.x, car.z - .5);
  ok(objective(map, sim.W).id === 'hold', 'cranking the engine starts the holdout');
  run(sim, 125, keep);
  ok(objective(map, sim.W).id === 'exit', 'the engine catches');
  const ex = map.exit; useAt(sim, a, (ex[0] + ex[2]) / 2, (ex[1] + ex[3]) / 2); run(sim, .1);
  ok(sim.W.result === 'escaped', 'drove away from the estate');
}

console.log('[mine] dynamite, blasting machine, charges, blast, dust, out');
{
  const sim = new Sim('mine'), a = sim.addPlayer('a', 'A'); sim.start(); a.pts = 1e5;
  const map = sim.map, keep = () => { god(sim); shootNearest(sim, a); };
  for (const id of ['dEH', 'dHS', 'dHM', 'dHP']) { const d = sim.world.doors[id]; for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { a.x = d.x + dx * .9; a.z = d.z + dz * .9; const it = findInteract(sim.world, sim.W, a); if (it && it.kind === 'door') { sim.handle('a', { t: 'use' }); break; } } }
  ok(['dEH', 'dHS', 'dHM', 'dHP'].every(id => sim.W.doors[id]), 'the haulage way, stope, magazine and pump room open');
  for (const f of sim.W.items.filter(i => i.kind === 'dynamite')) useAt(sim, a, f.x, f.z);
  ok(sim.W.got.dynamite === 3 && objective(map, sim.W).item === 'detonator', 'three sticks of dynamite found');
  const key = sim.W.items.find(i => i.kind === 'key'); useAt(sim, a, key.x, key.z);
  const od = sim.world.doors.dEF; useAt(sim, a, od.x, od.z - .9);
  ok(sim.W.doors.dEF, "the foreman's office unlocked");
  const det = sim.W.items.find(i => i.kind === 'detonator'); useAt(sim, a, det.x, det.z - .7);
  ok(objective(map, sim.W).spot === 'charges', 'blasting machine found, objective: set the charges');
  const sp = id => map.spots.find(q => q.id === id);
  useAt(sim, a, sp('charges').x, sp('charges').z);
  ok(objective(map, sim.W).spot === 'plunger' && sim.checkpoint, 'charges set; checkpoint before firing');
  let blast = false;
  useAt(sim, a, sp('plunger').x, sp('plunger').z);
  for (const e of sim.events) if (e.e === 'useSpot' && e.spot === 'plunger') blast = true;
  ok(blast && objective(map, sim.W).id === 'hold', 'the charges go off; wait for the dust');
  run(sim, 91, keep);
  ok(objective(map, sim.W).id === 'exit' && sim.W.doors.gate, 'the dust settles and the drift is open');
  a.x = 58; a.z = 0; sim.handle('a', { t: 'state', x: 58, z: 0, y: 0, yaw: 0, pitch: 0 });
  run(sim, 1, keep);
  ok(sim.W.result === 'escaped', 'out on the hillside (' + sim.W.result + ')');
}

console.log('[waterworks] handwheel, three tanks, sluice, flush, the Matron dies, out');
{
  const sim = new Sim('waterworks'), a = sim.addPlayer('a', 'A'); sim.start(); a.pts = 1e5;
  const map = sim.map, keep = () => { god(sim); shootNearest(sim, a); };
  for (const id of ['dGY', 'dYP', 'dPF', 'dPC']) { const d = sim.world.doors[id]; for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { a.x = d.x + dx * .9; a.z = d.z + dz * .9; const it = findInteract(sim.world, sim.W, a); if (it && it.kind === 'door') { sim.handle('a', { t: 'use' }); break; } } }
  ok(['dGY', 'dYP', 'dPF', 'dPC'].every(id => sim.W.doors[id]), 'yard, pump hall, filter beds and pipe gallery open');
  const hw = sim.W.items.find(i => i.kind === 'handwheel'); useAt(sim, a, hw.x, hw.z);
  ok(objective(map, sim.W).spot === 'tankA', 'handwheel found, objective: drain the first tank');
  const sp = id => map.spots.find(q => q.id === id);
  useAt(sim, a, sp('tankA').x, sp('tankA').z); useAt(sim, a, sp('tankB').x, sp('tankB').z);
  ok(objective(map, sim.W).spot === 'tankC', 'two tanks drained, objective: the laboratory tank');
  // the Matron turns up and cannot die yet
  sim.spawnStalker(); const m = sim.zombies.find(z => z.type === 'stalker');
  ok(!!m && !sim.matronMortal(), 'she arrives while the serum is still in the tanks');
  sim.damageZombie(m, 1e6, 'torso', a, 'bullet'); ok(!m.dead && m.state === 'stun' && sim.zombies.includes(m), 'before the sluice she only falls down');
  m.state = 'wander';
  const key = sim.W.items.find(i => i.kind === 'key' && i.key === 'lab'); useAt(sim, a, key.x, key.z);
  const ld = sim.world.doors.dYL; for (const [dx, dz] of [[0, -.9], [0, .9]]) { useAt(sim, a, ld.x + dx, ld.z + dz); if (sim.W.doors.dYL) break; }
  ok(sim.W.doors.dYL, 'laboratory unlocked with its key');
  useAt(sim, a, sp('tankC').x, sp('tankC').z);
  ok(objective(map, sim.W).spot === 'sluice', 'all three tanks drained, objective: the sluice');
  let mortal = false;
  useAt(sim, a, sp('sluice').x, sp('sluice').z);
  for (const e of sim.events) if (e.e === 'mortal') mortal = true;
  ok(objective(map, sim.W).id === 'hold' && sim.checkpoint && mortal && sim.matronMortal(), 'sluice open: checkpoint, the works flush, she can die now');
  run(sim, 121, keep);
  ok(objective(map, sim.W).id === 'kill', 'flushed; objective: put her down for good');
  const mm = sim.zombies.find(z => z.type === 'stalker');
  ok(!!mm, 'she is on the map for the last task');
  let downs = 0, died = false;
  for (let k = 0; k < 6 && !died; k++) {
    if (mm.state === 'stun') { mm.state = 'wander'; }
    sim.damageZombie(mm, 1e6, 'torso', a, 'bullet');
    for (const e of sim.events) { if (e.e === 'stun') downs++; if (e.e === 'matronDies') died = true; }
    sim.events.length = 0;
  }
  ok(died && downs === 2 && !sim.zombies.includes(mm) && sim.W.matronDead, `she falls twice and dies the third time (downs ${downs})`);
  ok(objective(map, sim.W).id === 'exit' && sim.W.doors.gate, 'the yard gate opens');
  run(sim, 30, keep);
  ok(!sim.zombies.some(z => z.type === 'stalker'), 'she never comes back');
  a.x = 13; a.z = -12; sim.handle('a', { t: 'state', x: 13, z: -12, y: 0, yaw: 0, pitch: 0 });
  run(sim, 1, keep);
  ok(sim.W.result === 'escaped', 'out through the gate (' + sim.W.result + ')');
}

console.log('[perception]');
{
  const sim = new Sim('sanatorium'), a = sim.addPlayer('a', 'A'); sim.start();
  sim.zombies.length = 0; sim.D.phase = 'relax'; sim.D.t = 1e9;
  sim.openDoor('dRO');
  a.x = -6; a.z = 4;
  const z = sim.baseZombie('walker', 30, 0, 'wander'); sim.zombies.push(z);
  run(sim, 15, () => sim.handle('a', { t: 'state', x: -6, z: 4, y: 0, yaw: 0, pitch: 0 }));
  ok(z.state === 'wander', 'a silent player out of sight is not found (state ' + z.state + ')');
  z.x = 12; z.z = 0;
  sim.handle('a', { t: 'shot', slot: 0, hits: [], end: [0, 1, 0] });
  ok(z.state === 'investigate', 'a gunshot draws it to investigate');
  z.speed = 1.3;
  run(sim, 14, () => sim.handle('a', { t: 'state', x: -6, z: 4, y: 0, yaw: 0, pitch: 0, fl: true }));
  ok(z.state === 'chase', 'once it sees the player it chases (state ' + z.state + ')');
  const l = sim.baseZombie('walker', 3, -3, 'dormant'); sim.zombies.push(l);
  a.x = 2; a.z = -2.5;
  run(sim, .5, () => sim.handle('a', { t: 'state', x: 2, z: -2.5, y: 0, yaw: 0, pitch: 0 }));
  ok(l.state === 'wake' || l.state === 'chase', 'lurker wakes up when approached');
  const s = sim.baseZombie('stalker', 4, 4, 'wander'); sim.zombies.push(s);
  sim.damageZombie(s, 99999, 'head', a, 'gun');
  ok(sim.zombies.includes(s) && s.state === 'stun', 'stalker is knocked down, not killed');
  run(sim, 9, () => { a.hp = 1e6; });
  ok(sim.zombies.includes(s) && s.state !== 'stun', 'stalker gets back up');
  // the Matron must be outwalked: slower than a walking player (4.0 m/s) on every difficulty
  for (const d of ['easy', 'normal', 'nightmare']) {
    const sd = new Sim('bunkier', { difficulty: d }), m = sd.baseZombie('stalker', 0, 0, 'chase');
    ok(m.speed < 4.0 * .8, `Matron on ${d} chases at ${m.speed.toFixed(2)} m/s, slower than walking`);
  }
}

console.log('[hiding]');
{
  const sim = new Sim('sanatorium'), a = sim.addPlayer('a', 'A'); sim.start();
  sim.zombies.length = 0; sim.D.phase = 'relax'; sim.D.t = 1e9;
  const h = sim.map.hides.find(x => x.id === 'hR1');
  // hide in a locker while nobody sees: a passing walker ignores you
  useAt(sim, a, h.x + h.nx * .75, h.z + h.nz * .75);
  ok(a.hid === 'hR1' && sim.W.hides.hR1 === 'a', 'player hides in the locker');
  const w = sim.baseZombie('walker', 4, 3.5, 'wander'); w.speed = 1.2; sim.zombies.push(w);
  run(sim, 8, () => { if (w.state === 'wander') w.wp = { x: 6, z: 1 }; });
  ok(w.state !== 'chase' && a.hp === 100, 'a walker passing by does not find a hidden player');
  sim.handle('a', { t: 'use' });
  ok(!a.hid && Math.hypot(a.x - (h.x + h.nx * .75), a.z - (h.z + h.nz * .75)) < .1, 'player leaves the locker in front of it');
  // the Matron sees you climb in: she opens that locker and you go down
  sim.zombies.length = 0;
  const m = sim.baseZombie('stalker', 4, 3.5, 'wander'); m.rot = Math.atan2(7.55 - 4, 0); sim.zombies.push(m);
  a.x = h.x + h.nx * .75; a.z = h.z + h.nz * .75;
  run(sim, .6, () => { a.hp = 100; sim.handle('a', { t: 'state', x: a.x, z: a.z, y: 0, yaw: 0, pitch: 0, fl: true }); });
  ok(m.state === 'chase', 'the Matron spots the player');
  sim.handle('a', { t: 'use' });
  ok(a.hid && m.knows === 'hR1', 'she saw which locker the player chose');
  let opened = false;
  for (let t = 0; t < 10 && a.st === 'a'; t += .05) { sim.step(.05); for (const e of sim.events) if (e.e === 'hideOpen') opened = true; sim.events.length = 0; }
  ok(opened && a.st !== 'a', 'she pries the locker open and catches the player');
  // she loses you, then checks the nearest lockers around the last place she saw you
  const s2 = new Sim('sanatorium'), b = s2.addPlayer('b', 'B'), c2 = s2.addPlayer('c', 'C'); s2.start();
  s2.zombies.length = 0; s2.D.phase = 'relax'; s2.D.t = 1e9; c2.x = -6; c2.z = -5; c2.hp = 1e9;
  const st = s2.baseZombie('stalker', 0, 0, 'investigate'); st.tx = 6.5; st.tz = 3.5; st.t = 0; s2.zombies.push(st);
  b.x = h.x + h.nx * .75; b.z = h.z + h.nz * .75; s2.hide(b, 'hR1');
  const seen = [];
  for (let t = 0; t < 20; t += .05) { s2.step(.05); for (const e of s2.events) if (e.e === 'hideOpen') seen.push(e.hide); s2.events.length = 0; c2.hp = 1e9; }
  ok(seen.includes('hR1'), 'the Matron searches the lockers near where she lost the player (' + seen.join(',') + ')');
  // a normal zombie that saw you hide pulls you out
  const s3 = new Sim('sanatorium'), d = s3.addPlayer('d', 'D'); s3.start();
  s3.zombies.length = 0; s3.D.phase = 'relax'; s3.D.t = 1e9;
  const z3 = s3.baseZombie('walker', 5, 3.5, 'chase'); z3.tgt = 'd'; z3.seenT = 1e9; z3.speed = 1.2; s3.zombies.push(z3);
  d.x = h.x + h.nx * .75; d.z = h.z + h.nz * .75; s3.hide(d, 'hR1');
  for (let t = 0; t < 12 && d.hid; t += .05) s3.step(.05);
  ok(!d.hid && d.hp < 100, 'a walker that saw you climb in claws you out');
}

console.log('[notes and difficulty]');
{
  const sim = new Sim('sanatorium'), a = sim.addPlayer('a', 'A'); sim.start();
  const n = sim.W.items.find(i => i.kind === 'note');
  useAt(sim, a, n.x, n.z);
  ok(sim.W.notes.includes(n.note), 'reading a note records it for the whole team');
  const easy = new Sim('bunkier', { difficulty: 'easy' }), e = easy.addPlayer('e', 'E');
  const hard = new Sim('bunkier', { difficulty: 'nightmare' }), h2 = hard.addPlayer('h', 'H');
  easy.start(); hard.start();
  easy.hurtPlayer(e, 50, 7); hard.hurtPlayer(h2, 50, 7);
  ok(e.hp === 70 && h2.hp === 30 && e.pts === 1000, 'difficulty scales zombie damage and starting points');
}

console.log('[reachability] every item, document, locker and weeper can be reached');
for (const id of Object.keys(MAPS)) {
  const sm = new Sim(id); sm.addPlayer('a', 'A'); sm.start();
  for (const d in sm.world.doors) sm.openDoor(d);
  const sp = sm.map.playerSpawns[0], f = sm.nav.field(sp.x, sp.z);
  const pts = [
    ...(sm.map.items || []).filter(i => i.x !== null && i.x !== undefined).map(i => ['item ' + (i.kind || ''), i.x, i.z]),
    ...(sm.map.notes || []).map(n => ['note', n.x, n.z]),
    ...(sm.map.hides || []).map(h => ['locker ' + h.id, h.x + h.nx * .75, h.z + h.nz * .75]),
    ...(sm.map.weepers || []).map(w => ['weeper', w.x, w.z]),
    ...((sm.map.stalker && sm.map.stalker.spawns) || []).map(c => ['matron spawn', c.x, c.z]),
    ...(sm.map.puzzles || []).flatMap(pz => [...pz.clueSpots.map(c => ['clue ' + pz.id, c.x, c.z]), ['stash ' + pz.id, pz.stash.x + pz.stash.nx * .8, pz.stash.z + pz.stash.nz * .8], ...(pz.switches || []).map(q => ['switch ' + pz.id, q.x + q.nx * .6, q.z + q.nz * .6])])
  ];
  const bad = pts.filter(([, x, z]) => sm.nav.distAt(f, x, z) >= NAV_INF);
  ok(!bad.length, `${id}: ${pts.length} places reachable` + (bad.length ? ' — not: ' + bad.map(b => b[0] + ' ' + b[1] + ',' + b[2]).join('; ') : ''));
}

console.log('[matron] arrives far from the players');
for (const [id, px, pz] of [['sanatorium', 47, -.5], ['estate', -14, 17], ['bunkier', 20, 0], ['bunkier', -6, -5], ['mine', 24, -8], ['mine', 50, 0], ['waterworks', 30, 16], ['waterworks', -2, 0]]) {
  const sm = new Sim(id), a = sm.addPlayer('a', 'A'); sm.start(); sm.zombies.length = 0;
  for (const d in sm.world.doors) sm.openDoor(d);
  a.x = px; a.z = pz;
  sm.spawnStalker();
  const m = sm.zombies.find(z => z.type === 'stalker');
  const d = sm.nav.distAt(sm.nav.field(a.x, a.z), m.x, m.z) / 4, seen = sm.nav.clearLine(a.x, a.z, m.x, m.z) && Math.hypot(a.x - m.x, a.z - m.z) < 25;
  ok(d >= 18 && !seen, `${id}: with the player at ${px},${pz} she arrives ${d.toFixed(0)} m away, out of sight`);
}

console.log('[walls] nothing stands in front of wall buys, the fuse box, the radio, lockers or puzzles');
for (const id of Object.keys(MAPS)) {
  const sm = new Sim(id), map = sm.map, bad = [];
  const spots = [
    ...(map.wallBuys || []).map(w => ['buy ' + w.w, w.x, w.z, w.nx, w.nz]),
    ...[map.fusebox, map.radio].filter(Boolean).map(o => ['fusebox/radio', o.x, o.z, o.nx, o.nz]),
    ...(map.hides || []).map(h => ['locker ' + h.id, h.x, h.z, h.nx, h.nz]),
    ...(map.puzzles || []).flatMap(pz => [['stash ' + pz.id, pz.stash.x, pz.stash.z, pz.stash.nx, pz.stash.nz], ...(pz.switches || []).map(q => ['switch', q.x, q.z, q.nx, q.nz])])
  ];
  for (const [name, x, z, nx, nz] of spots) {
    // the strip of floor in front of it, from 0.45 m out (past the thing itself) to 1 m
    for (const d of [.45, .7, 1]) {
      const px = x + nx * d, pz = z + nz * d;
      const c = sm.world.colliders.find(b => !b.off && b.tag === 'prop' && px > b.minX && px < b.maxX && pz > b.minZ && pz < b.maxZ);
      if (c) { bad.push(name); break; }
    }
  }
  ok(!bad.length, `${id}: ${spots.length} things on walls are clear` + (bad.length ? ' — blocked: ' + bad.join(', ') : ''));
}

console.log('[puzzles] safes, locks and switches');
{
  const sm = new Sim('sanatorium'), a = sm.addPlayer('a', 'A'); sm.start(); sm.zombies.length = 0; sm.D.phase = 'relax'; sm.D.t = 1e9; a.hp = 1e6;
  const snap = JSON.stringify(sm.snapshot());
  ok(!snap.includes('"' + sm.answers.safeR + '"') && !Object.keys(sm.W.clues).length, 'the combination is not sent to players before they read the scrap');
  const pz = sm.puzzle('safeR'), f = { x: pz.stash.x + pz.stash.nx * .75, z: pz.stash.z + pz.stash.nz * .75 };
  a.x = f.x; a.z = f.z;
  const wrong = sm.answers.safeR === '0000' ? '1111' : '0000';
  sm.handle('a', { t: 'code', id: 'safeR', code: wrong });
  ok(!sm.W.puzzles.safeR.open && sm.W.puzzles.safeR.cd > 0, 'a wrong combination does not open the safe and jams it for a moment');
  sm.handle('a', { t: 'code', id: 'safeR', code: sm.answers.safeR });
  ok(!sm.W.puzzles.safeR.open, 'while jammed even the right one does nothing');
  for (let t = 0; t < 3.2; t += .05) { a.hp = 1e6; sm.step(.05); sm.events.length = 0; }
  const before = sm.W.items.length;
  sm.handle('a', { t: 'code', id: 'safeR', code: sm.answers.safeR });
  ok(sm.W.puzzles.safeR.open && sm.W.items.length === before + pz.reward.length + 1, 'the right combination opens the safe and lays out what was inside');
  const scrap = sm.W.items.find(i => i.kind === 'clue' && i.clue === 'valves');
  sm.pickUp(a, scrap.id);
  ok(sm.W.clues.valves && sm.answers.valves.every(i => sm.W.clues.valves.text.includes(sm.puzzle('valves').switches[i].label)), 'the pressure log names the valves');
  const order = sm.answers.valves, vp = sm.puzzle('valves');
  const turn = i => { const sw = vp.switches[i]; a.x = sw.x + sw.nx * .6; a.z = sw.z + sw.nz * .6; sm.handle('a', { t: 'use' }); };
  turn(order[1]);
  ok(!sm.W.puzzles.valves.open && sm.W.puzzles.valves.seq.length === 0, 'the wrong valve first resets the sequence');
  order.forEach(turn);
  ok(sm.W.puzzles.valves.open, 'the right order opens the tool cabinet');
  const sec = sm.W.items.find(i => i.kind === 'secret');
  sm.pickUp(a, sec.id);
  ok(Object.keys(sm.W.clues).some(k => k.startsWith('s-')) && !sm.W.notes.some(n => n.startsWith('s-')), 'secret documents are kept apart from the regular notes');
}

console.log('[night] every night is different');
{
  const counts = ['easy', 'normal', 'nightmare'].map(d => new RealSim('sanatorium', { difficulty: d }).W.night.length);
  ok(counts[0] === 2 && counts[1] === 2 && counts[2] === 3, 'two conditions a night, three on Nightmare (' + counts + ')');
  ok(!drawNight(MAPS.estate, 8).includes('power') && !drawNight(MAPS.bunkier, 8).includes('mourners'), 'only conditions that make sense for the map are drawn');
  ok(nightLine(['fog', 'storm']) === 'Tonight the fog is thick and a storm is coming.', 'the night is described in one line');
  // storm: thunder muffles noise
  const st = new Sim('bunkier', { night: ['storm'] }), sa = st.addPlayer('a', 'A'); st.start(); st.zombies.length = 0; st.D.phase = 'relax'; st.D.t = 1e9;
  let thunder = 0; for (let t = 0; t < 40; t += .05) { sa.hp = 1e6; st.step(.05); for (const e of st.events) if (e.e === 'thunder') thunder++; st.events.length = 0; }
  const zb = st.baseZombie('walker', 0, -6, 'wander'); zb.wait = 99; st.zombies.push(zb);
  st.W.thunder = 2; st.noise(0, 0, 8);
  ok(thunder >= 1 && zb.state === 'wander', `storm: thunder rolls (${thunder}x) and covers a noise that would otherwise carry`);
  st.W.thunder = 0; st.noise(0, 0, 8);
  ok(zb.state === 'investigate', 'without the thunder the same noise is heard');
  // scarce batteries
  const n0 = new Sim('sanatorium'); n0.start();
  const n1 = new Sim('sanatorium', { night: ['scarce'] }); n1.start();
  const cnt = (sm, k) => sm.W.items.filter(i => i.kind === k).length;
  ok(cnt(n1, 'battery') < cnt(n0, 'battery') && cnt(n1, 'medkit') === cnt(n0, 'medkit') + 1, `scarce: ${cnt(n0, 'battery')} → ${cnt(n1, 'battery')} batteries, one more first aid kit`);
  // restless dead and mourners
  const r1 = new Sim('sanatorium', { night: ['restless', 'mourners'] }); r1.start();
  const lurk = sm => sm.zombies.filter(z => z.state === 'dormant' || z.state === 'feed').length;
  ok(lurk(r1) > lurk(n0) || lurk(r1) === MAPS.sanatorium.lurkers.length + MAPS.sanatorium.extraLurkers.length, 'restless: more bodies lie in wait');
  ok(r1.zombies.filter(z => z.type === 'weeper').length > MAPS.sanatorium.weepers.length, 'mourners: more weepers');
  // early arrival
  const e1 = new Sim('bunkier', { night: ['early'] }), ea = e1.addPlayer('a', 'A'); e1.start(); e1.zombies.length = 0; e1.D.phase = 'relax'; e1.D.t = 1e9;
  for (let t = 0; t < 155; t += .1) { ea.hp = 1e6; e1.step(.1); e1.events.length = 0; }
  ok(e1.W.stalker, 'early: the Matron comes at half the usual time');
  // failing generator
  const g1 = new Sim('sanatorium', { night: ['power'] }), ga = g1.addPlayer('a', 'A'); g1.start(); g1.W.power = true; g1.zombies.length = 0; g1.D.phase = 'relax'; g1.D.t = 1e9; g1.D.scareT = 1e9;
  let outs = 0; for (let t = 0; t < 60; t += .1) { ga.hp = 1e6; g1.step(.1); for (const e of g1.events) if (e.e === 'generator') outs++; g1.events.length = 0; }
  ok(outs >= 1, `failing power: the lights went out ${outs} time(s) in a minute`);
  // collapse: rubble blocks part of a room but everything stays reachable
  for (const id of Object.keys(MAPS)) for (let c = 0; c < (MAPS[id].collapses || []).length; c++) {
    const sm = new Sim(id, { night: ['collapse'], collapse: c }); sm.addPlayer('a', 'A'); sm.start();
    for (const d in sm.world.doors) sm.openDoor(d);
    const sp = sm.map.playerSpawns[0], f = sm.nav.field(sp.x, sp.z), m = sm.map;
    const pts = [...(m.items || []).filter(i => i.x !== null && i.x !== undefined), ...(m.notes || []), ...(m.hides || []).map(h => ({ x: h.x + h.nx * .75, z: h.z + h.nz * .75 })),
      ...(m.puzzles || []).flatMap(pz => [...pz.clueSpots, { x: pz.stash.x + pz.stash.nx * .8, z: pz.stash.z + pz.stash.nz * .8 }]), ...(m.wallBuys || []).map(w => ({ x: w.x + w.nx * .6, z: w.z + w.nz * .6 }))];
    const cc = m.collapses[c], blocked = sm.nav.distAt(f, (cc.x0 + cc.x1) / 2, (cc.z0 + cc.z1) / 2) >= NAV_INF || sm.nav.freeCell((cc.x0 + cc.x1) / 2, (cc.z0 + cc.z1) / 2) !== sm.nav.cell((cc.x0 + cc.x1) / 2, (cc.z0 + cc.z1) / 2);
    const bad = pts.filter(q => sm.nav.distAt(f, q.x, q.z) >= NAV_INF);
    ok(blocked && !bad.length, `${id}: rubble ${c} blocks its spot, everything else reachable` + (bad.length ? ' — not: ' + bad.map(q => q.x + ',' + q.z).join('; ') : ''));
  }
  // extra lurker and weeper spots are reachable
  for (const id of Object.keys(MAPS)) {
    const sm = new Sim(id); sm.addPlayer('a', 'A'); sm.start(); for (const d in sm.world.doors) sm.openDoor(d);
    const sp = sm.map.playerSpawns[0], f = sm.nav.field(sp.x, sp.z);
    const pts = [...(sm.map.extraLurkers || []), ...(sm.map.weeperPool || [])];
    ok(pts.every(q => sm.nav.distAt(f, q.x, q.z) < NAV_INF), `${id}: ${pts.length} extra night spots reachable`);
  }
  // a few whole nights with random conditions, bots shooting, nothing breaks
  for (const id of Object.keys(MAPS)) for (let k = 0; k < 3; k++) {
    const sm = new RealSim(id, { difficulty: 'nightmare' }), a = sm.addPlayer('a', 'A'); sm.start();
    let err = null;
    try { for (let t = 0; t < 240; t += .05) { god(sm); shootNearest(sm, a); sm.step(.05); sm.events.length = 0; } } catch (e) { err = e; }
    ok(!err, `${id} with ${sm.W.night.join(', ')}: 4 minutes on Nightmare` + (err ? ' — ' + err.message : ''));
  }
}

console.log('[checkpoint] return after a wipe, twice a night');
{
  const sm = new Sim('sanatorium'), a = sm.addPlayer('a', 'A'), b = sm.addPlayer('b', 'B'); sm.start(); a.pts = 1e5;
  for (const id of ['dRO', 'dOK']) sm.openDoor(id);
  for (const f of sm.W.items.filter(i => i.kind === 'fuse')) useAt(sim0(sm), b, f.x, f.z);
  useAt(sm, a, sm.map.fusebox.x - .7, sm.map.fusebox.z);
  ok(sm.W.power && sm.W.cp && sm.checkpoint, 'a checkpoint is taken when the power comes back');
  a.w.push(sm.newWeapon('mp40')); const savedW = a.w.length;   // bought after the checkpoint: kept
  sm.openDoor('dOS'); const ptsNow = a.pts;
  const itemsAt = sm.checkpoint.W.items.length;
  ok(!sm.restoreCheckpoint(), 'no return while anyone is still alive');
  const wipe = () => { for (const p of sm.players) { p.st = 'x'; } sm.checkOver(); };
  wipe();
  ok(sm.W.phase === 'over' && sm.W.result === 'dead' && sm.canResume(), 'after a wipe the team can return');
  ok(sm.restoreCheckpoint(), 'first return');
  ok(sm.W.phase === 'play' && sm.W.power && objective(sm.map, sm.W).id === 'radio' && sm.W.items.length === itemsAt && sm.W.doors.dOK, 'the night resumes at the radio with power, items and doors as they were');
  ok(sm.players.every(p => p.st === 'a' && p.hp === p.mhp) && a.w.length === savedW && a.pts === ptsNow, 'everyone is back on their feet, keeping the points and guns they had');
  ok(sm.W.doors.dOS && sm.world.doors.dOS.col.off && sm.players.every(p => sm.zoneSet.has(zoneAt(sm.map, p.x, p.z))), 'a door bought after the checkpoint stays open, and nobody stands outside the reachable rooms');
  ok(sm.zombies.every(z => z.state === 'dormant' || z.state === 'feed' || z.state === 'weep' || z.state === 'ceiling' || z.type === 'stalker'), 'the dead start over where they lay');
  wipe(); ok(sm.restoreCheckpoint() && sm.W.retries === 2, 'second return');
  wipe(); ok(!sm.restoreCheckpoint() && sm.W.phase === 'over', 'no third return');
  // an escape after a return is not a record
  const rec = []; const fake = { add: (...x) => rec.push(x) };
  const bk = new Sim('bunkier'), ba = bk.addPlayer('a', 'A'); bk.start(); bk.zombies.length = 0; bk.D.phase = 'relax'; bk.D.t = 1e9;
  for (let t = 0; t < 305; t += .25) { ba.hp = 1e6; bk.zombies.length = 0; bk.step(.25); bk.events.length = 0; }
  ok(!!bk.checkpoint && bk.W.cp, 'the bunker takes a checkpoint half way through the night');
  void fake; void rec;
}

console.log('[combat] toughness, range, piercing, stagger, melee, reloads');
{
  const fresh = () => { const sm = new Sim('bunkier'), pl = sm.addPlayer('a', 'A'); sm.start(); sm.zombies.length = 0; sm.D.phase = 'relax'; sm.D.t = 1e9; pl.x = 0; pl.z = 0; pl.yaw = 0; pl.hp = 1e6; return [sm, pl]; };
  const W = WEAPONS_;
  {
    const [sm] = fresh(); sm.W.level = 0;
    const z0 = sm.baseZombie('walker', 0, -5, 'chase'); sm.W.level = 1; const z1 = sm.baseZombie('walker', 0, -5, 'chase');
    ok(z0.hp <= 150 && z1.hp >= 280 && z1.hp <= 320, `walkers: ${z0.hp} HP at dusk, ${z1.hp} near dawn (no bullet sponges)`);
    ok(Math.ceil(z0.hp / W.m1911.dmg) <= 4 && Math.ceil(z1.hp / W.m1911.dmg) <= 8, 'a pistol drops one in 4 body shots at dusk, 8 near dawn');
  }
  const shoot = (sm, pl, wid, hits) => { pl.w = [sm.newWeapon(wid)]; pl.cur = 0; pl.w[0].lastShot = -9; sm.handle('a', { t: 'shot', slot: 0, hits, end: [0, 1, -10] }); };
  {
    const [sm, a] = fresh(); sm.W.level = 1;
    const near = sm.baseZombie('walker', 0, -5, 'chase'), far = sm.baseZombie('walker', 1, -30, 'chase'); sm.zombies.push(near, far);
    const h0 = near.hp, h1 = far.hp;
    shoot(sm, a, 'm1911', [[near.id, 1, 1, 0]]); shoot(sm, a, 'm1911', [[far.id, 1, 1, 0]]);
    ok(h0 - near.hp > (h1 - far.hp) * 1.8, `pistol: ${Math.round(h0 - near.hp)} damage at 5 m, ${Math.round(h1 - far.hp)} at 30 m`);
    const sg = sm.baseZombie('walker', 0, -20, 'chase'); sm.zombies.push(sg); const hs = sg.hp;
    shoot(sm, a, 'trench', [[sg.id, 1, 7, 0]]);
    ok(sg.hp === hs, 'a shotgun does nothing at 20 m');
  }
  {
    const [sm, a] = fresh();
    const z1 = sm.baseZombie('walker', 0, -4, 'chase'), z2 = sm.baseZombie('walker', 0, -6, 'chase'); z1.hp = z1.maxHp = z2.hp = z2.maxHp = 1000; sm.zombies.push(z1, z2);
    shoot(sm, a, 'kar98k', [[z1.id, 1, 1, 0], [z2.id, 1, 1, 1]]);
    ok(z1.hp < 1000 && z2.hp < 1000 && 1000 - z2.hp < 1000 - z1.hp, 'a rifle round goes through the first body into the second, weaker');
    const z3 = sm.baseZombie('walker', 0, -8, 'chase'); z3.hp = z3.maxHp = 1000; sm.zombies.push(z3);
    shoot(sm, a, 'mp40', [[z3.id, 1, 1, 1]]);
    ok(z3.hp === 1000, 'an SMG round does not go through');
  }
  {
    const [sm, a] = fresh();
    const z = sm.baseZombie('walker', 0, -1.2, 'chase'); z.tgt = 'a'; z.seenT = 0; sm.zombies.push(z);
    z.pending = { p: 'a', t: .2, r: 1.3 }; const zz = z.z;
    shoot(sm, a, 'trench', [[z.id, 1, 7, 0]]);
    ok(z.dead || (z.pending === null && z.stagger > 0 && z.z < zz), 'a close shotgun blast rocks it back and breaks off its swing');
  }
  {
    const [sm, a] = fresh();
    const z = sm.baseZombie('walker', 0, -1.3, 'chase'); z.tgt = 'a'; z.seenT = 0; z.rot = 0; sm.zombies.push(z);
    z.pending = { p: 'a', t: .3, r: 1.3 }; const zz = z.z, hp = z.hp;
    sm.handle('a', { t: 'knife' });
    ok(z.pending === null && z.stagger > 0 && z.z < zz - .5 && z.hp < hp && !z.dead, 'V shoves an attacker back, breaks off its swing, cuts it');
    sm.step(.05);
    const hpBefore = a.hp, hurt = []; for (let t = 0; t < .5; t += .05) { sm.step(.05); for (const e of sm.events) if (e.e === 'hurt') hurt.push(e); sm.events.length = 0; }
    ok(a.hp === hpBefore && !hurt.length, 'the blow it was winding up never lands');
    // a feeder from behind: quiet kill
    const f = sm.baseZombie('walker', 0, -1.2, 'feed'); f.rot = Math.PI; sm.zombies.push(f);   // facing away (+z is toward the player... rot=π faces -z)
    sm.W.time = 0; a.lastKnife = -9; sm.handle('a', { t: 'knife' });
    ok(f.dead, 'a feeder taken from behind dies quietly');
    const w2 = sm.baseZombie('walker', 0, -1.2, 'chase'); w2.tgt = 'a'; w2.rot = 0; sm.zombies.push(w2); a.lastKnife = -9; sm.time += 1;
    sm.handle('a', { t: 'knife' });
    ok(!w2.dead, 'one that is coming for you does not');
    a.grabT = .8; a.lastKnife = -9; sm.time += 1; sm.handle('a', { t: 'knife' });
    ok(a.grabT === 0, 'V tears you free of a grab');
  }
  {
    const [sm, a] = fresh();
    a.w = [sm.newWeapon('m1911')]; a.cur = 0; a.w[0].mag = 3; a.w[0].lastReload = -9;
    sm.handle('a', { t: 'reloaded', slot: 0 });
    ok(a.w[0].mag === 9, 'a tactical reload leaves one in the chamber (' + a.w[0].mag + ')');
    a.w[0].mag = 0; sm.time += 5; sm.handle('a', { t: 'reloaded', slot: 0 });
    ok(a.w[0].mag === 8, 'from empty: a full magazine and nothing more');
    a.w = [sm.newWeapon('trench')]; a.w[0].mag = 2; a.w[0].lastReload = -9;
    sm.handle('a', { t: 'reloaded', slot: 0 }); sm.handle('a', { t: 'reloaded', slot: 0 });
    ok(a.w[0].mag === 3, 'the trench gun takes one shell at a time, and not faster than hands can');
  }
}

console.log('[hiding rules] witnesses, and no walking out through walls');
{
  const mk = () => { const sm = new Sim('bunkier'), a = sm.addPlayer('a', 'A'); sm.start(); sm.zombies.length = 0; sm.D.phase = 'relax'; sm.D.t = 1e9; a.hp = 1e6; return [sm, a]; };
  const h = MAPS.bunkier.hides[0];
  {
    const [sm, a] = mk(); a.x = h.x + h.nx * .75; a.z = h.z + h.nz * .75;
    // a chaser around the corner, out of sight
    const z = sm.baseZombie('walker', a.x + 6, a.z + 6, 'chase'); z.tgt = 'a'; z.seenT = 0; z.rot = Math.PI; sm.zombies.push(z);
    sm.hide(a, h.id);
    for (let t = 0; t < 8; t += .05) { sm.step(.05); sm.events.length = 0; }
    ok(!z.knows && z.state !== 'pry' && a.hid, 'unseen: it loses you (' + z.state + ')');
  }
  {
    const [sm, a] = mk(); a.x = h.x + h.nx * .75; a.z = h.z + h.nz * .75;
    const z = sm.baseZombie('walker', a.x + h.nx * 4, a.z + h.nz * 4, 'chase'); z.tgt = 'a'; z.seenT = 0; z.rot = Math.atan2(-h.nx, -h.nz); sm.zombies.push(z);
    sm.hide(a, h.id);
    ok(z.knows === h.id, 'watched: it knows which locker');
  }
  {
    const [sm, a] = mk(); a.x = h.x + h.nx * .75; a.z = h.z + h.nz * .75;
    sm.hide(a, h.id); const tpIn = a.tp; sm.unhide(a);
    sm.handle('a', { t: 'state', tp: tpIn, x: h.x - h.nx * 2, z: h.z - h.nz * 2, y: 0, yaw: 0, pitch: 0 });
    ok(Math.hypot(a.x - (h.x + h.nx * .75), a.z - (h.z + h.nz * .75)) < .01, 'a position sent from inside the locker cannot drag you through the wall');
  }
}

console.log('[new dead]');
{
  // a quiet bunker with nothing in it but what each test puts there
  const fresh = () => { const sm = new Sim('bunkier'), pl = sm.addPlayer('a', 'A'); sm.start(); sm.zombies.length = 0; sm.D.phase = 'relax'; sm.D.t = 1e9; return [sm, pl]; };
  const stand = (sm, pl, x, z, yaw = 0, fl = false) => { pl.x = x; pl.z = z; pl.hp = 1e6; sm.handle('a', { t: 'state', x, z, y: 0, yaw, pitch: 0, fl }); };
  {
    const [sm, a] = fresh();
    const sc = sm.baseZombie('screamer', 0, -4, 'wander'); sc.rot = 0; sm.zombies.push(sc);   // facing +z, toward the player
    const far = sm.baseZombie('walker', -8, 6, 'wander'); far.wait = 99; sm.zombies.push(far);
    let howled = false, fled = false;
    for (let t = 0; t < 3; t += .05) { stand(sm, a, 0, 2); sm.step(.05); if (sc.state === 'flee') fled = true; for (const e of sm.events) if (e.e === 'howl') howled = true; sm.events.length = 0; }
    ok(howled, 'the screamer howls when it sees you');
    ok(far.state === 'investigate' || far.state === 'chase', 'its howl brings others (walker ' + far.state + ')');
    ok(fled, 'and then it runs off');
  }
  {
    const [sm, a] = fresh();
    const br = sm.baseZombie('brute', 0, -5, 'chase'); br.tgt = 'a'; br.seenT = 0; br.chargeCd = 0; sm.zombies.push(br);
    let charged = false, hurt = false; a.hp = 1e6;
    for (let t = 0; t < 3; t += .05) { a.x = 0; a.z = 2; sm.handle('a', { t: 'state', x: 0, z: 2, y: 0, yaw: Math.PI, pitch: 0 }); const h0 = a.hp; br.seenT = sm.time; sm.step(.05); if (a.hp < h0) hurt = true; for (const e of sm.events) if (e.e === 'charge') charged = true; sm.events.length = 0; }
    ok(charged, 'the brute charges from a distance');
    ok(hurt, 'and the charge hits');
  }
  {
    const [sm, a] = fresh();
    const w = sm.baseZombie('weeper', 0, -4, 'weep'); w.rot = Math.PI; sm.zombies.push(w);
    for (let t = 0; t < 1; t += .05) { stand(sm, a, 0, 3, 0, false); sm.step(.05); sm.events.length = 0; }
    ok(w.state === 'weep', 'the weeper keeps weeping in the dark at a distance');
    sm.noise(0, -3, 20);
    ok(w.state === 'weep', 'and ignores noise');
    let gone = false;
    for (let t = 0; t < 6; t += .05) { stand(sm, a, 0, 2.5, 0, true); sm.step(.05); for (const e of sm.events) if (e.e === 'vanish') gone = true; sm.events.length = 0; }
    ok(w.state === 'rush' || gone, 'light on her and she comes (' + w.state + ')');
    ok(gone && !sm.zombies.includes(w), 'she strikes and vanishes');
  }
  {
    const [sm, a] = fresh();
    const f = sm.baseZombie('walker', 0, -5, 'feed'); sm.zombies.push(f);
    for (let t = 0; t < 1; t += .05) { stand(sm, a, 0, 4, 0); sm.step(.05); }
    ok(f.state === 'feed', 'a feeder keeps eating while you are far away');
    for (let t = 0; t < 1; t += .05) { stand(sm, a, 0, -3, 0); sm.step(.05); }
    ok(f.state !== 'feed', 'and gets up when you come close (' + f.state + ')');
  }
  {
    const [sm, a] = fresh();
    const g = sm.baseZombie('walker', 0, 1, 'chase'); g.tgt = 'a'; g.seenT = 0; sm.zombies.push(g);
    g.atkV = 1; g.pending = { p: 'a', t: 0, r: 1.3 };
    stand(sm, a, 0, 2); sm.step(.05);
    ok(a.grabT > 0, 'a grab holds the player');
  }
  {
    const [sm, a] = fresh();
    const pack = [-1.2, 0, 1.2].map(x => { const z = sm.baseZombie('walker', x, -7, 'chase'); z.tgt = 'a'; z.speed = 1.4; sm.zombies.push(z); return z; });
    for (let t = 0; t < 7; t += .05) { stand(sm, a, 0, 0); for (const z of pack) z.seenT = sm.time; sm.step(.05); sm.events.length = 0; }
    const angs = pack.map(z => Math.atan2(z.z - a.z, z.x - a.x)).sort((p, q) => p - q);
    ok(angs[2] - angs[0] > 1.2, 'a pack closes in from different sides (spread ' + (angs[2] - angs[0]).toFixed(2) + ' rad)');
  }
}

console.log('[ceiling] shot down from the ceiling');
{
  const sm = new Sim('bunkier'), a = sm.addPlayer('a', 'A'); sm.start(); sm.zombies.length = 0; sm.D.phase = 'relax'; sm.D.t = 1e9;
  const c = sm.baseZombie('thin', 0, -4, 'ceiling'); c.y = 2.9; sm.zombies.push(c);
  a.x = 0; a.z = 3; a.hp = 1e6;
  sm.damageZombie(c, 1, 'torso', a, 'gun');
  for (let t = 0; t < 1; t += .05) { a.hp = 1e6; sm.step(.05); sm.events.length = 0; }
  ok(c.y === 0, 'a ceiling crawler that is shot drops all the way to the floor (y=' + c.y + ')');
  ok(c.state === 'chase' && c.tgt === 'a', 'and comes for the shooter (' + c.state + ')');
  const g = sm.baseZombie('walker', 3, -4, 'rise'); g.t = 1.8; g.y = -1.7; sm.zombies.push(g);
  sm.damageZombie(g, 1, 'torso', a, 'gun');
  for (let t = 0; t < 2.5; t += .05) { a.hp = 1e6; sm.step(.05); sm.events.length = 0; }
  ok(g.y === 0, 'one shot while climbing out of the ground still gets out (y=' + g.y + ')');
}

console.log('[co-op] down and revive');
{
  const sim = new Sim('bunkier'), a = sim.addPlayer('a', 'A'), b = sim.addPlayer('b', 'B'); sim.start();
  sim.zombies.length = 0; sim.D.phase = 'relax'; sim.D.t = 1e9;
  a.x = 0; a.z = 0; b.x = .5; b.z = 0;
  sim.hurtPlayer(b, 999);
  ok(b.st === 'd' && sim.W.phase === 'play', 'B is down, game goes on');
  run(sim, 3.2, () => sim.handle('a', { t: 'state', x: 0, z: 0, y: 0, yaw: 0, pitch: 0, f: true }));
  ok(b.st === 'a', 'A revives B by holding F');
  sim.hurtPlayer(b, 999); sim.hurtPlayer(a, 999);
  ok(sim.W.phase === 'over' && sim.W.result === 'dead', 'everyone down: game over');
  const solo = new Sim('bunkier'), s = solo.addPlayer('s', 'S'); solo.start();
  solo.hurtPlayer(s, 999);
  ok(solo.W.phase === 'over', 'solo: going down is death');
}

console.log('[soak] 15 minutes per map with shooting bots');
for (const id of Object.keys(MAPS)) {
  const sim = new Sim(id), a = sim.addPlayer('a', 'A'), b = sim.addPlayer('b', 'B'); sim.start();
  for (const d in sim.world.doors) if (!sim.world.doors[d].locked) sim.openDoor(d);
  const far = { sanatorium: [42, -2], bunkier: [18, 0], estate: [26, 18], mine: [50, 0], waterworks: [50, 0] }[id]; b.x = far[0]; b.z = far[1];
  let kills = 0, attacks = 0, peaks = 0, scares = 0, stuck = 0;
  const t0 = Date.now();
  for (let t = 0; t < 900; t += .05) {
    god(sim); if (Math.random() < .07) { shootNearest(sim, a); shootNearest(sim, b); }   // bots that miss most of the time, like people
    for (const p of [a, b]) sim.handle(p.id, { t: 'state', x: p.x, z: p.z, y: 0, yaw: p.yaw, pitch: 0, fl: true });
    sim.step(.05);
    for (const e of sim.events) { if (e.e === 'kill') kills++; if (e.e === 'zatk') attacks++; if (e.e === 'peak') peaks++; if (e.e === 'scare') scares++; }
    sim.events.length = 0;
    stuck = sim.zombies.filter(z => z.state === 'chase' && z.stuckT > 10).length;
  }
  console.log(`  ${id}: kills=${kills} attacks=${attacks} peaks=${peaks} scares=${scares} level=${sim.W.level.toFixed(2)} alive=${sim.zombies.length} (${Date.now() - t0} ms)`);
  ok(kills > 30 && attacks > 0 && peaks >= 5, `${id}: the director keeps the pressure on`);
  ok(stuck === 0, `${id}: no zombie stuck in a chase`);
}
process.exit(fail ? 1 : 0);
