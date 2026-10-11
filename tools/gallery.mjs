// Screenshots of characters lined up in front of the camera inside a running solo game.
// Usage: node tools/gallery.mjs teammates|zombies|matron [outDir]   (needs the server running; PASS=... if it has a password)
import { launch, sleep } from './cdp.mjs';
const what = process.argv[2] || 'teammates';
const out = process.argv[3] || '.';
const URL = process.env.URL || 'http://localhost:8115/client/';
const PASS = process.env.PASS || '';
const MAP = process.env.MAP || 'bunkier';

const b = await launch({ port: 9355 });
try {
  const p = await b.page(URL);
  await sleep(1000);
  if (PASS && await p.eval(`!!document.querySelector('input[name=password]')`)) {
    await p.eval(`document.querySelector('input[name=password]').value = ${JSON.stringify(PASS)}; document.querySelector('form').submit(); 'ok'`);
    await sleep(1500);
  }
  await sleep(1500);
  await p.eval(`(() => { const b = [...document.querySelectorAll('#maps button')].find(x => x.dataset.map === '${MAP}' || x.textContent.toLowerCase().includes('${MAP === 'bunkier' ? 'bunker' : MAP}')); if (b) b.click(); __b115.startSolo(); return 'ok'; })()`);
  await sleep(7000);
  // freeze the night, clear the dead, light the stage
  const setup = await p.eval(`(async () => {
    const { G, THREE } = __b115;
    window.__rig = await import('/client/render/rig.js');
    G.tr.paused = true; G.tr.sim.zombies.length = 0;
    // LIGHT=torch: the game's own darkness, lit only by your flashlight
    const torch = ${JSON.stringify(process.env.LIGHT === 'torch')};
    G.P.flashOn = torch; G.vmRoot.visible = false; G.tr.sim.players[0].bat = 1;
    document.getElementById('clickPlay').style.display = 'none';
    const amb = new THREE.AmbientLight(0xffffff, torch ? .12 : 1.4); G.scene.add(amb); window.__amb = amb;
    G.scene.fog.far = 60;
    window.__gal = [];
    return 'P=' + G.P.x.toFixed(1) + ',' + G.P.z.toFixed(1);
  })()`);
  console.log('setup', setup);
  if (what === 'rooms') {
    await p.eval(`(() => { __amb.intensity = Number(${JSON.stringify(process.env.AMB || '.55')}); document.getElementById('hud').hidden = true; return 1; })()`);
    const zones = await p.eval(`JSON.stringify(__b115.G.map.zones.filter(z => z.ceil).map(z => ({ id: z.id, r: z.rects[0] })))`);
    for (const z of JSON.parse(zones)) {
      const [x0, z0, x1, z1] = z.r, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      for (const [k, [px, pz]] of [[x0 + 1, z0 + 1], [x1 - 1, z1 - 1]].entries()) {
        await p.eval(`(() => { const P = __b115.G.P; P.x = ${px}; P.z = ${pz}; P.yaw = Math.atan2(-(${cx} - ${px}), -(${cz} - ${pz})); P.pitch = -.05; return 1; })()`);
        await sleep(700);
        await p.shot(`${out}/room-${MAP}-${z.id}${k}.png`);
      }
    }
    console.log('render info', JSON.stringify(await p.eval('__b115.info()')));
    b.close(); process.exit();
  }
  const lineup = what === 'teammates' ? [
    { kind: 'mate', w: 'mp40', pitch: 0 }, { kind: 'mate', w: 'kar98k', pitch: 0, ads: true }, { kind: 'mate', w: 'm1911', pitch: .45 },
    { kind: 'mate', w: 'thompson', pitch: 0, sp: true }, { kind: 'mate', w: 'stg', pitch: -.35, rl: true }, { kind: 'mate', w: 'trench', pitch: .2 }
  ] : what === 'matron' ? [
    { kind: 'z', type: 'stalker', mode: 'walk', speed: 1 }, { kind: 'z', type: 'stalker', mode: 'walk', speed: 2.7 }, { kind: 'z', type: 'walker', mode: 'walk', speed: 1 }
  ] : what === 'poses' ? [
    { kind: 'z', type: 'walker', mode: 'feed', speed: 0 }, { kind: 'z', type: 'walker', mode: 'trip', speed: 0, k: .5 }, { kind: 'z', type: 'weeper', mode: 'weep', speed: 0 },
    { kind: 'z', type: 'thin', mode: 'walk', speed: .5, shield: true }, { kind: 'z', type: 'walker', mode: 'walk', speed: .5, swing: .55, atk: 1 },
    { kind: 'z', type: 'brute', mode: 'walk', speed: .5, swing: .3, atk: 3 }, { kind: 'z', type: 'screamer', mode: 'scream', speed: 0 }, { kind: 'z', type: 'brute', mode: 'charge', speed: 5 }
  ] : [
    { kind: 'z', type: 'walker', mode: 'walk', speed: 1 }, { kind: 'z', type: 'walker', mode: 'walk', speed: 1, seed: 3 }, { kind: 'z', type: 'walker', mode: 'walk', speed: 1, seed: 6 },
    { kind: 'z', type: 'thin', mode: 'run', speed: 3 }, { kind: 'z', type: 'bloater', mode: 'walk', speed: .9 }, { kind: 'z', type: 'crawler', mode: 'crawl', speed: .9 },
    { kind: 'z', type: 'screamer', mode: 'walk', speed: 1.5 }, { kind: 'z', type: 'brute', mode: 'walk', speed: 1.1 }, { kind: 'z', type: 'weeper', mode: 'run', speed: 4 }
  ];
  await p.eval(`(() => {
    const { G, THREE } = __b115, ent = G.ent, list = ${JSON.stringify(lineup)};
    const cam = G.camera, fwd = cam.getWorldDirection(new THREE.Vector3()); fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x), n = list.length;
    list.forEach((it, i) => {
      const pos = cam.position.clone().addScaledVector(fwd, 3.2 + (n > 4 ? .6 : 0)).addScaledVector(right, (i - (n - 1) / 2) * (n > 6 ? .85 : .95)); pos.y = 0;
      const face = Math.atan2(-fwd.x, -fwd.z);
      if (it.kind === 'mate') {
        const pl = { id: 'gal' + i, name: it.w, color: '#e9c46a', st: 'a', pitch: it.pitch, sp: !!it.sp, ads: !!it.ads, rl: !!it.rl, w: [{ id: it.w }], cur: 0, yaw: face - Math.PI };
        const v = ent.makePlayer(pl); ent.players.delete(pl.id); ent.setPlayerGun(v, pl.w[0]);
        v.c.group.position.copy(pos); v.c.group.rotation.y = face; v.label.visible = false;
        __gal.push({ t: 'mate', v, pl });
      } else {
        const c = ent.makeZombie(1000 + (it.seed || 0) * 17 + i * 7, it.type);
        c.group.position.copy(pos); c.group.rotation.y = face;
        __gal.push({ t: 'z', c, it });
      }
    });
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      for (const g of __gal) {
        if (g.t === 'mate') ent.poseTeammate(g.v, g.pl, dt, now / 1000);
        else if (g.it.type === 'dog') __rig.poseDog(g.c, dt, { speed: g.it.speed, t: now / 1000, swing: 0 });
        else {
          __rig.poseHumanoid(g.c, dt, { mode: g.it.mode, speed: g.it.speed, t: now / 1000, swing: g.it.swing || 0, atk: g.it.atk || 0, shield: !!g.it.shield, k: g.it.k || 0 });
          if (g.it.mode === 'feed' && !g.c.food) ent.addFood(g.c);
        }
        if (g.c && g.c.lantern) { ent.updateLantern(g.c, dt, now / 1000, false); G.lanternLight.intensity = g.c.lantern.flame * 1.3; G.lanternLight.position.copy(g.c.lantern.glow.getWorldPosition(new THREE.Vector3())); }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return 'ok';
  })()`);
  await sleep(1500);
  await p.eval(`document.getElementById('hud').hidden = true; 'ok'`);
  await p.shot(`${out}/gallery-${what}-front.png`);
  // from the side and from slightly behind
  for (const [name, yaw, dist] of [['side', Math.PI / 2.6, 4.6], ['back', Math.PI * .8, 4.6], ['close', .35, 1.9]]) {
    await p.eval(`(() => { const { G, THREE } = __b115; const g = __gal; const c = new THREE.Vector3(); for (const x of g) c.add((x.v ? x.v.c : x.c).group.position); c.divideScalar(g.length);
      if (window.__front === undefined) window.__front = Math.atan2(G.camera.position.x - c.x, G.camera.position.z - c.z);
      const d = ${dist}, a = __front + ${yaw};
      G.P.x = c.x + Math.sin(a) * d; G.P.z = c.z + Math.cos(a) * d; G.P.yaw = a; return 'ok'; })()`);
    await sleep(900);
    await p.shot(`${out}/gallery-${what}-${name}.png`);
  }
  // portraits: walk along the line, close to each face
  if (process.env.PORTRAITS) {
    const n = await p.eval('__gal.length');
    for (let i = 0; i < n; i++) {
      await p.eval(`(() => { const { G, THREE } = __b115; const x = __gal[${i}], o = (x.v ? x.v.c : x.c).group; const a = o.rotation.y;
        G.P.x = o.position.x + Math.sin(a) * 1.25; G.P.z = o.position.z + Math.cos(a) * 1.25; G.P.yaw = a; G.P.pitch = -.12; return 'ok'; })()`);
      await sleep(500);
      await p.shot(`${out}/gallery-${what}-p${i}.png`);
    }
  }
  // the same scene in the game's own darkness
  await p.eval(`(() => { __amb.intensity = 0; return 'ok'; })()`);
  await sleep(700);
  await p.shot(`${out}/gallery-${what}-dark.png`);
  const errs = p.logs.filter(l => /EXCEPTION|error/i.test(l) && !/AudioContext/.test(l));
  console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no errors');
} finally { b.close(); }
process.exit();
