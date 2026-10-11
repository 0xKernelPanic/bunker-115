// Frame rate and draw calls on each map, looking around a full circle with the flashlight on.
// Usage: node tools/perf.mjs   (needs the server running; PASS=... if it has a password)
import { launch, sleep } from './cdp.mjs';
const URL = process.env.URL || 'http://localhost:8115/client/';
const PASS = process.env.PASS || '';
const b = await launch({ port: 9356 });
try {
  for (const map of (process.env.MAPS || 'sanatorium,estate,bunkier').split(',')) {
    const p = await b.page(URL);
    await sleep(1000);
    if (PASS && await p.eval(`!!document.querySelector('input[name=password]')`)) {
      await p.eval(`document.querySelector('input[name=password]').value = ${JSON.stringify(PASS)}; document.querySelector('form').submit(); 'ok'`);
      await sleep(1500);
    }
    await sleep(1200);
    await p.eval(`(() => { const b = [...document.querySelectorAll('#maps button')].find(x => x.textContent.toLowerCase().includes('${map === 'bunkier' ? 'bunker' : map === 'estate' ? 'kessler' : 'wolf'}')); if (b) b.click(); __b115.startSolo(); return 1; })()`);
    await sleep(8000);
    const r = await p.eval(`new Promise(res => {
      const G = __b115.G; document.getElementById('clickPlay').style.display = 'none';
      G.P.flashOn = true; G.tr.paused = true;
      let n = 0, calls = 0, tris = 0; const t0 = performance.now(), yaw0 = G.P.yaw;
      const f = () => {
        n++; G.P.yaw = yaw0 + (performance.now() - t0) / 6000 * Math.PI * 2;
        const i = __b115.info(); calls += i.calls; tris += i.triangles;
        if (performance.now() - t0 < 6000) requestAnimationFrame(f);
        else res({ fps: +(n / 6).toFixed(1), calls: Math.round(calls / n), tris: Math.round(tris / n), geos: __b115.info().geometries, programs: __b115.info().programs });
      };
      requestAnimationFrame(f);
    })`);
    console.log(map.padEnd(11), JSON.stringify(r));
    await p.eval('location.reload(); 1').catch(() => {});
  }
} finally { b.close(); }
process.exit();
