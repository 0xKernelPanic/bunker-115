// One co-op game: lobby until the host starts, then a 20 Hz simulation loop broadcasting snapshots.
import { Sim, DIFFICULTY } from '../shared/sim.js';
import MAPS from '../shared/maps/index.js';

const TICK = 50;
const MAX_PLAYERS = 4;

export class Room {
  constructor(code, mapId, onEmpty, records) {
    this.records = records;
    this.code = code;
    this.mapId = MAPS[mapId] ? mapId : 'sanatorium';
    this.diff = 'normal';
    this.clients = new Map();
    this.hostId = null;
    this.sim = null;
    this.timer = null;
    this.onEmpty = onEmpty;
    this.emptySince = null;
  }
  get inGame() { return !!this.sim; }
  full() { return [...this.clients.values()].filter(c => c.connected).length >= MAX_PLAYERS; }
  send(c, msg) { if (c.ws && c.ws.readyState === 1) c.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); }
  broadcast(msg) { const s = JSON.stringify(msg); for (const c of this.clients.values()) this.send(c, s); }
  lobbyState() {
    return {
      t: 'lobby', code: this.code, map: this.mapId, diff: this.diff, host: this.hostId, inGame: this.inGame,
      players: [...this.clients.values()].map(c => ({ id: c.id, name: c.name, connected: c.connected }))
    };
  }
  join(c) {
    this.clients.set(c.id, c);
    c.room = this; c.connected = true;
    if (!this.hostId || !this.clients.get(this.hostId)?.connected) this.hostId = c.id;
    this.emptySince = null;
    if (this.sim) {
      if (!this.sim.player(c.id)) this.sim.addPlayer(c.id, c.name);
      this.send(c, { t: 'begin', map: this.mapId, you: c.id, code: this.code });
    }
    this.broadcast(this.lobbyState());
  }
  // A dropped socket keeps its seat for 60 s so the player can reconnect with the same token.
  disconnect(c) {
    c.connected = false; c.ws = null;
    c.dropTimer = setTimeout(() => this.leave(c), 60000);
    if (this.hostId === c.id) {
      const next = [...this.clients.values()].find(o => o.connected);
      this.hostId = next ? next.id : null;
    }
    this.broadcast(this.lobbyState());
    this.checkEmpty();
  }
  reconnect(c, ws) {
    clearTimeout(c.dropTimer);
    c.ws = ws; c.connected = true;
    if (!this.hostId) this.hostId = c.id;
    if (this.sim) this.send(c, { t: 'begin', map: this.mapId, you: c.id, code: this.code });
    this.broadcast(this.lobbyState());
  }
  leave(c) {
    clearTimeout(c.dropTimer);
    this.clients.delete(c.id);
    if (this.sim) this.sim.removePlayer(c.id);
    if (this.hostId === c.id) { const next = [...this.clients.values()].find(o => o.connected); this.hostId = next ? next.id : null; }
    this.broadcast(this.lobbyState());
    this.checkEmpty();
  }
  checkEmpty() {
    if ([...this.clients.values()].some(c => c.connected)) return;
    this.stop();
    if (!this.clients.size) this.onEmpty(this);
  }
  setMap(c, mapId) { if (c.id === this.hostId && !this.sim && MAPS[mapId]) { this.mapId = mapId; this.broadcast(this.lobbyState()); } }
  setDiff(c, d) { if (c.id === this.hostId && !this.sim && DIFFICULTY[d]) { this.diff = d; this.broadcast(this.lobbyState()); } }
  start(c) {
    if (c.id !== this.hostId) return;
    this.stop();
    this.sim = new Sim(this.mapId, { difficulty: this.diff });
    this.recorded = false;
    for (const cl of this.clients.values()) this.sim.addPlayer(cl.id, cl.name);
    this.sim.start();
    for (const cl of this.clients.values()) this.send(cl, { t: 'begin', map: this.mapId, you: cl.id, code: this.code });
    this.broadcast(this.lobbyState());
    let last = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
      this.sim.step(dt);
      const W = this.sim.W;
      // a finished escape goes into the hall of survivors once
      if (W.phase === 'over' && !this.recorded) {
        this.recorded = true;
        const out = this.sim.players.filter(p => p.st === 'e');
        if (W.result === 'escaped' && out.length && this.records && !W.retries) this.records.add(this.mapId, W.diff, out.map(p => p.name), W.elapsed, W.notes.length);
      }
      this.broadcast({ t: 'snap', s: this.sim.snapshot() });
    }, TICK);
  }
  stop() { clearInterval(this.timer); this.timer = null; }
  // after a wipe the host can take everyone back to the last checkpoint
  resume(c) { if (c.id === this.hostId && this.sim && this.sim.restoreCheckpoint()) this.recorded = false; }
  backToLobby(c) {
    if (c.id !== this.hostId) return;
    this.stop(); this.sim = null;
    this.broadcast({ t: 'ended' });
    this.broadcast(this.lobbyState());
  }
  input(c, msg) { if (this.sim) this.sim.handle(c.id, msg); }
}
