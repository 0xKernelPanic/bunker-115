// Headless browser checks of the real client. Needs the server running (npm start).
// Usage: node tools/browser-test.mjs solo|visual|over|coop [outDir]
import { launch, sleep } from './cdp.mjs';
const mode = process.argv[2] || 'solo';
const out = process.argv[3] || '.';
const URL = process.env.URL || 'http://localhost:8115/client/';
const PASS = process.env.PASS || ''; // server password, when the server has one
const b = await launch();
// opens the game, going through the login page first when the server has a password
async function openPage() {
  const p = await b.page(URL);
  await sleep(800);
  if (PASS && await p.eval(`!!document.querySelector('input[name=password]')`)) {
    await p.eval(`document.querySelector('input[name=password]').value = ${JSON.stringify(PASS)}; document.querySelector('form').submit(); 'ok'`);
    await sleep(1500);
  }
  if (!await p.waitFor(`typeof __b115 !== 'undefined'`)) console.log('the game did not start:\n' + p.logs.slice(0, 15).join('\n') + '\npage: ' + await p.eval('location.href + " " + document.title').catch(e => e.message));
  return p;
}
const logs = p => p.logs.filter(l => !/AudioContext/.test(l)).slice(0, 20).join('\n');
try {
  if (mode === 'solo' || mode === 'visual' || mode === 'over' || mode === 'story') {
    const p = await openPage();
    await sleep(3500);
    if (mode === 'solo') await p.shot(`${out}/menu.png`);
    await p.eval(`__b115.startSolo(); __b115.app.noLock = true; 'ok'`);
    await sleep(6500);
    const run = js => p.eval(`(() => { const G = __b115.G, sim = G.tr.sim, me = sim.players[0]; ${js} })()`);
    if (mode === 'solo') {
      await p.shot(`${out}/dark-flashlight.png`);
      await p.eval(`__b115.press('KeyL'); 'ok'`); await sleep(800);
      await p.shot(`${out}/dark-no-light.png`);
      await p.eval(`__b115.press('KeyL'); 'ok'`);
      console.log(await run(`sim.D.phase = 'relax'; sim.D.t = 1e9; sim.zombies.length = 0;
        for (let i = 0; i < 4; i++) { const z = sim.baseZombie(i === 3 ? 'thin' : 'walker', -2 + i * 1.3, -3.5, 'chase'); z.tgt = me.id; z.seenT = 1e9; z.speed = .2; sim.zombies.push(z); }
        return 'zombies ' + sim.zombies.length;`));
      await sleep(1500);
      await p.eval(`__b115.mouse(true); 'ok'`); await sleep(2500); await p.eval(`__b115.mouse(false); 'ok'`);
      console.log(await run(`return 'pts=' + me.pts + ' kills=' + me.kills + ' bat=' + me.bat.toFixed(3) + ' objective=' + document.getElementById('objText').textContent;`));
      await p.shot(`${out}/fight.png`);
    }
    if (mode === 'visual') {
      // stalker and a ceiling hanger in the ward with the lights on
      await run(`sim.D.phase = 'relax'; sim.D.t = 1e9; sim.zombies.length = 0; for (const id of ['dRO','dOK','dOS']) sim.openDoor(id); sim.W.power = true;
        const s = sim.baseZombie('stalker', 17, .5, 'wander'); s.speed = .01; sim.zombies.push(s);
        const c = sim.baseZombie('thin', 14, 0, 'ceiling'); c.y = 3.1; sim.zombies.push(c);
        const l = sim.baseZombie('walker', 12.5, -1.5, 'dormant'); sim.zombies.push(l);
        G.P.x = 10; G.P.z = .3; G.P.yaw = -Math.PI / 2; G.P.pitch = .05; return 'ok';`);
      await sleep(2500); await p.shot(`${out}/stalker.png`);
      await run(`G.P.pitch = .75; return 'ok';`); await sleep(1200); await p.shot(`${out}/ceiling.png`);
      // items with glints in reception
      await run(`G.P.x = 0; G.P.z = 4; G.P.yaw = 0; G.P.pitch = -.35; sim.W.power = false; return 'ok';`); await sleep(1500); await p.shot(`${out}/items.png`);
    }
    if (mode === 'story') {
      // a locker from the inside, with the Matron passing
      await run(`sim.D.phase = 'relax'; sim.D.t = 1e9; sim.zombies.length = 0; sim.W.power = true;
        const m = sim.baseZombie('stalker', 4.5, 2.5, 'wander'); m.speed = .01; sim.zombies.push(m);
        me.x = 6.8; me.z = 3.5; sim.hide(me, 'hR1'); return 'hid=' + me.hid;`).then(console.log);
      await sleep(2000); await p.shot(`${out}/locker.png`);
      await run(`sim.unhide(me); return 'ok';`);
      await sleep(800);
      // read a note
      await run(`const n = sim.W.items.find(i => i.kind === 'note' && i.note === 's6'); sim.pickUp(me, n.id); return 'ok';`);
      await sleep(1200); await p.shot(`${out}/note.png`);
      await p.eval(`__b115.press('KeyF'); 'ok'`); await sleep(300);
      await p.eval(`__b115.press('KeyJ'); 'ok'`); await sleep(800); await p.shot(`${out}/journal.png`);
      await p.eval(`__b115.press('KeyJ'); 'ok'`); await sleep(300);
      // a hallucination: force fear up and show the figure
      await run(`G.P.x = 14; G.P.z = 0; G.P.yaw = -Math.PI / 2; G.P.pitch = 0; sim.openDoor('dRO'); G.fear.rebuildNav(); return 'ok';`);
      await sleep(600);
      await run(`G.fear.level = 1; G.fear.showGhost(G.camera, new __b115.THREE.Vector3(1, 0, 0)); return 'ghost=' + G.fear.ghost.group.visible;`).then(console.log);
      await sleep(250); await p.shot(`${out}/ghost.png`);
      console.log('screen:', await p.eval(`__b115.app.screen + ' reading=' + __b115.G.reading + ' journal=' + __b115.G.journal`));
    }
    if (mode === 'over') {
      await run(`sim.W.obj.i = sim.map.objectives.length - 1; sim.openDoor('gate'); sim.openDoor('dRD'); return 'ok';`);
      await run(`G.P.x = 0; G.P.z = 25; return 'ok';`);
      await sleep(5000);
      console.log('screen:', await p.eval(`__b115.app.screen + ' | ' + document.getElementById('overTitle').textContent + ' | ' + document.getElementById('overTime').textContent`));
      await p.shot(`${out}/won.png`);
      await p.eval(`document.getElementById('againBtn').click(); 'ok'`);
      await sleep(6500);
      console.log('after restart:', await p.eval(`__b115.app.screen + ' phase=' + __b115.G.latest.W.phase + ' obj=' + document.getElementById('objText').textContent`));
    }
    console.log(logs(p));
  }
  if (mode === 'finale') {
    // the last night: the tanks, the Matron put down three times, the lantern, out of the gate, the credits
    const p = await openPage();
    await sleep(3000);
    await p.eval(`[...document.querySelectorAll('#maps .mapcard')].find(b => b.textContent.includes('Waterworks')).click(); __b115.startSolo(); __b115.app.noLock = true; 'ok'`);
    await sleep(6500);
    const run = js => p.eval(`(() => { const G = __b115.G, sim = G.tr.sim, me = sim.players[0]; ${js} })()`);
    await run(`for (const id in sim.world.doors) if (!sim.world.doors[id].locked) sim.openDoor(id); sim.D.phase = 'relax'; sim.D.t = 1e9; sim.zombies.length = 0; G.P.x = 28; G.P.z = 13; G.P.yaw = 0; G.P.pitch = .1; return 1;`);
    await sleep(1500); await p.shot(`${out}/finale-tanks.png`);
    // drain the tanks (shows the empty sight glass), open the sluice, skip the flush
    await run(`sim.W.got.handwheel = 1; sim.checkCollect(); sim.advance(); sim.advance(); sim.advance(); return sim.W.obj.i;`);
    await sleep(5000); await p.shot(`${out}/finale-drained.png`);
    await run(`sim.advance(); sim.W.obj.t = .5; return sim.W.obj.i;`);
    await sleep(2000);
    console.log(await run(`const m = sim.zombies.find(z => z.type === 'stalker'); if (m) { m.x = 30; m.z = 8; m.state = 'wander'; m.speed = .01; } G.P.x = 30; G.P.z = 2; G.P.yaw = Math.PI; return 'objective=' + sim.map.objectives[sim.W.obj.i].id + ' matron=' + !!m + ' text=' + document.getElementById('objText').textContent;`));
    await sleep(1500); await p.shot(`${out}/finale-matron.png`);
    for (let k = 0; k < 3; k++) {
      await run(`const m = sim.zombies.find(z => z.type === 'stalker'); if (m) { m.state = 'wander'; sim.damageZombie(m, 1e6, 'torso', me, 'gun'); } return 1;`);
      await sleep(1500);
    }
    console.log(await run(`return 'dead=' + sim.W.matronDead + ' objective=' + sim.map.objectives[sim.W.obj.i].id + ' lantern=' + G.lanternLight.intensity.toFixed(2);`));
    await p.shot(`${out}/finale-dead.png`);
    await run(`G.P.x = 13; G.P.z = -12; return 1;`);
    await sleep(6000);
    console.log('screen:', await p.eval(`__b115.app.screen + ' | ' + document.getElementById('overTitle').textContent + ' | credits=' + !document.getElementById('credits').hidden`));
    await sleep(12000); await p.shot(`${out}/finale-credits.png`);
    await p.eval(`document.getElementById('creditsSkip').click(); 'ok'`); await sleep(1200);
    console.log('after credits:', await p.eval(`'credits hidden=' + document.getElementById('credits').hidden + ' ach=' + document.getElementById('achBtn').textContent`));
    await p.shot(`${out}/finale-over.png`);
    console.log(logs(p));
  }
  if (mode === 'chaos') {
    // every map: random input plus every objective, item, hide and event, looking for client exceptions
    for (const mapName of ['Wolf Hollow', 'Kessler', 'Bunker', 'Mine', 'Waterworks']) {
      const p = await openPage();
      await sleep(3000);
      await p.eval(`[...document.querySelectorAll('#maps .mapcard')].find(b => b.textContent.includes('${mapName}')).click(); __b115.startSolo(); __b115.app.noLock = true; 'ok'`);
      await sleep(6500);
      const run = js => p.eval(`(() => { const G = __b115.G, sim = G.tr.sim, me = sim.players[0]; ${js} })()`);
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'];
      for (let i = 0; i < 40; i++) {
        await run(`me.hp = Math.max(me.hp, 90); me.pts = 1e5; for (const k of ${JSON.stringify(keys)}) __b115.key(k, Math.random() < .3); __b115.mouse(Math.random() < .4); G.P.yaw += (Math.random() - .5) * 1.5; return 1;`);
        const step = i % 10;
        if (step === 1) await run(`for (const id in sim.world.doors) if (!sim.world.doors[id].locked) sim.openDoor(id); return 1;`);
        if (step === 2) await run(`const it = sim.W.items[Math.random() * sim.W.items.length | 0]; if (it) sim.pickUp(me, it.id); if (G.reading) __b115.press('KeyF'); return 1;`);
        if (step === 3) await run(`const h = (sim.map.hides || [])[0]; if (h && !me.hid) { me.x = h.x + h.nx * .8; me.z = h.z + h.nz * .8; sim.hide(me, h.id); } return 1;`);
        if (step === 4) await run(`if (me.hid) sim.unhide(me); return 1;`);
        if (step === 5) await run(`if (sim.W.phase === 'play' && sim.W.obj.i < sim.map.objectives.length - 1) { const o = sim.map.objectives[sim.W.obj.i]; if (o.id === 'fuses') { sim.W.fuses = 3; sim.checkFuses(); } else if (o.id === 'collect') { sim.W.got[o.item] = o.n; sim.checkCollect(); } else if (o.id === 'fusebox') { sim.W.power = true; sim.advance(); } else if (o.id === 'hold') sim.W.obj.t = 1; else sim.advance(); } return 1;`);
        if (step === 6) await run(`sim.spawnStalker(); sim.D.phase = 'peak'; sim.D.t = 20; sim.spawnDog(); const z = sim.zombies.find(q => q.type !== 'stalker'); if (z) { sim.gib(z, 'legL'); sim.damageZombie(z, 1e9, 'head', me, 'gun'); } return 1;`);
        if (step === 7) await run(`__b115.press('KeyG'); __b115.press('KeyV'); __b115.press('KeyL'); __b115.press('KeyQ'); __b115.press('KeyR'); return 1;`);
        if (step === 8) await run(`__b115.press('KeyJ'); return 1;`);
        if (step === 9) await run(`if (G.journal) __b115.press('KeyJ'); sim.W.blackout = 3; G.fear.level = 1; return 1;`);
        await sleep(350);
      }
      await run(`__b115.mouse(false); for (const k of ${JSON.stringify(keys)}) __b115.key(k, false); return 1;`);
      const state = await p.eval(`(() => { const G = __b115.G; return G ? 'obj=' + G.latest.W.obj.i + ' phase=' + G.latest.W.phase + ' screen=' + __b115.app.screen + ' zombies=' + G.latest.z.length : 'no game'; })()`);
      const errs = [...new Set(p.logs.filter(l => /EXCEPTION|error/i.test(l) && !/AudioContext/.test(l)))];
      console.log(mapName + ': ' + state + (errs.length ? '\n  ' + errs.slice(0, 6).join('\n  ') : '  (no errors)'));
      await p.shot(`${out}/chaos-${mapName.split(' ')[0]}.png`);
    }
  }
  if (mode === 'puzzle') {
    // read the duty log scrap, type the combination into the reception safe, then the boiler valves
    const p = await openPage();
    await sleep(1200);
    await p.eval(`__b115.startSolo(); __b115.app.noLock = true; 'ok'`);
    await sleep(7000);
    const run = js => p.eval(`(() => { const G = __b115.G, sim = G.tr.sim, me = sim.players[0]; ${js} })()`);
    await run(`document.getElementById('clickPlay').style.display = 'none'; G.tr.paused = false; sim.D.phase = 'relax'; sim.D.t = 1e9; sim.zombies.length = 0; me.hp = 1e6; return 1;`);
    // move the player in the page and in the simulation (which would otherwise walk there through the walls)
    const goTo = (x, z, yaw, pitch = -.35) => run(`G.P.x = me.x = ${x}; G.P.z = me.z = ${z}; G.P.yaw = ${yaw}; G.P.pitch = ${pitch}; return 1;`);
    const scrap = JSON.parse(await run(`const it = sim.W.items.find(i => i.kind === 'clue' && i.clue === 'safeR'); return JSON.stringify(it);`));
    await goTo(scrap.x, scrap.z + .3, 0); await sleep(700);
    console.log('prompt at scrap:', await run(`return document.getElementById('prompt') ? document.getElementById('prompt').textContent : '';`));
    await p.eval(`__b115.press('KeyF'); 'ok'`); await sleep(900);
    console.log('reader:', await run(`return document.getElementById('readerTitle').textContent + ' | code shown: ' + document.getElementById('readerText').textContent.includes(sim.answers.safeR);`));
    await p.shot(`${out}/puzzle-scrap.png`);
    await p.eval(`__b115.press('KeyF'); 'ok'`); await sleep(500);
    await goTo(4, 4.8, Math.PI); await sleep(900);
    await p.eval(`__b115.press('KeyF'); 'ok'`); await sleep(500);
    console.log('keypad open:', await run(`return !document.getElementById('keypad').hidden;`));
    const code = await run(`return sim.answers.safeR;`);
    for (const ch of code) { await p.eval(`dispatchEvent(new KeyboardEvent('keydown', { key: '${ch}', code: 'Digit${ch}' })); dispatchEvent(new KeyboardEvent('keyup', { key: '${ch}', code: 'Digit${ch}' })); 'ok'`); await sleep(120); }
    await p.shot(`${out}/puzzle-keypad.png`);
    await p.eval(`dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter' })); dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter' })); 'ok'`);
    await sleep(1800);
    console.log('safe open:', await run(`return sim.W.puzzles.safeR.open + ' | items in front: ' + sim.W.items.filter(i => Math.hypot(i.x - 4, i.z - 4.7) < 1.5).map(i => i.kind + (i.w ? ':' + i.w : '')).join(',') + ' | keypad hidden: ' + document.getElementById('keypad').hidden;`));
    await p.shot(`${out}/puzzle-safe.png`);
    // valves: turn them in tonight's order
    for (const i of JSON.parse(await run(`return JSON.stringify(sim.answers.valves);`))) {
      await run(`const sw = sim.puzzle('valves').switches[${i}]; G.P.x = me.x = sw.x; G.P.z = me.z = sw.z - .6; G.P.yaw = 0; G.P.pitch = .1; return 1;`);
      await sleep(600); await p.eval(`__b115.press('KeyF'); 'ok'`); await sleep(500);
    }
    await sleep(1500);
    await goTo(44.5, -7.6, Math.PI); await sleep(900);
    console.log('cabinet open:', await run(`return sim.W.puzzles.valves.open;`));
    await p.shot(`${out}/puzzle-cabinet.png`);
    const errs = p.logs.filter(l => /EXCEPTION|error/i.test(l) && !/AudioContext/.test(l));
    console.log(errs.length ? errs.slice(0, 5).join('\n') : '(no errors)');
  }
  if (mode === 'checkpoint') {
    // the mine: blow the drift (a screenshot of the blast), then die and come back from the checkpoint
    const p = await openPage();
    await sleep(1200);
    await p.eval(`(() => { const b = [...document.querySelectorAll('#maps button')].find(x => x.textContent.includes('Mine')); b.click(); __b115.startSolo(); __b115.app.noLock = true; return 1; })()`);
    await sleep(7500);
    const run = js => p.eval(`(() => { const G = __b115.G, sim = G.tr.sim, me = sim.players[0]; ${js} })()`);
    await run(`document.getElementById('clickPlay').style.display = 'none'; G.tr.paused = false; me.hp = 1e6; sim.zombies.length = 0; sim.D.phase = 'relax'; sim.D.t = 1e9;
      for (const d of ['dEH', 'dHP']) sim.openDoor(d); G.P.x = me.x = 36; G.P.z = me.z = 0; G.P.yaw = -Math.PI / 2; G.P.pitch = 0; return 1;`);
    await sleep(800);
    // jump to "fire the charges" and press the plunger
    await run(`while (sim.map.objectives[sim.W.obj.i].spot !== 'plunger') sim.advance(); const s = sim.map.spots.find(q => q.id === 'plunger'); G.P.x = me.x = s.x; G.P.z = me.z = s.z; return 1;`);
    console.log('checkpoint taken:', await run(`return !!sim.checkpoint + ' ' + JSON.stringify(sim.W.cp);`));
    await sleep(500);
    await p.eval(`__b115.press('KeyF'); 'ok'`);
    await sleep(700); await p.shot(`${out}/mine-blast.png`);
    console.log('after the blast:', await run(`return sim.map.objectives[sim.W.obj.i].id + ' shake=' + (G.shake || 0).toFixed(2);`));
    // everyone dies
    await run(`for (const q of sim.players) q.st = 'x'; sim.checkOver(); return 1;`);
    await sleep(3500);
    console.log('over screen:', await run(`return __b115.app.screen + ' | button: ' + (!document.getElementById('cpBtn').hidden) + ' "' + document.getElementById('cpBtn').textContent + '"';`));
    await p.shot(`${out}/checkpoint-over.png`);
    const r = await p.eval(`(() => { const b = document.getElementById('cpBtn').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
    await p.click(r[0], r[1]);
    await sleep(1500);
    console.log('after return:', await run(`return __b115.app.screen + ' | phase ' + sim.W.phase + ' | retries ' + sim.W.retries + ' | objective ' + sim.map.objectives[sim.W.obj.i].spot + ' | alive ' + (me.st === 'a');`));
    const errs = p.logs.filter(l => /EXCEPTION|error/i.test(l) && !/AudioContext/.test(l));
    console.log(errs.length ? errs.slice(0, 5).join('\n') : '(no errors)');
  }
  if (mode === 'combat') {
    // shots, reloads and V against real targets in the bunker
    const p = await openPage();
    await sleep(1200);
    await p.eval(`(() => { const b = [...document.querySelectorAll('#maps button')].find(x => x.textContent.includes('Bunker')); b.click(); window.__forceNight = []; __b115.startSolo(); __b115.app.noLock = true; return 1; })()`);
    await sleep(7500);
    const run = js => p.eval(`(() => { const G = __b115.G, sim = G.tr.sim, me = sim.players[0]; ${js} })()`);
    await run(`document.getElementById('clickPlay').style.display = 'none'; G.tr.paused = false; me.hp = 1e6; sim.zombies.length = 0; sim.D.phase = 'relax'; sim.D.t = 1e9;
      G.P.x = me.x = 0; G.P.z = me.z = 2; G.P.yaw = 0; G.P.pitch = 0; G.P.flashOn = true; return 1;`);
    const put = (type, x, z, state, rot) => run(`const z = sim.baseZombie('${type}', ${x}, ${z}, '${state}'); z.rot = ${rot}; z.speed = .01; z.tgt = me.id; z.seenT = 1e9; z.hp = z.maxHp = 5000; sim.zombies.push(z); window.__z = z.id; return z.id;`);
    // a burst from the MP40 into a target: recoil climbs, then settles
    await put('walker', 0, -4, 'chase', 0);
    await run(`me.w = [sim.newWeapon('mp40')]; me.cur = 0; return 1;`); await sleep(500);
    const pitch0 = await run(`return G.P.pitch;`);
    await p.eval(`__b115.mouse(true); 'ok'`); await sleep(900);
    const pitchHi = await run(`return G.P.pitch;`);
    await p.shot(`${out}/combat-burst.png`);
    await p.eval(`__b115.mouse(false); 'ok'`); await sleep(900);
    const pitchBack = await run(`return G.P.pitch;`);
    console.log('recoil: climbed', (pitchHi - pitch0).toFixed(3), '| came back to', (pitchBack - pitch0).toFixed(3), '| target hp', await run(`return sim.zombies.find(z => z.id === __z).hp;`));
    // tactical reload: one in the chamber
    await run(`me.w = [sim.newWeapon('m1911')]; me.w[0].mag = 3; me.cur = 0; return 1;`); await sleep(300);
    await p.eval(`__b115.press('KeyR'); 'ok'`); await sleep(1800);
    console.log('tactical reload, pistol mag:', await run(`return me.w[0].mag;`));
    // trench gun: one shell at a time
    await run(`me.w = [sim.newWeapon('trench')]; me.w[0].mag = 2; me.cur = 0; return 1;`); await sleep(300);
    await p.eval(`__b115.press('KeyR'); 'ok'`); await sleep(1500);
    console.log('trench gun after 1.5 s of loading:', await run(`return me.w[0].mag;`));
    // V: shove the one in front of you
    await run(`sim.zombies.length = 0; return 1;`);
    await put('walker', 0, .8, 'chase', Math.PI);
    await run(`const z = sim.zombies[0]; z.pending = { p: me.id, t: .4, r: 1.3 }; window.__zz = z.z; return 1;`);
    await p.eval(`__b115.press('KeyV'); 'ok'`); await sleep(150);
    await p.shot(`${out}/combat-shove.png`);
    console.log('shove:', await run(`const z = sim.zombies[0]; return 'swing broken ' + (z.pending === null) + ', pushed ' + (window.__zz - z.z).toFixed(2) + ' m';`));
    // a feeder with its back to you
    await sleep(800);
    await run(`sim.zombies.length = 0; return 1;`);
    await put('walker', 0, .8, 'feed', Math.PI);
    await p.eval(`__b115.press('KeyV'); 'ok'`); await sleep(400);
    console.log('backstab: feeder dead', await run(`return !sim.zombies.some(z => z.id === __z);`));
    const errs = p.logs.filter(l => /EXCEPTION|error/i.test(l) && !/AudioContext/.test(l));
    console.log(errs.length ? errs.slice(0, 5).join('\n') : '(no errors)');
  }
  if (mode === 'login') {
    const p = await b.page(URL);
    await sleep(800);
    console.log('before:', await p.eval(`document.title + ' | ' + document.body.innerText.trim().replace(/\\s+/g, ' ')`));
    await p.eval(`document.querySelector('input[name=password]').value = 'definitely wrong'; document.querySelector('form').submit(); 'ok'`);
    await sleep(1800);
    console.log('wrong:', await p.eval(`document.body.innerText.trim().replace(/\\s+/g, ' ')`));
    await p.shot(`${out}/login.png`);
  }
  if (mode === 'coop') {
    const a = await openPage(), c = await openPage();
    await sleep(3000);
    await a.eval(`document.getElementById('nick').value = 'Alice'; document.getElementById('hostBtn').click(); 'ok'`);
    await sleep(1500);
    const code = await a.eval(`document.getElementById('lobbyCode').textContent`);
    console.log('code:', code);
    await c.eval(`document.getElementById('nick').value = 'Bob'; document.getElementById('joinCode').value = '${code}'; document.getElementById('joinBtn').click(); 'ok'`);
    await sleep(1500);
    console.log('lobby:', await a.eval(`[...document.querySelectorAll('#lobbyPlayers li')].map(l => l.textContent).join(' | ')`));
    await a.eval(`document.getElementById('startBtn').click(); 'ok'`);
    await sleep(2500);
    for (const pg of [a, c]) { await pg.front(); await pg.eval(`__b115.app.noLock = true; document.getElementById('resumeBtn').click(); 'ok'`); }
    // Alice walks to the battery in reception and picks it up; Bob should see it gone
    await a.front();
    await a.eval(`(() => { const G = __b115.G; const it = G.latest.W.items.find(i => ['battery', 'ammo', 'medkit'].includes(i.kind) && Math.abs(i.x) < 8 && Math.abs(i.z) < 6); G.P.x = it.x; G.P.z = it.z; window.__item = it.id; return it.id; })()`).then(v => console.log('item:', v));
    await sleep(800);
    console.log('A prompt:', await a.eval(`document.getElementById('prompt').textContent + ' | screen=' + __b115.app.screen + ' P=' + __b115.G.P.x.toFixed(1) + ',' + __b115.G.P.z.toFixed(1)`));
    await a.eval(`__b115.press('KeyF'); 'ok'`);
    await sleep(1200);
    const itemId = await a.eval(`window.__item`);
    console.log('Alice sees item:', await a.eval(`!!__b115.G.latest.W.items.find(i => i.id === '${itemId}')`), ' Bob sees item:', await c.eval(`!!__b115.G.latest.W.items.find(i => i.id === '${itemId}')`));
    console.log('Bob sees players:', await c.eval(`__b115.G.latest.p.map(p => p.name + ':' + p.st).join(', ')`));
    await c.front(); await sleep(2000);
    await c.shot(`${out}/coop.png`);
    console.log('A:', logs(a)); console.log('B:', logs(c));
  }
} finally { b.close(); }
