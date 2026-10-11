// Two ways to reach the simulation with the same API:
// LocalTransport runs Sim inside the page (solo), WsTransport talks to the Node server (co-op).
import { Sim } from '../shared/sim.js';

export class LocalTransport {
  constructor(mapId, name, difficulty) {
    this.local = true;
    this.diff = difficulty;
    // tests can force tonight's conditions with window.__forceNight = ['storm', ...]
    this.sim = new Sim(mapId, { difficulty, night: globalThis.__forceNight, collapse: globalThis.__forceCollapse });
    this.me = 'solo';
    this.sim.addPlayer(this.me, name);
    this.h = {};
    this.acc = 0;
    this.paused = false;
  }
  on(t, fn) { this.h[t] = fn; }
  start() { this.sim.start(); }
  restart() { const name = this.sim.players[0].name, map = this.sim.map.id; this.sim = new Sim(map, { difficulty: this.diff, night: globalThis.__forceNight }); this.sim.addPlayer(this.me, name); this.sim.start(); }
  send(msg) { this.sim.handle(this.me, msg); }
  resume() { return this.sim.restoreCheckpoint(); }
  tick(dt) {
    if (this.paused) return;
    this.acc += Math.min(dt, .25);
    while (this.acc >= .05) {
      this.acc -= .05;
      this.sim.step(.05);
      this.h.snap && this.h.snap(this.sim.snapshot());
    }
  }
  close() {}
}

export class WsTransport {
  constructor() { this.local = false; this.h = {}; this.ws = null; this.me = null; this.open = false; }
  on(t, fn) { this.h[t] = fn; }
  url() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'; }
  connect(name) {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.url()); } catch (e) { reject(e); return; }
      this.ws = ws;
      const timer = setTimeout(() => { reject(new Error('timeout')); try { ws.close(); } catch (e) {} }, 4000);
      ws.onopen = () => {
        let token = null; try { token = sessionStorage.getItem('b115-token'); } catch (e) {}
        ws.send(JSON.stringify({ t: 'hello', name, token }));
      };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'welcome') {
          clearTimeout(timer); this.open = true; this.me = m.id; this.rejoined = !!m.rejoined;
          try { sessionStorage.setItem('b115-token', m.token); } catch (e) {}
          resolve(m);
        }
        const fn = this.h[m.t]; if (fn) fn(m);
      };
      ws.onclose = () => { clearTimeout(timer); const was = this.open; this.open = false; if (!was) reject(new Error('closed')); else this.h.close && this.h.close(); };
      ws.onerror = () => {};
    });
  }
  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  tick() {}
  close() { this.open = false; if (this.ws) { this.ws.onclose = null; this.ws.close(); } }
}

// Is a Bunker 115 server answering on this origin?
export async function serverAvailable() {
  if (location.protocol === 'file:') return false;
  try {
    const r = await fetch('/health', { cache: 'no-store' });
    if (!r.ok) return false;
    const j = await r.json();
    return !!j.ok;
  } catch (e) { return false; }
}
