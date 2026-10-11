// Minimal Chrome DevTools Protocol driver for headless browser tests (no extra dependencies).
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// a different debugging port per run, so a browser still shutting down from the last test is never reused
export async function launch({ port = 9400 + (process.pid % 2000), width = 1280, height = 720, autoplay = true } = {}) {
  const dir = fs.mkdtempSync(path.join(process.env.CHROME_TMP || os.tmpdir(), 'b115-chrome-'));
  const proc = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`, `--window-size=${width},${height}`, ...(autoplay ? ['--autoplay-policy=no-user-gesture-required'] : []), 'about:blank'], { stdio: 'ignore' });
  let ver;
  for (let i = 0; i < 50; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(200); } }
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  let id = 0; const pending = new Map(), listeners = [];
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else listeners.forEach(fn => fn(m));
  });
  const call = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  async function page(url) {
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    const logs = [];
    listeners.push(m => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
      if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    });
    await call('Runtime.enable', {}, sessionId);
    await call('Page.enable', {}, sessionId);
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    await call('Page.navigate', { url }, sessionId);
    return {
      logs,
      async eval(expr) { const r = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; },
      // poll until expr is truthy (or give up after ms)
      async waitFor(expr, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await this.eval(expr)) return true; } catch {} await sleep(200); } return false; },
      // a real mouse click, which the browser treats as a user gesture
      async click(x, y) { for (const type of ['mousePressed', 'mouseReleased']) await call('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, sessionId); },
      async front() { await call('Page.bringToFront', {}, sessionId); await call('Emulation.setFocusEmulationEnabled', { enabled: true }, sessionId); },
      async shot(file) { const r = await call('Page.captureScreenshot', { format: 'png' }, sessionId); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); }
    };
  }
  // the throwaway profile goes with the browser (each one is tens of megabytes)
  const wipe = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} };
  proc.on('exit', wipe);
  process.on('exit', () => { try { proc.kill('SIGKILL'); } catch {} wipe(); });
  return { page, close() { try { ws.close(); } catch {} proc.kill('SIGKILL'); } };
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
