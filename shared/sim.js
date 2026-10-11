// Authoritative game simulation. Runs on the Node server (co-op) or inside the browser (solo).
// Input: handle(playerId, message). Output: snapshot() 20 times a second, with events drained.
//
// The night is an escape: objectives from the map drive progress, and a hidden "director"
// cycles calm -> build-up -> peak -> relax, spawning the dead in waves you never see counted.
// Zombies only know where you are if they hear or see you.
import { buildWorld, collide, activeZones, setDoorOpen, zoneAt, pointBlocked } from './world.js';
import { Nav, NAV_INF } from './nav.js';
import { WEAPONS, wdef, KNIFE_DMG, GRENADE, falloff, capacity } from './weapons.js';
import { findInteract, findRevive, findRepair, objective } from './interact.js';
import { clamp, R, pick, weightedPick, angDiff } from './util.js';
import MAPS from './maps/index.js';
import { makeAnswer, clueText, SECRETS, front } from './puzzles.js';
import { drawNight } from './night.js';

export const ZTYPES = ['walker', 'thin', 'bloater', 'crawler', 'dog', 'stalker', 'screamer', 'brute', 'weeper'];
export const ZSTATES = ['approach', 'tear', 'climb', 'rise', 'chase', 'wander', 'investigate', 'dormant', 'wake', 'ceiling', 'drop', 'stun', 'search', 'pry',
  'trip', 'feed', 'howl', 'flee', 'charge', 'daze', 'weep', 'rush'];
export const PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
export const LOST = { head: 1, armL: 2, armR: 4, legL: 8, legR: 16 };
export const ZFLAG = { swing: 1, run: 4, scream: 8, crawl: 16, alert: 32, shield: 64, stagger: 512 };
// (dropping from the ceiling, getting up and climbing out of the ground finish first: cutting them
// short would leave the body in the ceiling or under the floor)
const KEEP_ON_HIT = new Set(['chase', 'stun', 'trip', 'howl', 'flee', 'charge', 'daze', 'weep', 'rush', 'drop', 'wake', 'rise']);
// which attack: 0 swipe, 1 grab, 2 bite, 3 smash (in flag bits 7-8)
export const ATK_SHIFT = 7;
// states in which a zombie is busy and will not be pulled away by a noise
const BUSY = new Set(['chase', 'approach', 'tear', 'climb', 'rise', 'wake', 'drop', 'stun', 'pry', 'trip', 'howl', 'flee', 'charge', 'daze', 'weep', 'rush']);
const TI = Object.fromEntries(ZTYPES.map((t, i) => [t, i]));
const SI = Object.fromEntries(ZSTATES.map((t, i) => [t, i]));
const COLORS = ['#e9c46a', '#7fb3d5', '#e07a5f', '#9bd17a'];
const ZDMG = { walker: 50, thin: 45, bloater: 60, crawler: 40, dog: 35, stalker: 999, screamer: 25, brute: 80, weeper: 75 };
const r2 = v => Math.round(v * 100) / 100;
const FLASH_LIFE = 240;

// How hard the night is. Every number the director and the dead use is scaled from here.
export const DIFFICULTY = {
  easy:      { name: 'Easy', zdmg: .6, regen: .6, bat: 1.5, level: .75, spawn: .7, stalker: .85, stalkerHp: .7, hear: .8, pts: 1000 },
  normal:    { name: 'Normal', zdmg: .8, regen: .4, bat: 1, level: 1, spawn: 1, stalker: 1, stalkerHp: 1, hear: 1, pts: 500 },
  nightmare: { name: 'Nightmare', zdmg: 1.4, regen: .2, bat: .7, level: 1.3, spawn: 1.3, stalker: 1.12, stalkerHp: 1.4, hear: 1.3, pts: 500 }
};

// How tough the dead are. They harden a little as the night goes on, but never become bullet
// sponges: a walker takes about four pistol rounds at dusk and eight near dawn.
export function zombieHP(level) { return Math.round(140 + 160 * clamp(level, 0, 1.3)); }

export class Sim {
  constructor(mapId, opts = {}) {
    this.map = MAPS[mapId] || MAPS.sanatorium;
    this.diffId = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
    this.diff = DIFFICULTY[this.diffId];
    this.world = buildWorld(this.map);
    // tonight's conditions; a collapse adds rubble before the navigation grid is built
    this.night = opts.night || drawNight(this.map, this.diffId === 'nightmare' ? 3 : 2);
    this.collapse = this.night.includes('collapse') ? (opts.collapse ?? Math.floor(Math.random() * this.map.collapses.length)) : null;
    if (this.collapse !== null) { const c = this.map.collapses[this.collapse]; this.world.colliders.push({ minX: c.x0, maxX: c.x1, minZ: c.z0, maxZ: c.z1, off: false, tag: 'prop' }); }
    this.nav = new Nav(this.world);
    this.players = [];
    this.zombies = [];
    this.powerups = []; this.grenades = []; this.gas = [];
    this.events = [];
    this.nextId = 1;
    this.time = 0;
    this.W = {
      map: this.map.id, phase: 'pre', result: null, coop: false, power: false, insta: 0, dbl: 0, blackout: 0,
      doors: {}, boards: {}, traps: {}, keys: {}, fuses: 0, obj: { i: 0, t: 0 }, items: [], level: 0, round: 1, elapsed: 0, stalker: false, stalkerAt: null, puzzles: {}, clues: {},
      diff: this.diffId, hides: {}, notes: [], got: {}, night: this.night, collapse: this.collapse, thunder: 0, cp: null, retries: 0, matronDowns: 0, matronDead: false
    };
    for (const h of this.map.hides || []) this.W.hides[h.id] = null;
    for (const w of this.world.windows) this.W.boards[w.id] = 6;
    for (const t of this.map.traps || []) this.W.traps[t.id] = { a: 0, cd: 0 };
    this.D = { phase: 'calm', t: 25, drops: 0, scareT: R(25, 45) };
    this.dogQueue = [];
    this.fields = new Map(); this.fieldT = 0;
    this.pointFields = new Map();
    this.zoneSet = activeZones(this.map, this.W.doors);
  }

  ev(e) { this.events.push(e); }
  player(id) { return this.players.find(p => p.id === id); }
  zombie(id) { return this.zombies.find(z => z.id === id); }
  alivePlayers() { return this.players.filter(p => p.st === 'a'); }

  // ---------- players ----------
  addPlayer(id, name) {
    const sp = this.map.playerSpawns[this.players.length % this.map.playerSpawns.length];
    const p = {
      id, name: String(name || 'Player').slice(0, 16), color: COLORS[this.players.length % COLORS.length],
      x: sp.x, z: sp.z, y: 0, yaw: 0, pitch: 0, st: 'a', hp: 100, mhp: 100, pts: this.diff.pts, score: 0, hid: null,
      w: [this.newWeapon('m1911')], cur: 0, g: GRENADE.start, bat: 1, fl: false,
      hold: false, sprint: false, moved: 0, lastHurt: -99, lastState: 0, bleed: 0, rev: 0, revBy: null,
      repairT: .25, lastKnife: -9, ack: 0, tp: 1, gas: 0, noiseT: 0,
      kills: 0, heads: 0, downs: 0, revives: 0, boardsPts: 0, boards: 0, shots: 0, stuns: 0
    };
    if (this.W.phase === 'play' && this.W.elapsed > 60) p.st = 'x';
    this.players.push(p);
    this.W.coop = this.players.length > 1;
    this.ev({ e: 'join', p: id, name: p.name });
    return p;
  }
  removePlayer(id) {
    const i = this.players.findIndex(p => p.id === id);
    if (i < 0) return;
    const [p] = this.players.splice(i, 1);
    if (p.hid) this.W.hides[p.hid] = null;
    this.fields.delete(id);
    this.ev({ e: 'leave', p: id, name: p.name });
    this.checkOver();
  }
  newWeapon(id) { const d = wdef(id); return { id, mag: d.mag, res: d.res }; }
  addPts(p, n) {
    if (!p) return;
    if (this.W.dbl > 0) n *= 2;
    p.pts += n; p.score += n;
    this.ev({ e: 'pts', p: p.id, n });
  }
  spend(p, cost) {
    if (p.pts >= cost) { p.pts -= cost; this.ev({ e: 'buy', p: p.id }); return true; }
    this.ev({ e: 'deny', p: p.id });
    return false;
  }
  giveWeapon(p, id) {
    const own = p.w.findIndex(w => w.id === id);
    if (own >= 0) { const w = p.w[own], d = wdef(id); w.mag = d.mag; w.res = d.res; p.cur = own; }
    else if (p.w.length < 2) { p.w.push(this.newWeapon(id)); p.cur = p.w.length - 1; }
    else p.w[p.cur] = this.newWeapon(id);
    this.ev({ e: 'give', p: p.id, w: id });
  }
  hurtPlayer(p, dmg, src) {
    if (p.st !== 'a') return;
    if (typeof src === 'number') dmg *= this.diff.zdmg;
    p.hp -= dmg; p.lastHurt = this.time;
    this.ev({ e: 'hurt', p: p.id, src });
    if (p.hp <= 0) this.downPlayer(p);
  }
  downPlayer(p) {
    if (p.hid) this.unhide(p, true);
    p.hp = 0; p.downs++; p.rev = 0; p.revBy = null; p.hold = false;
    if (!this.W.coop) { p.st = 'x'; this.ev({ e: 'dead', p: p.id }); this.checkOver(); return; }
    p.st = 'd'; p.bleed = 30;
    this.ev({ e: 'down', p: p.id });
    this.checkOver();
  }
  revivePlayer(p, by) {
    p.st = 'a'; p.hp = 50; p.rev = 0; p.revBy = null; p.bleed = 0; p.lastHurt = this.time;
    if (by) { by.revives++; this.addPts(by, 100); }
    this.ev({ e: 'revive', p: p.id, by: by ? by.id : null });
  }
  respawnPlayer(p) {
    const sp = this.map.playerSpawns[this.players.indexOf(p) % this.map.playerSpawns.length];
    Object.assign(p, { st: 'a', hp: 100, mhp: 100, x: sp.x, z: sp.z, y: 0, w: [this.newWeapon('m1911')], cur: 0, g: 1, bat: Math.max(p.bat, .5), bleed: 0, rev: 0, revBy: null });
    p.tp++;
    this.ev({ e: 'respawn', p: p.id });
  }
  // ---------- checkpoints ----------
  // Taken when a marked objective begins. After a wipe the team may return to it twice a night.
  saveCheckpoint() {
    const W = this.W;
    W.cp = { obj: W.obj.i, at: Math.round(W.elapsed) };
    const clone = o => JSON.parse(JSON.stringify(o));
    this.checkpoint = {
      W: clone(Object.assign({}, W, { items: W.items })), D: clone(this.D),
      players: this.players.map(p => ({ id: p.id, x: p.x, z: p.z, w: clone(p.w), cur: p.cur, g: p.g, pts: p.pts, bat: p.bat }))
    };
    this.ev({ e: 'checkpoint' });
  }
  canResume() { return !!this.checkpoint && this.W.phase === 'over' && this.W.result === 'dead' && (this.W.retries || 0) < 2; }
  restoreCheckpoint() {
    if (!this.canResume()) return false;
    const cp = this.checkpoint, retries = (this.W.retries || 0) + 1, doorsNow = Object.assign({}, this.W.doors);
    this.W = JSON.parse(JSON.stringify(cp.W));
    const W = this.W;
    W.retries = retries; W.phase = 'play'; W.result = null; W.blackout = 0; W.thunder = 0;
    for (const id in W.hides) W.hides[id] = null;
    this.D = JSON.parse(JSON.stringify(cp.D)); this.D.phase = 'relax'; this.D.t = 20;
    this.zombies = []; this.grenades = []; this.gas = []; this.powerups = []; this.dogQueue = [];
    // what you paid for stays paid for: doors opened after the checkpoint stay open
    for (const id in doorsNow) if (doorsNow[id]) W.doors[id] = true;
    for (const id in this.world.doors) setDoorOpen(this.world, id, !!W.doors[id]);
    this.nav.rebuild(); this.fields.clear(); this.pointFields.clear(); this.fieldT = 0;
    this.zoneSet = activeZones(this.map, W.doors);
    for (const p of this.players) {
      const sv = cp.players.find(q => q.id === p.id);
      const sp = this.map.playerSpawns[this.players.indexOf(p) % this.map.playerSpawns.length];
      // back where you caught your breath, healed; you keep your points and the guns you bought,
      // and get back at least the ammunition and grenades you had then
      Object.assign(p, { st: 'a', hp: p.mhp, y: 0, hid: null, bleed: 0, rev: 0, revBy: null, gas: 0, grabT: 0, x: sv ? sv.x : sp.x, z: sv ? sv.z : sp.z });
      if (sv) {
        for (const old of sv.w) { const w = p.w.find(q => q.id === old.id); if (w) { w.mag = Math.max(w.mag, old.mag); w.res = Math.max(w.res, old.res); } else p.w.push(JSON.parse(JSON.stringify(old))); }
        p.g = Math.max(p.g, sv.g); p.bat = Math.max(p.bat, sv.bat, .4);
      }
      // never left standing somewhere the rest of the night cannot reach
      if (!this.zoneSet.has(zoneAt(this.map, p.x, p.z))) { p.x = sp.x; p.z = sp.z; }
      p.tp++;
    }
    // the bodies lie where they lay, the weepers weep again; she comes back, from far away
    this.placeLurkers();
    if (W.stalker) { W.stalker = false; this.spawnStalker(); }
    this.ev({ e: 'resumed', retries });
    return true;
  }
  checkOver() {
    if (this.W.phase !== 'play' || !this.players.length) return;
    // nobody left on their feet: the downed cannot be saved any more
    if (this.players.some(p => p.st === 'a')) return;
    this.W.phase = 'over';
    this.W.result = this.players.some(p => p.st === 'e') ? 'escaped' : 'dead';
    this.ev({ e: 'over', result: this.W.result, time: Math.round(this.W.elapsed) });
  }

  // ---------- objectives ----------
  openDoor(id) {
    if (this.W.doors[id]) return;
    this.W.doors[id] = true; setDoorOpen(this.world, id, true);
    this.nav.rebuild(); this.fields.clear(); this.pointFields.clear(); this.fieldT = 0;
    this.zoneSet = activeZones(this.map, this.W.doors);
  }
  advance() {
    const W = this.W, o = objective(this.map, W);
    if (o && o.open) for (const id of o.open) { this.openDoor(id); this.ev({ e: 'door', id, p: null }); }
    W.obj.i++;
    const n = objective(this.map, W);
    if (n && n.time) W.obj.t = n.time;
    if (n && n.checkpoint) this.saveCheckpoint();
    if (n && n.id === 'exit' && this.world.doors.gate) { this.openDoor('gate'); this.ev({ e: 'door', id: 'gate', p: null }); }
    this.ev({ e: 'objective', i: W.obj.i });
    // the fuse step finishes itself once all three are carried
    if (n && n.id === 'fuses' && W.fuses >= 3) this.advance();
    if (n && n.id === 'collect' && (W.got[n.item] || 0) >= n.n) this.advance();
    const st = this.map.stalker;
    if (st && st.mortal === W.obj.i) this.ev({ e: 'mortal' });
    // the last task: she must be found and put down; if she already is, go straight on
    if (n && n.id === 'kill') {
      if (W.matronDead) this.advance();
      else if (!W.stalker) this.spawnStalker();
      else for (const z of this.zombies) if (z.type === 'stalker' && z.state !== 'stun') { const t = pick(this.alivePlayers()); if (t) { z.state = 'investigate'; z.tx = t.x; z.tz = t.z; z.t = 0; } }
    }
  }
  // a 'collect' objective finishes as soon as the team carries enough
  checkCollect() {
    const o = objective(this.map, this.W);
    if (o && o.id === 'collect' && (this.W.got[o.item] || 0) >= o.n) this.advance();
  }
  checkFuses() { const o = objective(this.map, this.W); if (o && o.id === 'fuses' && this.W.fuses >= 3) this.advance(); }

  // ---------- hiding ----------
  hideSpot(id) { return (this.map.hides || []).find(h => h.id === id); }
  hide(p, id) {
    const h = this.hideSpot(id);
    if (!h || this.W.hides[id] || p.hid) return;
    // only what actually watches you climb in (or is right on top of you) knows where you went;
    // everything else loses you and searches where it last saw you
    let seen = 0;
    for (const z of this.zombies) if ((z.state === 'chase' || z.state === 'investigate' || z.state === 'search') && (this.canSee(z, p, true) || Math.hypot(z.x - p.x, z.z - p.z) < 2)) { z.knows = id; seen++; }
    this.W.hides[id] = p.id; p.hid = id;
    p.x = h.x; p.z = h.z; p.fl = false;
    p.tp++;
    this.ev({ e: 'hide', p: p.id, hide: id, seen });
  }
  unhide(p, forced) {
    const h = this.hideSpot(p.hid);
    if (!h) { p.hid = null; return; }
    this.W.hides[p.hid] = null;
    p.x = h.x + h.nx * .75; p.z = h.z + h.nz * .75;
    this.ev({ e: 'unhide', p: p.id, hide: p.hid, forced: !!forced });
    p.hid = null; p.tp++;
    for (const z of this.zombies) if (z.knows === h.id) z.knows = null;
  }
  // lockers within reach of a point, nearest first
  hidesNear(x, z, r) {
    return (this.map.hides || []).map(h => ({ h, d: Math.hypot(h.x - x, h.z - z) })).filter(e => e.d < r && this.zoneSet.has(zoneAt(this.map, e.h.x + e.h.nx, e.h.z + e.h.nz))).sort((a, b) => a.d - b.d).map(e => e.h);
  }

  // ---------- input ----------
  handle(pid, m) {
    const p = this.player(pid);
    if (!p || !m || typeof m !== 'object') return;
    if (typeof m.s === 'number') p.ack = m.s;
    if (this.W.phase !== 'play') return;
    switch (m.t) {
      case 'state': this.onState(p, m); break;
      case 'switch': if (p.w[m.slot]) p.cur = m.slot; break;
      case 'shot': this.onShot(p, m); break;
      case 'reloaded': {
        const w = p.w[m.slot]; if (!w) break;
        const d = wdef(w.id);
        // shells go in one at a time; magazines can't be swapped faster than the hands allow
        if (this.time - (w.lastReload ?? -9) < (d.shell ? d.shell * .6 : d.reload * .5)) break;
        w.lastReload = this.time;
        const take = Math.min(d.shell ? 1 : capacity(d, w.mag) - w.mag, d.mag - w.mag + (d.chamber && w.mag > 0 ? 1 : 0), w.res);
        if (take > 0) { w.mag += take; w.res -= take; }
        break;
      }
      case 'knife': this.onKnife(p); break;
      case 'use': this.onUse(p); break;
      case 'code': this.tryCode(p, String(m.id || ''), String(m.code || '')); break;
      case 'grenade': {
        if (p.st !== 'a' || p.g <= 0 || p.hid) break;
        p.g--;
        const n = v => clamp(+v || 0, -30, 30);
        this.grenades.push({ id: this.nextId++, x: p.x, y: clamp(+m.y || 1.4, 0, 2.5), z: p.z, vx: n(m.vx), vy: n(m.vy), vz: n(m.vz), t: GRENADE.fuse, owner: p.id });
        this.ev({ e: 'throw', p: p.id });
        break;
      }
    }
  }
  onState(p, m) {
    p.yaw = +m.yaw || 0; p.pitch = clamp(+m.pitch || 0, -1.6, 1.6);
    p.hold = !!m.f; p.sprint = !!m.sp; p.ads = !!m.ads; p.rl = !!m.rl;
    p.fl = !!m.fl && p.bat > 0 && !p.hid;
    if (p.st === 'x' || p.st === 'e' || p.hid) { p.moved = 0; return; }
    // the server moved this player (locker, respawn, checkpoint): positions sent before the client
    // heard about it are stale and must not drag the player back through a wall
    if (m.tp !== undefined && +m.tp !== p.tp) { p.moved = 0; return; }
    const dt = Math.max(.02, this.time - p.lastState); p.lastState = this.time;
    let nx = +m.x, nz = +m.z;
    if (!isFinite(nx) || !isFinite(nz)) return;
    const maxd = (p.st === 'd' ? 1.5 : 8.5) * dt + .6, dx = nx - p.x, dz = nz - p.z, d = Math.hypot(dx, dz);
    if (d > maxd) { nx = p.x + dx / d * maxd; nz = p.z + dz / d * maxd; }
    const q = { x: nx, z: nz };
    collide(q, .3, this.world.colliders);
    p.moved = Math.hypot(q.x - p.x, q.z - p.z) / dt;
    p.x = q.x; p.z = q.z;
    p.y = clamp(+m.y || 0, 0, 1.6);
  }
  onShot(p, m) {
    if (p.st === 'x' || p.st === 'e' || p.hid) return;
    const w = p.w[m.slot]; if (!w) return;
    const d = wdef(w.id);
    if (this.time - (w.lastShot ?? -9) < d.rate * .6 || w.mag <= 0) return;
    w.lastShot = this.time; w.mag--; p.shots++;
    const end = Array.isArray(m.end) ? m.end.map(v => +v || 0) : null;
    this.ev({ e: 'shot', p: p.id, w: w.id, end: end && end.map(r2) });
    this.noise(p.x, p.z, d.noise, p);
    // hits: [zombie, part, pellets, how many bodies the round had already gone through]
    const hits = Array.isArray(m.hits) ? m.hits.slice(0, (d.pellets || 1) * (1 + (d.pierce || 0))) : [];
    for (const h of hits) {
      if (!Array.isArray(h)) continue;
      const z = this.zombie(h[0]); if (!z) continue;
      const part = PARTS[h[1]] || 'torso';
      const n = clamp(h[2] | 0 || 1, 1, d.pellets || 1), through = clamp(h[3] | 0, 0, 9);
      if (through > (d.pierce || 0)) continue;
      const dist = Math.hypot(z.x - p.x, z.z - p.z);
      if (dist > 90) continue;
      const dmg = d.dmg * n * (part === 'head' ? d.head : 1) * falloff(d, dist) * Math.pow(.6, through);
      if (dmg > 0) this.damageZombie(z, dmg, part, p, d.cls, { x: z.x - p.x, z: z.z - p.z });
    }
  }
  // V: a shove and a slash in one. It knocks the nearest thing in front of you back and breaks off
  // its attack; something that has not noticed you, taken from behind, dies quietly; it also tears
  // you free of a grab.
  onKnife(p) {
    if (p.st !== 'a' || p.hid || this.time - p.lastKnife < .6) return;
    p.lastKnife = this.time;
    this.ev({ e: 'knife', p: p.id });
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), grabbed = p.grabT > 0;
    let best = null, bd = 1.9;
    for (const z of this.zombies) {
      if (z.state === 'ceiling' || z.state === 'approach' || z.state === 'tear' || z.state === 'climb') continue;
      const dx = z.x - p.x, dz = z.z - p.z, d = Math.hypot(dx, dz);
      if (d < bd && ((dx * fx + dz * fz) / Math.max(d, .01) > .35 || (grabbed && d < 1.6))) { bd = d; best = z; }
    }
    if (grabbed) { p.grabT = 0; this.ev({ e: 'breakfree', p: p.id }); }
    if (!best) { this.noise(p.x, p.z, 3, p); return; }
    const z = best, dx = z.x - p.x, dz = z.z - p.z;
    // unaware and facing away: a quiet kill
    const unaware = ['wander', 'investigate', 'search', 'dormant', 'feed', 'weep'].includes(z.state);
    const back = (Math.sin(z.rot) * dx + Math.cos(z.rot) * dz) / Math.max(Math.hypot(dx, dz), .01) > .2;
    if (unaware && (back || z.state === 'dormant' || z.state === 'feed') && !['stalker', 'brute', 'dog'].includes(z.type)) {
      this.noise(p.x, p.z, 2, p);
      this.ev({ e: 'backstab', p: p.id, z: z.id });
      this.damageZombie(z, 1e6, 'torso', p, 'knife');
      return;
    }
    this.noise(p.x, p.z, 5, p);
    const push = z.type === 'brute' || z.type === 'stalker' ? .35 : 1.0;
    this.stagger(z, z.type === 'stalker' ? .4 : .8, { x: dx, z: dz }, push);
    this.ev({ e: 'shove', p: p.id, z: z.id });
    this.damageZombie(z, 60, 'torso', p, 'knife');
  }
  onUse(p) {
    if (p.st !== 'a') return;
    const it = findInteract(this.world, this.W, p);
    if (!it) return;
    const W = this.W;
    switch (it.kind) {
      case 'door':
        if (it.cost && !this.spend(p, it.cost)) return;
        this.openDoor(it.id);
        this.ev({ e: 'door', id: it.id, p: p.id });
        this.noise(p.x, p.z, 10, p);
        break;
      case 'wall': {
        const wb = this.map.wallBuys[it.id];
        if (!this.spend(p, it.cost)) return;
        const own = p.w.find(w => w.id === wb.w);
        if (own) { const d = wdef(own.id); own.res = d.res; own.mag = d.mag; this.ev({ e: 'give', p: p.id, w: own.id }); }
        else this.giveWeapon(p, wb.w);
        break;
      }
      case 'item': this.pickUp(p, it.id); break;
      case 'switch': this.useSwitch(p, it.id, it.i); break;
      case 'hide': this.hide(p, it.id); break;
      case 'unhide': this.unhide(p); break;
      case 'fusebox':
        if (W.fuses < 3) return;
        W.power = true;
        this.ev({ e: 'power', p: p.id });
        this.noise(this.map.fusebox.x, this.map.fusebox.z, 30, p);
        if (objective(this.map, W)?.id === 'fusebox') this.advance();
        break;
      case 'useSpot': {
        const o = objective(this.map, W);
        this.ev({ e: 'useSpot', p: p.id, spot: o.spot });
        this.noise(p.x, p.z, o.noise || 25, p);
        this.advance();
        if (objective(this.map, W)?.id === 'hold') { this.D.phase = 'peak'; this.D.t = 25; this.ev({ e: 'peak' }); }
        break;
      }
      case 'radio':
        this.ev({ e: 'radio', p: p.id });
        this.noise(p.x, p.z, 18, p);
        this.advance();
        this.D.phase = 'peak'; this.D.t = 25; this.ev({ e: 'peak' });
        break;
      case 'trap':
        if (!this.spend(p, it.cost)) return;
        W.traps[it.id].a = 20;
        this.ev({ e: 'trap', id: it.id, on: true });
        break;
    }
  }
  puzzle(id) { return (this.map.puzzles || []).find(q => q.id === id); }
  // a combination entered at a safe or locker you are standing at
  tryCode(p, id, code) {
    if (p.st !== 'a') return;
    const it = findInteract(this.world, this.W, p);
    if (!it || it.kind !== 'code' || it.id !== id) return;
    const pz = this.puzzle(id), st = this.W.puzzles[id];
    if (st.open || st.cd > 0 || !/^\d{4}$/.test(code)) return;
    if (code === this.answers[id]) return this.openStash(pz, p);
    st.cd = 3;
    this.ev({ e: 'codeWrong', id, p: p.id });
    this.noise(pz.stash.x, pz.stash.z, 12, p);   // the handle rattles
  }
  useSwitch(p, id, i) {
    const pz = this.puzzle(id), st = this.W.puzzles[id], order = this.answers[id];
    if (!pz || st.open) return;
    st.seq.push(i);
    const k = st.seq.length - 1;
    if (order[k] !== i) {
      st.seq = [];
      this.ev({ e: 'switchWrong', id, i, p: p.id });
      this.noise(pz.switches[i].x, pz.switches[i].z, 16, p);   // steam bursts / books thud to the floor
      return;
    }
    this.ev({ e: 'switch', id, i, n: st.seq.length, p: p.id });
    if (st.seq.length === order.length) this.openStash(pz, p);
  }
  openStash(pz, p) {
    const st = this.W.puzzles[pz.id];
    st.open = true; st.seq = [];
    this.ev({ e: 'unlock', id: pz.id, p: p ? p.id : null });
    this.noise(pz.stash.x, pz.stash.z, 8, p);
    // what was inside, laid out on the floor in front of it
    const f = front(pz.stash, .85), lx = -pz.stash.nz, lz = pz.stash.nx;
    const loot = pz.reward.concat(pz.secret ? [{ kind: 'secret', secret: pz.secret, title: SECRETS[pz.secret].title }] : []);
    loot.forEach((r, k) => {
      const o = (k - (loot.length - 1) / 2) * .45;
      this.W.items.push(Object.assign({ id: 'i' + this.itemSeq++, y: .05, x: f.x + lx * o, z: f.z + lz * o }, r));
    });
  }
  pickUp(p, id) {
    const W = this.W, i = W.items.findIndex(t => t.id === id);
    if (i < 0) return;
    const it = W.items[i];
    switch (it.kind) {
      case 'fuse': W.fuses++; break;
      case 'key': W.keys[it.key] = true; break;
      case 'battery': p.bat = Math.min(1, p.bat + .6); break;
      case 'medkit': if (p.hp >= p.mhp) return; p.hp = p.mhp; break;
      case 'ammo': for (const w of p.w) { const d = wdef(w.id); w.res = Math.min(d.res, w.res + Math.ceil(d.res * .5)); } break;
      case 'grenade': p.g = Math.min(GRENADE.max, p.g + 1); break;
      case 'weapon': this.giveWeapon(p, it.w); break;
      case 'note': if (!W.notes.includes(it.note)) W.notes.push(it.note); break;
      case 'clue': { const pz = this.puzzle(it.clue); W.clues[it.clue] = clueText(pz, this.answers[it.clue]); break; }
      case 'secret': W.clues[it.secret] = SECRETS[it.secret]; break;
      default: W.got[it.kind] = (W.got[it.kind] || 0) + 1;
    }
    W.items.splice(i, 1);
    this.ev({ e: 'pickup', p: p.id, kind: it.kind, w: it.w, key: it.key, note: it.note, clue: it.clue || it.secret });
    if (it.kind === 'fuse') this.checkFuses();
    this.checkCollect();
  }

  // ---------- perception ----------
  // Something made a sound at (x, z) audible up to r metres; walls muffle it.
  noise(x, z, r, src) {
    if (this.W.thunder > 0) r *= .5;   // the thunder drowns it out
    for (const zb of this.zombies) {
      if (BUSY.has(zb.state)) continue;
      let rr = r * this.diff.hear * (zb.type === 'stalker' ? 1.5 : 1) * (zb.state === 'dormant' || zb.state === 'ceiling' ? .45 : 1);
      const d = Math.hypot(zb.x - x, zb.z - z);
      if (d > rr) continue;
      if (!this.nav.clearLine(zb.x, zb.z, x, z)) { rr *= .55; if (d > rr) continue; }
      this.alert(zb, x, z);
    }
    void src;
  }
  alert(z, x, zz) {
    if (z.state === 'dormant' || z.state === 'feed') return this.wake(z);
    if (z.state === 'ceiling') return this.drop(z);
    z.state = 'investigate'; z.tx = x + R(-1, 1); z.tz = zz + R(-1, 1); z.t = 0;
  }
  wake(z) { z.state = 'wake'; z.t = 1.5; this.ev({ e: 'wake', z: z.id }); }
  drop(z) { z.state = 'drop'; z.t = .5; z.y0 = z.y; this.ev({ e: 'scream', z: z.id }); }
  canSee(z, p, ignoreHide) {
    if (p.hid && !ignoreHide) return false;
    const range = (z.type === 'dog' ? 40 : p.fl ? 14 : 6) * (z.type === 'stalker' ? 1.3 : 1);
    const dx = p.x - z.x, dz = p.z - z.z, d = Math.hypot(dx, dz);
    if (d > range) return false;
    if (d > 2.2 && (dx * Math.sin(z.rot) + dz * Math.cos(z.rot)) / d < .1) return false;
    return this.nav.clearLine(z.x, z.z, p.x, p.z);
  }
  pointField(x, z) {
    const c = this.nav.freeCell(x, z);
    if (c < 0) return null;
    let e = this.pointFields.get(c);
    if (!e) {
      e = this.nav.field(x, z);
      this.pointFields.set(c, e);
      if (this.pointFields.size > 24) this.pointFields.delete(this.pointFields.keys().next().value);
    }
    return e;
  }
  fieldFor(p) {
    let f = this.fields.get(p.id);
    if (!f) { f = this.nav.field(p.x, p.z); this.fields.set(p.id, f); }
    return f;
  }
  randomPoint(x, z, r) {
    for (let k = 0; k < 30; k++) {
      const a = R(0, Math.PI * 2), d = R(2, r), cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
      if (this.nav.free(this.nav.cell(cx, cz)) && this.zoneSet.has(zoneAt(this.map, cx, cz))) return { x: cx, z: cz };
    }
    return null;
  }

  // ---------- zombies ----------
  damageZombie(z, dmg, part, p, cls, dir) {
    if (z.dead) return;
    // a heavy hit rocks it back and breaks off its swing
    const heavy = z.type === 'brute' ? .5 : .35;
    if (dmg >= z.maxHp * heavy && z.state !== 'dormant' && z.state !== 'ceiling') this.stagger(z, z.type === 'stalker' ? .35 : .55, dir, .35);
    if ((part === 'legL' || part === 'legR') && z.type !== 'dog') z.limpT = 3;
    if (z.state === 'dormant' || z.state === 'feed') this.wake(z);
    if (z.state === 'ceiling') this.drop(z);
    if (z.state === 'weep' && p) this.weeperRage(z, p);
    if (this.W.insta > 0 && z.type !== 'stalker') dmg = 1e9;
    // once she can die, a fallen Matron cannot be beaten while she is down
    if (z.type === 'stalker' && z.state === 'stun' && this.matronMortal()) return;
    z.hp -= dmg;
    z.hitT = .25;
    // being shot makes it come for you, unless it is in the middle of something of its own
    if (p && p.st === 'a' && !KEEP_ON_HIT.has(z.state)) { z.state = 'chase'; z.tgt = p.id; z.seenT = this.time; z.bestD = NAV_INF; }
    else if (p && p.st === 'a' && (z.state === 'drop' || z.state === 'wake')) z.tgt = p.id;
    if (z.type === 'stalker') {
      if (p) this.addPts(p, 10);
      if (z.hp <= 0) {
        if (this.matronMortal()) {
          // without the serum she is dying: each fall costs her, and the third is the last
          const W = this.W; W.matronDowns = (W.matronDowns || 0) + 1;
          if (p) p.stuns++;
          if (W.matronDowns >= 3) { this.killMatron(z, p); return; }
          z.hp = z.maxHp * (1 - .2 * W.matronDowns); z.state = 'stun'; z.t = 5;
          this.ev({ e: 'stun', z: z.id, by: p ? p.id : null, downs: W.matronDowns });
        } else { z.hp = z.maxHp; z.state = 'stun'; z.t = 8; if (p) p.stuns++; this.ev({ e: 'stun', z: z.id, by: p ? p.id : null }); }
      }
      return;
    }
    if (z.type !== 'dog' && z.hp > 0) {
      if (part === 'legL' || part === 'legR') {
        z.legDmg += dmg;
        if (!(z.lost & LOST[part]) && z.legDmg > z.maxHp * .35 && Math.random() < .75) this.gib(z, part);
      } else if (part === 'armL' || part === 'armR') {
        z.armDmg += dmg;
        if (!(z.lost & LOST[part]) && z.armDmg > z.maxHp * .3 && Math.random() < .6) this.gib(z, part);
      } else if (cls === 'explosive' && Math.random() < .35) this.gib(z, pick(['legL', 'legR', 'armL', 'armR']));
    }
    if (z.hp <= 0) this.killZombie(z, p, part === 'head', cls);
    else if (p) this.addPts(p, 10);
  }
  // knocked off balance: no moving, no attacking, pushed back along dir
  stagger(z, t, dir, push) {
    z.stagger = Math.max(z.stagger || 0, t); z.pending = null; z.swing = 0;
    if (dir && push) { const l = Math.hypot(dir.x, dir.z) || 1; z.x += dir.x / l * push; z.z += dir.z / l * push; collide(z, .28, this.world.colliders); }
  }
  gib(z, part) {
    if (z.lost & LOST[part]) return;
    z.lost |= LOST[part];
    if ((part === 'legL' || part === 'legR') && !z.crawl) { z.crawl = true; z.speed = Math.min(z.speed, .9); }
    this.ev({ e: 'gib', z: z.id, part });
  }
  // on the last night, once the serum is drained, the Matron can die
  matronMortal() { const st = this.map.stalker; return !!st && st.mortal !== undefined && this.W.obj.i >= st.mortal; }
  killMatron(z, p) {
    const W = this.W;
    z.dead = true;
    const i = this.zombies.indexOf(z); if (i >= 0) this.zombies.splice(i, 1);
    W.stalker = false; W.matronDead = true;
    if (p) { this.addPts(p, 1000); p.kills++; }
    this.ev({ e: 'kill', z: z.id, by: p ? p.id : null, head: false, cls: 'matron', type: z.type, x: r2(z.x), zz: r2(z.z), y: r2(z.y), rot: r2(z.rot), lost: z.lost });
    this.ev({ e: 'matronDies', by: p ? p.id : null, x: r2(z.x), zz: r2(z.z) });
    this.noise(z.x, z.z, 20);
    if (objective(this.map, W)?.id === 'kill') this.advance();
  }
  killZombie(z, p, head, cls) {
    if (z.type === 'stalker') { z.state = 'stun'; z.t = 8; this.ev({ e: 'stun', z: z.id }); return; }
    z.dead = true;
    const i = this.zombies.indexOf(z); if (i >= 0) this.zombies.splice(i, 1);
    if (p && cls !== 'nuke' && cls !== 'trap') {
      const pts = cls === 'knife' ? 130 : cls === 'explosive' ? 50 : head ? 100 : 60;
      this.addPts(p, pts); p.kills++; if (head) p.heads++;
    }
    if (head && cls !== 'explosive' && cls !== 'nuke') z.lost |= LOST.head;
    this.ev({ e: 'kill', z: z.id, by: p ? p.id : null, head, cls, type: z.type, x: r2(z.x), zz: r2(z.z), y: r2(z.y), rot: r2(z.rot), lost: z.lost });
    if (z.type === 'bloater') {
      this.gas.push({ x: z.x, z: z.z, t: 7 });
      this.ev({ e: 'explode', x: r2(z.x), y: 1, z: r2(z.z), r: 2.6, kind: 'gas' });
      this.noise(z.x, z.z, 15);
      for (const pl of this.players) if (pl.st === 'a' && Math.hypot(pl.x - z.x, pl.z - z.z) < 2.6) this.hurtPlayer(pl, 30, z.id);
    }
    if (this.D.drops < 3 && Math.random() < .025 && this.zoneSet.has(zoneAt(this.map, z.x, z.z))) { this.D.drops++; this.dropPowerup(z.x, z.z); }
  }
  baseZombie(type, x, z, state) {
    const round = this.W.round;
    const hpMul = { walker: 1, thin: .7, bloater: 2.2, crawler: .8, dog: .5, stalker: 1, screamer: .6, brute: 3.4, weeper: 1.3 }[type];
    const run = type === 'walker' && Math.random() < clamp((round - 2) * .12, 0, .7);
    const speed = type === 'thin' ? R(3.9, 4.5) : type === 'bloater' ? R(.8, 1.0) : type === 'crawler' ? R(.8, 1.0)
      : type === 'screamer' ? R(3.3, 3.8) : type === 'brute' ? R(1.05, 1.25) : type === 'weeper' ? 6.2
      : type === 'dog' ? R(5.0, 5.6) : type === 'stalker' ? 2.7 * this.diff.stalker : run ? R(3.0, 3.6) : R(.95, 1.4) + Math.min(round, 6) * .04;
    const hp = type === 'stalker' ? 650 * this.diff.stalkerHp : zombieHP(this.W.level) * hpMul;
    return {
      id: this.nextId++, type, x, z, y: 0, rot: R(-3.1, 3.1), hp, maxHp: hp, speed, run, state, win: null, t: 0,
      attackCd: 0, swing: 0, pending: null, legDmg: 0, armDmg: 0, lost: 0, crawl: type === 'crawler', burst: R(0, 1), screamed: false, scream: 0,
      hitT: 0, bestD: NAV_INF, stuckT: 0, life: 0, tgt: null, tx: x, tz: z, seenT: -99, lookT: 0, wait: 0, knows: null, searchList: null,
      atkV: 0, flinchT: 0, flinchCd: 0, sCount: 0, howlCd: 0, chargeCd: R(1, 3), detour: null, detourT: 0, slowT: 0
    };
  }
  spawnZombie() {
    const round = this.W.round;
    const far = (x, z) => {
      let m = 1e9; for (const p of this.players) if (p.st === 'a' || p.st === 'd') m = Math.min(m, Math.hypot(p.x - x, p.z - z));
      return m;
    };
    const cands = [];
    for (const w of this.world.windows) if (this.zoneSet.has(w.zone)) { const d = far(w.inX, w.inZ); cands.push({ win: w, w: Math.max(.1, 1 - d / 40) }); }
    for (const g of this.map.groundSpawns || []) if (this.zoneSet.has(zoneAt(this.map, g.x, g.z))) { const d = far(g.x, g.z); if (d > 7) cands.push({ ground: g, w: Math.max(.1, 1 - d / 40) * 1.2 }); }
    if (!cands.length) return;
    const c = weightedPick(cands);
    const roll = Math.random();
    let type = 'walker';
    const brutes = this.zombies.filter(z => z.type === 'brute').length, maxBrutes = this.diff.level > 1.1 ? 2 : 1;
    if (round >= 3 && roll < .05) type = 'crawler';
    else if (round >= 5 && roll < .12) type = 'bloater';
    else if (round >= 3 && roll < .24) type = 'thin';
    else if (round >= 3 && roll < .3 && !this.zombies.some(z => z.type === 'screamer')) type = 'screamer';
    else if (round >= 5 && roll < .35 && brutes < maxBrutes) type = 'brute';
    const z = this.baseZombie(type, 0, 0, 'approach');
    if (c.win) {
      const w = c.win, lx = -w.nz, lz = w.nx, dd = R(w.spawnMin, w.spawnMax), lt = R(-w.lat, w.lat);
      z.x = w.outX + w.nx * dd + lx * lt; z.z = w.outZ + w.nz * dd + lz * lt;
      z.win = w; z.rot = Math.atan2(-w.nx, -w.nz);
    } else {
      z.x = c.ground.x + R(-.6, .6); z.z = c.ground.z + R(-.6, .6);
      z.state = 'rise'; z.t = 1.8; z.y = -1.7;
      this.ev({ e: 'rise', x: r2(z.x), z: r2(z.z) });
    }
    this.zombies.push(z);
  }
  spawnDog() {
    const targets = this.alivePlayers(); if (!targets.length) return;
    const t = pick(targets), f = this.fieldFor(t);
    let x = null, zz = null;
    for (let k = 0; k < 80; k++) {
      const a = R(0, Math.PI * 2), d = R(9, 18), cx = t.x + Math.cos(a) * d, cz = t.z + Math.sin(a) * d;
      const c = this.nav.cell(cx, cz);
      if (!this.nav.free(c) || !this.zoneSet.has(zoneAt(this.map, cx, cz)) || f[c] >= NAV_INF) continue;
      x = cx; zz = cz; break;
    }
    if (x === null) return;
    const z = this.baseZombie('dog', x, zz, 'rise'); z.t = 1; z.tgt = t.id;
    this.zombies.push(z);
    this.ev({ e: 'lightning', x: r2(x), z: r2(zz) });
  }
  // The Matron arrives somewhere out of sight, well away from everyone (18 m of walking or more),
  // and has to find them.
  spawnStalker() {
    if (this.W.stalker || this.W.matronDead || !this.map.stalker) return;
    this.W.stalker = true;
    const s = this.map.stalker, alive = this.alivePlayers();
    const cands = (s.spawns || []).concat([{ x: s.x, z: s.z }])
      .filter(c => this.zoneSet.has(zoneAt(this.map, c.x, c.z)) && this.nav.freeCell(c.x, c.z) >= 0);
    const good = []; let best = null, bestD = -1;
    for (const c of cands) {
      let m = 1e9, seen = false;
      for (const p of alive) {
        m = Math.min(m, this.nav.distAt(this.fieldFor(p), c.x, c.z) / 4);   // field units are quarter metres
        if (Math.hypot(p.x - c.x, p.z - c.z) < 25 && this.nav.clearLine(p.x, p.z, c.x, c.z)) seen = true;
      }
      if (m >= 18 && !seen) good.push(c);
      if (m > bestD) { bestD = m; best = c; }
    }
    const at = good.length ? pick(good) : best || s;
    const z = this.baseZombie('stalker', at.x, at.z, 'wander');
    z.spawnX = at.x; z.spawnZ = at.z;
    this.zombies.push(z);
    this.ev({ e: 'stalker', z: z.id, x: r2(at.x), zz: r2(at.z) });
  }
  placeLurkers() {
    const restless = this.night.includes('restless');
    for (const l of (this.map.lurkers || []).concat(restless ? this.map.extraLurkers || [] : [])) {
      const thin = Math.random() < .25;
      // some are not lying still: they kneel over a body, feeding, and stand when they notice you
      const z = this.baseZombie(thin ? 'thin' : 'walker', l.x, l.z, !thin && Math.random() < (restless ? .55 : .35) ? 'feed' : 'dormant');
      this.zombies.push(z);
    }
    // weepers sit in different corners every night, and there are more of them some nights
    const wpool = (this.map.weepers || []).concat(this.map.weeperPool || []).sort(() => Math.random() - .5);
    const nW = Math.min(wpool.length, (this.map.weepers || []).length + (this.night.includes('mourners') ? 1 + Math.floor(Math.random() * 2) : 0));
    for (const w of wpool.slice(0, nW)) {
      const z = this.baseZombie('weeper', w.x, w.z, 'weep'); z.rot = w.rot || 0;
      this.zombies.push(z);
    }
    for (const c of this.map.ceilings || []) {
      const zn = this.map.zones.find(q => q.id === zoneAt(this.map, c.x, c.z));
      const z = this.baseZombie('thin', c.x, c.z, 'ceiling'); z.y = (zn && zn.ceil ? zn.ceil : 3.2) - .3;
      this.zombies.push(z);
    }
  }
  // the weeper turns on whoever disturbed her: a shriek, then she comes, fast
  weeperRage(z, p) {
    if (z.state !== 'weep') return;
    z.state = 'rush'; z.tgt = p.id; z.t = 0; z.seenT = this.time;
    this.ev({ e: 'shriek', z: z.id, p: p.id });
  }
  updateZombies(dt) {
    const tearTime = clamp(1.6 - this.W.round * .06, .6, 1.6);
    const alive = this.alivePlayers().filter(p => !p.hid);
    const nearest = (z, list = alive) => { let b = null, bd = 1e9; for (const p of list) { const d = Math.hypot(p.x - z.x, p.z - z.z); if (d < bd) { bd = d; b = p; } } return b; };
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      z.life += dt;
      z.attackCd -= dt; z.swing = Math.max(0, z.swing - dt); z.hitT -= dt; z.scream = Math.max(0, z.scream - dt);
      z.flinchT -= dt; z.flinchCd -= dt; z.howlCd -= dt; z.chargeCd -= dt; z.limpT = (z.limpT || 0) - dt;
      if (z.stagger > 0) { z.stagger -= dt; if (['chase', 'investigate', 'wander', 'search', 'rush', 'flee', 'pry', 'howl', 'daze', 'trip'].includes(z.state)) continue; }
      // anything walking about belongs on the floor
      if (z.y !== 0 && z.state !== 'climb' && z.state !== 'drop' && z.state !== 'rise' && z.state !== 'ceiling') z.y = Math.abs(z.y) < .05 ? 0 : z.y - Math.sign(z.y) * Math.min(Math.abs(z.y), dt * 6);
      if (z.pending) {
        z.pending.t -= dt;
        if (z.pending.t <= 0) {
          const p = this.player(z.pending.p);
          if (p && p.st === 'a' && !p.hid && Math.hypot(p.x - z.x, p.z - z.z) < z.pending.r + .3) {
            this.hurtPlayer(p, ZDMG[z.type], z.id);
            // a grab holds you back for a moment
            if (z.atkV === 1 && p.st === 'a') { p.grabT = .8; this.ev({ e: 'grab', p: p.id, z: z.id }); }
          }
          if (z.type === 'weeper') z.vanish = true;   // she strikes once and is gone
          z.pending = null;
        }
      }
      const tryAttack = (p, reach) => {
        if (!p || z.attackCd > 0 || p.y > 1 || z.hitT > .1 || p.st !== 'a' || p.hid) return;
        if (Math.hypot(p.x - z.x, p.z - z.z) < reach) {
          const rr = Math.random();
          z.atkV = z.type === 'brute' ? 3 : z.type === 'walker' ? (rr < .3 ? 1 : rr < .55 ? 2 : 0) : ['thin', 'crawler', 'weeper'].includes(z.type) ? (rr < .45 ? 2 : 0) : 0;
          z.attackCd = z.type === 'dog' ? .9 : z.type === 'stalker' ? 1.6 : z.type === 'brute' ? 2 : 1.2; z.swing = .45;
          // a visible wind-up before the blow lands: step back or shove it away in time
          z.pending = { p: p.id, t: z.type === 'dog' ? .2 : z.type === 'stalker' ? .45 : z.type === 'brute' ? .5 : z.type === 'thin' ? .28 : .38, r: reach };
          this.ev({ e: 'zatk', z: z.id });
        }
      };
      // sight check four times a second
      z.lookT -= dt;
      if (z.lookT <= 0 && (z.state === 'wander' || z.state === 'investigate' || z.state === 'search' || z.state === 'dormant' || z.state === 'ceiling' || z.state === 'chase' || z.state === 'feed' || z.state === 'weep')) {
        z.lookT = .25;
        // is player p looking straight at z (with the flashlight on)?
        const lit = p => { const dx = z.x - p.x, dz = z.z - p.z, d = Math.hypot(dx, dz) || 1; return p.fl && (-dx * Math.sin(p.yaw) - dz * Math.cos(p.yaw)) / d > .93 && this.nav.clearLine(p.x, p.z, z.x, z.z); };
        if (z.state === 'feed') {
          for (const p of alive) { const d = Math.hypot(p.x - z.x, p.z - z.z); if (d < 2.6 || (d < 8 && this.canSee(z, p))) { this.wake(z); break; } }
        } else if (z.state === 'weep') {
          // she ignores noise; come too close, or put your light on her, and she turns
          for (const p of alive) { const d = Math.hypot(p.x - z.x, p.z - z.z); if (d < 2.2 || (d < 7.5 && lit(p))) { this.weeperRage(z, p); break; } }
        } else if (z.state === 'dormant') {
          for (const p of alive) {
            const d = Math.hypot(p.x - z.x, p.z - z.z);
            const behind = (-(z.x - p.x) * Math.sin(p.yaw) - (z.z - p.z) * Math.cos(p.yaw)) / Math.max(d, .01) < -.2;
            if (d < 2.4 || (d < 7 && behind && Math.random() < .08)) { this.wake(z); break; }
          }
        } else if (z.state === 'ceiling') {
          for (const p of alive) if (Math.hypot(p.x - z.x, p.z - z.z) < 2.1) { this.drop(z); break; }
        } else if (z.state === 'chase') {
          const p = this.player(z.tgt);
          if (p && p.st === 'a' && !p.hid && (this.canSee(z, p) || Math.hypot(p.x - z.x, p.z - z.z) < 3)) { z.seenT = this.time; z.lx = p.x; z.lz = p.z; }
          // a flashlight in the face: the thin ones shield their eyes, the others hesitate now and then
          if (p && z.flinchCd <= 0 && Math.hypot(p.x - z.x, p.z - z.z) < 4.5 && lit(p) && (z.type === 'thin' || z.type === 'screamer' || (z.type === 'walker' && Math.random() < .4))) {
            z.flinchT = z.type === 'walker' ? .45 : .9; z.flinchCd = 4;
          }
        } else {
          for (const p of alive) if (this.canSee(z, p)) {
            z.tgt = p.id; z.seenT = this.time; z.lx = p.x; z.lz = p.z; z.bestD = NAV_INF; z.stuckT = 0;
            // the screamer does not come for you: it calls the others
            if (z.type === 'screamer' && z.howlCd <= 0) { z.state = 'howl'; z.t = 1.6; this.ev({ e: 'howl', z: z.id }); break; }
            z.state = 'chase';
            if (z.type === 'stalker') this.ev({ e: 'spotted', z: z.id });
            break;
          }
        }
      }
      let faceX = 0, faceZ = 0, moveTo = null, sp = z.speed;
      switch (z.state) {
        case 'dormant': case 'ceiling': case 'feed': case 'weep': break;
        case 'trip': z.t -= dt; if (z.t <= 0) { z.state = 'chase'; z.seenT = this.time; z.bestD = NAV_INF; } break;
        case 'howl': {
          z.t -= dt;
          const p = this.player(z.tgt); if (p) { faceX = p.x - z.x; faceZ = p.z - z.z; }
          if (!z.howled && z.t < 1.25) { z.howled = true; this.noise(z.x, z.z, 26); }
          if (z.t <= 0) {
            z.howled = false; z.howlCd = 22;
            const away = p ? Math.atan2(z.x - p.x, z.z - p.z) : R(0, 6.28);
            z.wp = this.randomPoint(z.x + Math.sin(away) * 10, z.z + Math.cos(away) * 10, 5) || this.randomPoint(z.x, z.z, 12);
            z.state = 'flee'; z.t = 7;
          }
          break;
        }
        case 'flee': {
          z.t -= dt;
          if (!z.wp || z.t <= 0 || Math.hypot(z.wp.x - z.x, z.wp.z - z.z) < 1) { z.state = 'wander'; z.wait = R(1, 3); z.wp = null; break; }
          moveTo = { x: z.wp.x, z: z.wp.z, f: this.pointField(z.wp.x, z.wp.z), dpl: 9, reach: .5 };
          break;
        }
        case 'charge': {
          // the brute runs in a straight line and does not stop until it hits something
          z.t -= dt; faceX = z.cdx; faceZ = z.cdz;
          const ox = z.x, oz = z.z, step = 6.6 * dt;
          z.x += z.cdx * step; z.z += z.cdz * step; collide(z, .34, this.world.colliders);
          const moved = Math.hypot(z.x - ox, z.z - oz);
          for (const p of this.alivePlayers()) if (!p.hid && !z.charged && Math.hypot(p.x - z.x, p.z - z.z) < 1.25) { z.charged = true; this.hurtPlayer(p, ZDMG.brute, z.id); this.ev({ e: 'slam', p: p.id, z: z.id }); }
          if (moved < step * .4) { z.state = 'daze'; z.t = 2.2; this.ev({ e: 'thud', z: z.id, x: r2(z.x), zz: r2(z.z) }); this.noise(z.x, z.z, 10); }
          else if (z.t <= 0 || z.charged) { z.state = 'daze'; z.t = z.charged ? 1 : 1.4; }
          break;
        }
        case 'daze': z.t -= dt; if (z.t <= 0) { z.state = 'chase'; z.seenT = this.time; z.bestD = NAV_INF; } break;
        case 'rush': {
          z.t += dt;
          const p = this.player(z.tgt);
          if (z.vanish || z.t > 8 || !p || p.st !== 'a' || p.hid) { this.zombies.splice(i, 1); this.ev({ e: 'vanish', z: z.id, x: r2(z.x), zz: r2(z.z) }); continue; }
          const dpl = Math.hypot(p.x - z.x, p.z - z.z);
          moveTo = { x: p.x, z: p.z, f: this.fieldFor(p), dpl, reach: 1.4 };
          if (z.t > .7) tryAttack(p, 1.4); else sp = 0;   // a shriek first
          break;
        }
        case 'wake': z.t -= dt; if (z.t <= 0) { const p = nearest(z); z.state = p ? 'chase' : 'wander'; z.tgt = p && p.id; z.seenT = this.time; } break;
        case 'drop':
          z.t -= dt; z.y = Math.max(0, z.y0 * (z.t / .5));
          if (z.t <= 0) { z.y = 0; const p = (z.tgt && this.player(z.tgt)) || nearest(z); z.state = p ? 'chase' : 'wander'; z.tgt = p && p.id; z.seenT = this.time; }
          break;
        case 'stun': z.t -= dt; if (z.t <= 0) { z.state = 'wander'; this.ev({ e: 'unstun', z: z.id }); } break;
        case 'rise': {
          z.t -= dt;
          if (z.type !== 'dog') z.y = -1.7 * clamp(z.t / 1.8, 0, 1);
          if (z.t <= 0) {
            z.y = 0;
            const p = z.tgt ? this.player(z.tgt) : nearest(z);
            if (z.type === 'dog' && p) { z.state = 'chase'; z.tgt = p.id; z.seenT = this.time; }
            else if (p) { z.state = 'investigate'; z.tx = p.x + R(-3, 3); z.tz = p.z + R(-3, 3); z.t = 0; }
            else z.state = 'wander';
          }
          break;
        }
        case 'approach': {
          const w = z.win, dx = w.outX - z.x, dz = w.outZ - z.z, d = Math.hypot(dx, dz);
          if (d < .45) { z.state = 'tear'; z.t = 0; }
          else {
            const s = Math.min(d, z.speed * dt); z.x += dx / d * s; z.z += dz / d * s; faceX = dx; faceZ = dz;
            for (const o of this.zombies) {
              if (o === z || o.win !== w || (o.state !== 'tear' && o.state !== 'approach')) continue;
              const sx = z.x - o.x, sz = z.z - o.z, sd = Math.hypot(sx, sz);
              if (sd < .62 && sd > 1e-4) { const k = (.62 - sd) * .4; z.x += sx / sd * k; z.z += sz / sd * k; }
            }
          }
          if (z.life > 40) { this.zombies.splice(i, 1); continue; }
          break;
        }
        case 'tear': {
          const w = z.win; faceX = -w.nx; faceZ = -w.nz;
          if (this.W.boards[w.id] > 0) {
            z.t += dt;
            if (z.t > tearTime) {
              z.t = 0; this.W.boards[w.id] = z.type === 'brute' ? 0 : this.W.boards[w.id] - 1;
              this.ev({ e: 'board', win: w.id, n: this.W.boards[w.id], torn: true });
              this.noise(w.inX, w.inZ, 9);
            }
            tryAttack(nearest(z), 1.85);
          } else if (!this.zombies.some(o => o.state === 'climb' && o.win === w)) { z.state = 'climb'; z.t = 0; z.fx = z.x; z.fz = z.z; }
          break;
        }
        case 'climb': {
          const w = z.win;
          z.t += dt / (z.crawl ? 1.6 : z.run || z.type === 'thin' ? .75 : 1.15);
          const t = Math.min(1, z.t);
          z.x = z.fx + (w.inX - z.fx) * t; z.z = z.fz + (w.inZ - z.fz) * t;
          z.y = Math.sin(Math.PI * t) * (z.crawl ? .5 : .95);
          faceX = -w.nx; faceZ = -w.nz;
          if (t >= 1) {
            z.y = 0; const p = nearest(z);
            if (p) { z.state = 'investigate'; z.tx = p.x + R(-2, 2); z.tz = p.z + R(-2, 2); z.t = 0; } else z.state = 'wander';
          }
          break;
        }
        case 'chase': {
          z.sCount = 0;
          const p = this.player(z.tgt);
          if (p && p.st === 'a' && p.hid) {
            // it saw you climb in: it comes for the locker. Otherwise it goes to where it last saw you.
            if (z.knows === p.hid) { z.state = 'pry'; z.pry = p.hid; z.t = 0; }
            else { z.state = 'investigate'; z.tx = z.lx ?? p.x; z.tz = z.lz ?? p.z; z.t = 0; }
            break;
          }
          if (!p || p.st !== 'a') { z.state = 'investigate'; z.t = 0; if (p) { z.tx = p.x; z.tz = p.z; } break; }
          // the Matron is slow, but she keeps walking toward where she last saw you for much longer
          if (this.time - z.seenT > (z.type === 'stalker' ? 9 : 4) && z.type !== 'dog') { z.state = 'investigate'; z.tx = p.x; z.tz = p.z; z.t = 0; break; }
          const dpl = Math.hypot(p.x - z.x, p.z - z.z);
          moveTo = { x: p.x, z: p.z, f: this.fieldFor(p), dpl, fx: p.x, fz: p.z };
          if (z.flinchT > 0) sp = 0;
          // slow walkers lurch forward in short bursts now and then
          if (z.type === 'walker' && !z.run && !z.crawl) { z.burst += dt; if (Math.sin(z.burst * 1.3 + z.id) > .82) sp *= 1.9; }
          // walkers sometimes go down on their knees and have to get up again
          if (z.type === 'walker' && !z.crawl && dpl > 3 && Math.random() < dt * .02) { z.state = 'trip'; z.t = 1.8; this.ev({ e: 'trip', z: z.id }); moveTo = null; break; }
          if (z.type === 'brute' && z.chargeCd <= 0 && dpl > 4 && dpl < 10 && this.time - z.seenT < .3 && this.nav.clearLine(z.x, z.z, p.x, p.z)) {
            z.state = 'charge'; z.t = 1.3; z.charged = false; z.chargeCd = R(6, 9);
            z.cdx = (p.x - z.x) / dpl; z.cdz = (p.z - z.z) / dpl;
            this.ev({ e: 'charge', z: z.id }); moveTo = null; break;
          }
          if (z.type === 'screamer' && z.howlCd <= 0 && dpl < 12 && this.time - z.seenT < .3) { z.state = 'howl'; z.t = 1.6; this.ev({ e: 'howl', z: z.id }); moveTo = null; break; }
          // close in from different sides instead of queueing behind each other
          if (dpl > 1.5 && dpl < 4.5) {
            const mates = this.zombies.filter(o => o !== z && o.state === 'chase' && o.tgt === z.tgt && Math.hypot(o.x - p.x, o.z - p.z) < 5);
            if (mates.length) {
              const myA = Math.atan2(z.z - p.z, z.x - p.x);
              const rank = mates.filter(o => angDiff(myA, Math.atan2(o.z - p.z, o.x - p.x)) < 0).length;
              const a = myA + (rank - mates.length / 2) * .8;
              const sx = p.x + Math.cos(a) * 1.15, sz = p.z + Math.sin(a) * 1.15;
              if (this.nav.free(this.nav.cell(sx, sz)) && this.nav.clearLine(z.x, z.z, sx, sz)) { moveTo.x = sx; moveTo.z = sz; moveTo.dpl = Math.min(dpl, 3); }
            }
          }
          if (z.type === 'thin') {
            z.burst += dt;
            sp *= z.burst % 1.3 < .95 ? 1 : .2;
            if (!z.screamed && dpl < 14) { z.screamed = true; z.scream = 1.2; this.ev({ e: 'scream', z: z.id }); }
            if (z.scream > 0) sp *= .1;
          }
          const reach = z.crawl ? 1.0 : z.type === 'dog' ? 1.45 : z.type === 'stalker' ? 1.5 : 1.3;
          tryAttack(p, reach);
          moveTo.reach = reach;
          const td = this.nav.distAt(moveTo.f, z.x, z.z);
          if (td < z.bestD - 2 || dpl < 3) { z.bestD = Math.min(z.bestD, td); z.stuckT = 0; } else z.stuckT += dt;
          if (z.stuckT > 12 && dpl > 5 && z.type !== 'stalker') { z.state = 'wander'; z.stuckT = 0; z.bestD = NAV_INF; }
          break;
        }
        case 'investigate': {
          z.t += dt;
          const d = Math.hypot(z.tx - z.x, z.tz - z.z);
          if (d < 1.2 || z.t > 25) {
            // the Matron checks the cupboards around the spot where she lost you
            if (z.type === 'stalker' && this.time > (z.searchCd || 0)) {
              z.searchList = this.hidesNear(z.x, z.z, 12).slice(0, 2).map(h => h.id);
              z.searchCd = this.time + 30;
              if (z.searchList.length) { z.state = 'search'; z.t = 0; z.opening = 0; this.ev({ e: 'searching', z: z.id }); break; }
            }
            // look around a little before giving up
            if (z.type !== 'dog' && z.type !== 'stalker' && z.sCount < 2) {
              const q = this.randomPoint(z.x, z.z, 8);
              if (q) { z.sCount++; z.tx = q.x; z.tz = q.z; z.t = 0; break; }
            }
            z.state = 'wander'; z.wait = R(1.5, 4); break;
          }
          moveTo = { x: z.tx, z: z.tz, f: this.pointField(z.tx, z.tz), dpl: d, reach: .5 };
          sp = z.speed * (z.type === 'stalker' ? .6 : z.run ? .75 : 1);
          break;
        }
        case 'search': case 'pry': {
          const id = z.state === 'pry' ? z.pry : z.searchList[0], h = this.hideSpot(id);
          if (!h) { z.state = 'wander'; break; }
          const fx = h.x + h.nx * .75, fz = h.z + h.nz * .75, d = Math.hypot(fx - z.x, fz - z.z);
          if (d > .5) { moveTo = { x: fx, z: fz, f: this.pointField(fx, fz), dpl: d, reach: .3 }; sp = z.speed * (z.type === 'stalker' ? .7 : 1); z.opening = 0; break; }
          faceX = -h.nx; faceZ = -h.nz;
          z.opening = (z.opening || 0) + dt;
          z.swing = z.state === 'pry' && z.type !== 'stalker' ? .45 : z.swing;
          const need = z.type === 'stalker' ? 1.8 : 4;
          if (z.opening < need) break;
          z.opening = 0;
          const pid = this.W.hides[id], p = pid && this.player(pid);
          this.ev({ e: 'hideOpen', hide: id, z: z.id, found: !!p });
          if (p) {
            this.unhide(p, true);
            z.state = 'chase'; z.tgt = p.id; z.seenT = this.time; z.bestD = NAV_INF;
            this.hurtPlayer(p, z.type === 'stalker' ? 999 : 40, z.id);
            break;
          }
          if (z.state === 'search') { z.searchList.shift(); if (!z.searchList.length) { z.state = 'wander'; z.wait = R(2, 4); } }
          else { z.state = 'wander'; z.knows = null; }
          break;
        }
        case 'wander': {
          if (z.wait > 0) { z.wait -= dt; z.rot += Math.sin(this.time * .7 + z.id) * dt * .6; break; }
          if (!z.wp || Math.hypot(z.wp.x - z.x, z.wp.z - z.z) < 1) {
            // the Matron drifts toward the living, as if she can smell them
            const prey = z.type === 'stalker' && Math.random() < (this.matronMortal() ? 1 : .45) ? pick(this.alivePlayers()) : null;
            z.wp = prey ? this.randomPoint(prey.x, prey.z, 7) : this.randomPoint(z.x, z.z, z.type === 'stalker' ? 14 : 9);
            z.wait = z.type === 'stalker' ? R(2, 5) : R(1, 4);
            if (!z.wp) break;
          }
          moveTo = { x: z.wp.x, z: z.wp.z, f: this.pointField(z.wp.x, z.wp.z), dpl: 9, reach: .5 };
          sp = Math.min(z.speed, 1.0) * (z.type === 'stalker' ? .9 : .6);
          break;
        }
      }
      // stuck behind others in a doorway: take a short detour
      if (moveTo && z.detourT > 0 && (z.state === 'chase' || z.state === 'investigate') && moveTo.dpl > 2.2) {
        z.detourT -= dt;
        if (z.detour) moveTo = { x: z.detour.x, z: z.detour.z, f: this.pointField(z.detour.x, z.detour.z), dpl: 9, reach: .4 };
      }
      if (moveTo) {
        const ox = z.x, oz = z.z;
        let tx = moveTo.x, tz = moveTo.z;
        if (!(moveTo.dpl < 3.5 && this.nav.clearLine(z.x, z.z, tx, tz)) && moveTo.f) {
          const s = this.nav.steer(moveTo.f, z.x, z.z);
          if (s) { tx = s.x; tz = s.z; }
        }
        if (z.crawl) sp = Math.min(sp, .9);
        if (z.limpT > 0) sp *= .55;   // shot in the leg
        const dx = tx - z.x, dz = tz - z.z, d = Math.hypot(dx, dz);
        if (moveTo.dpl > moveTo.reach * .7 && d > .01) { const s = Math.min(d, sp * dt); z.x += dx / d * s; z.z += dz / d * s; }
        for (const o of this.zombies) {
          if (o === z || o.state === 'dormant' || o.state === 'ceiling' || o.state === 'approach' || o.state === 'tear') continue;
          const sx = z.x - o.x, sz = z.z - o.z, sd = sx * sx + sz * sz;
          if (sd < .3 && sd > 1e-6) { const l = Math.sqrt(sd), k = (.55 - l) * .5; z.x += sx / l * k; z.z += sz / l * k; }
        }
        collide(z, z.type === 'dog' ? .3 : z.type === 'brute' ? .34 : .28, this.world.colliders);
        if (z.state === 'chase' && moveTo.dpl < 2.5) { faceX = (moveTo.fx ?? moveTo.x) - z.x; faceZ = (moveTo.fz ?? moveTo.z) - z.z; } else { faceX = dx; faceZ = dz; }
        const want = sp * dt;
        if ((z.state === 'chase' || z.state === 'investigate') && want > .01 && moveTo.dpl > 2.2) {
          if (Math.hypot(z.x - ox, z.z - oz) < want * .3) z.slowT += dt; else z.slowT = Math.max(0, z.slowT - dt * 2);
          if (z.slowT > 1.4) { z.slowT = 0; z.detour = this.randomPoint(z.x, z.z, 4); z.detourT = z.detour ? 2.2 : 0; }
        }
      }
      if (faceX || faceZ) z.rot += angDiff(z.rot, Math.atan2(faceX, faceZ)) * Math.min(1, dt * (z.type === 'dog' ? 10 : 7));
    }
  }

  // ---------- powerups / explosions ----------
  dropPowerup(x, z, kind) {
    kind = kind || pick(['ammo', 'insta', 'double', 'nuke', 'carpenter']);
    this.powerups.push({ id: this.nextId++, kind, x, z, t: 26 });
    this.ev({ e: 'puSpawn', kind });
  }
  applyPowerup(u, p) {
    const W = this.W;
    this.ev({ e: 'pu', kind: u.kind, p: p.id });
    if (u.kind === 'ammo') for (const pl of this.players) { for (const w of pl.w) w.res = wdef(w.id).res; pl.g = Math.max(pl.g, 2); }
    if (u.kind === 'insta') W.insta = 30;
    if (u.kind === 'double') W.dbl = 30;
    if (u.kind === 'nuke') {
      for (const z of this.zombies.slice()) if (z.type !== 'stalker' && z.state !== 'dormant' && z.state !== 'ceiling') this.killZombie(z, null, false, 'nuke');
      for (const pl of this.players) this.addPts(pl, 400);
    }
    if (u.kind === 'carpenter') {
      for (const id in W.boards) if (W.boards[id] < 6) { W.boards[id] = 6; this.ev({ e: 'board', win: id, n: 6 }); }
      for (const pl of this.players) this.addPts(pl, 200);
    }
  }
  explode(x, y, z, r, dmg, p, kind, hurtPlayers) {
    this.ev({ e: 'explode', x: r2(x), y: r2(y), z: r2(z), r, kind });
    this.noise(x, z, 35, p);
    for (const zb of this.zombies.slice()) {
      const d = Math.hypot(zb.x - x, (zb.y + 1) - y, zb.z - z);
      if (d < r) this.damageZombie(zb, dmg * (1 - d / r * .6), 'torso', p, 'explosive');
    }
    if (hurtPlayers) for (const pl of this.players) if (pl.st === 'a' && Math.hypot(pl.x - x, pl.z - z) < r * .5) this.hurtPlayer(pl, 25, 'self');
  }
  updateGrenades(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vy -= 12 * dt;
      const nx = g.x + g.vx * dt, nz = g.z + g.vz * dt;
      const hit = (x, zz) => { const b = pointBlocked(x, zz, this.world.colliders, .05); return b && !(b.tag === 'sill' && g.y > 1.05) && !(b.tag === 'prop' && g.y > 1.2); };
      if (hit(nx, g.z)) g.vx *= -.45; else g.x = nx;
      if (hit(g.x, nz)) g.vz *= -.45; else g.z = nz;
      g.y += g.vy * dt;
      const zn = this.map.zones.find(zz => zz.id === zoneAt(this.map, g.x, g.z));
      if (zn && zn.ceil && g.y > zn.ceil - .1) { g.y = zn.ceil - .1; g.vy = -Math.abs(g.vy) * .3; }
      if (g.y < .06) { g.y = .06; if (g.vy < 0) g.vy = -g.vy * .32; g.vx *= .65; g.vz *= .65; }
      g.t -= dt;
      if (g.t <= 0) {
        this.grenades.splice(i, 1);
        this.explode(g.x, g.y, g.z, GRENADE.radius, GRENADE.dmg + this.W.round * 30, this.player(g.owner), 'grenade', true);
      }
    }
  }

  // ---------- director ----------
  start() {
    if (this.W.phase !== 'pre') return;
    this.W.phase = 'play';
    let id = 1;
    for (const it of this.map.items || []) this.W.items.push(Object.assign({ id: 'i' + id++, y: .05 }, it));
    for (const n of this.map.notes || []) this.W.items.push(Object.assign({ id: 'i' + id++, y: .05, kind: 'note' }, n));
    const spots = (this.map.fuseSpots || []).slice().sort(() => Math.random() - .5).slice(0, 3);
    for (const s of spots) this.W.items.push(Object.assign({ id: 'i' + id++, kind: 'fuse', y: .05 }, s));
    for (const r of this.map.randomItems || []) {
      const pick = r.spots.slice().sort(() => Math.random() - .5).slice(0, r.n);
      for (const sp of pick) this.W.items.push(Object.assign({ id: 'i' + id++, kind: r.kind, y: .05 }, sp));
    }
    if (this.night.includes('scarce')) {
      const bats = this.W.items.filter(i => i.kind === 'battery').sort(() => Math.random() - .5);
      bats.slice(0, Math.floor(bats.length / 2)).forEach((b, k) => { if (k === 0) b.kind = 'medkit'; else this.W.items.splice(this.W.items.indexOf(b), 1); });
    }
    // tonight's answers stay in the simulation; only the scraps of paper give them away
    this.answers = {};
    for (const pz of this.map.puzzles || []) {
      this.answers[pz.id] = makeAnswer(pz);
      this.W.puzzles[pz.id] = { open: false, seq: [], cd: 0 };
      const at = pick(pz.clueSpots);
      this.W.items.push({ id: 'i' + id++, kind: 'clue', clue: pz.id, title: clueText(pz, this.answers[pz.id]).title, x: at.x, z: at.z, y: .05 });
    }
    this.itemSeq = id;
    const o = objective(this.map, this.W);
    if (o && o.time) this.W.obj.t = o.time;
    this.placeLurkers();
    this.ev({ e: 'objective', i: 0 });
  }
  director(dt) {
    const W = this.W, D = this.D, o = objective(this.map, W), holding = o && o.id === 'hold';
    W.elapsed += dt;
    W.level = clamp((W.elapsed / 900 + W.obj.i * .1 + (holding ? .2 : 0)) * this.diff.level, 0, 1);
    W.round = 1 + Math.floor(W.level * 9);
    D.t -= dt;
    if (D.t <= 0) {
      const next = { calm: 'build', build: 'peak', peak: 'relax', relax: 'calm' }[D.phase];
      D.phase = next;
      D.t = { calm: holding ? 5 : R(25, 45), build: R(20, 30), peak: holding ? 35 : R(20, 28), relax: holding ? 5 : R(15, 22) }[next];
      if (next === 'peak') {
        D.drops = 0;
        this.ev({ e: 'peak' });
        if (W.level > .4 && Math.random() < .3 && !holding) { const n = 2 + this.players.length; for (let k = 0; k < n; k++) this.dogQueue.push(k * 1.2); }
      }
      if (next === 'relax') for (const p of this.players) if (p.st === 'x') this.respawnPlayer(p);
    }
    this.dogQueue = this.dogQueue.filter(t => { if (t <= 0) { this.spawnDog(); return false; } return true; }).map(t => t - dt);
    const np = this.players.filter(p => p.st === 'a' || p.st === 'd').length || 1;
    const sm = this.diff.spawn;
    const lim = { calm: [(2 + W.level * 3) * sm, 7], build: [(4 + W.level * 8) * sm, 3.5], peak: [(6 + W.level * 14) * (1 + .4 * (np - 1)) * sm, 1.0], relax: [0, 99] }[D.phase];
    const active = this.zombies.filter(z => z.state !== 'dormant' && z.state !== 'ceiling' && z.state !== 'feed' && z.state !== 'weep' && z.type !== 'stalker').length;
    D.spawnT = (D.spawnT ?? 3) - dt;
    if (D.spawnT <= 0 && active < lim[0] && this.alivePlayers().length) { D.spawnT = lim[1] * R(.7, 1.3); this.spawnZombie(); }
    // the stalker joins after its trigger
    const st = this.map.stalker;
    if (st && !W.stalker && !W.matronDead) {
      const early = this.night.includes('early');
      if (W.stalkerAt === null && ((st.after === 'fusebox' && W.power) || (st.at && W.elapsed > st.at * (early ? .5 : 1)) || (st.afterObj !== undefined && W.obj.i >= st.afterObj) || (early && W.elapsed > 150))) W.stalkerAt = W.elapsed + (st.delay || 0) * (early ? .5 : 1);
      if (W.stalkerAt !== null && W.elapsed >= W.stalkerAt) this.spawnStalker();
    }
    // unsettling moments
    D.scareT -= dt;
    if (D.scareT <= 0) {
      D.scareT = R(35, 80);
      const p = pick(this.alivePlayers());
      if (p) {
        const kind = pick(['whisper', 'scream', 'slam', 'steps', W.power || !this.map.hasPower ? 'lights' : 'whisper']);
        const a = R(0, Math.PI * 2), d = R(6, 12);
        if (kind === 'lights') W.blackout = 4;
        this.ev({ e: 'scare', kind, x: r2(p.x + Math.cos(a) * d), z: r2(p.z + Math.sin(a) * d), p: p.id });
      }
    }
    W.blackout = Math.max(0, W.blackout - dt);
    // storm: thunder every so often, loud enough to cover what you do for a moment
    W.thunder = Math.max(0, W.thunder - dt);
    if (this.night.includes('storm')) {
      D.stormT = (D.stormT ?? R(8, 20)) - dt;
      if (D.stormT <= 0) { D.stormT = R(15, 35); W.thunder = 2; this.ev({ e: 'thunder' }); }
    }
    // failing generator: the lights go out more often, and for longer
    if (this.night.includes('power') && W.power) {
      D.powerT = (D.powerT ?? R(20, 40)) - dt;
      if (D.powerT <= 0) { D.powerT = R(25, 50); W.blackout = R(4, 9); this.ev({ e: 'generator' }); }
    }
    // timed objective
    if (holding) {
      W.obj.t -= dt;
      if (o.checkpointAt && W.obj.t <= o.checkpointAt && !(W.cp && W.cp.obj === W.obj.i)) this.saveCheckpoint();
      if (W.obj.t <= 0) { this.ev({ e: 'rescue' }); this.advance(); }
    }
  }

  // ---------- main step ----------
  step(dt) {
    const W = this.W;
    this.time += dt;
    if (W.phase !== 'play') return;
    this.fieldT -= dt;
    if (this.fieldT <= 0) {
      this.fieldT = .3;
      for (const p of this.players) {
        if (p.st !== 'a') { this.fields.delete(p.id); continue; }
        this.fields.set(p.id, this.nav.field(p.x, p.z, this.fields.get(p.id)));
      }
    }
    W.insta = Math.max(0, W.insta - dt); W.dbl = Math.max(0, W.dbl - dt);
    this.director(dt);
    this.updateZombies(dt);
    this.updatePlayers(dt);
    this.updateGrenades(dt);
    for (let i = this.gas.length - 1; i >= 0; i--) {
      const c = this.gas[i]; c.t -= dt;
      for (const p of this.players) if (p.st === 'a' && Math.hypot(p.x - c.x, p.z - c.z) < 2.6) {
        p.gas = .4; p.hp -= 14 * dt; p.lastHurt = this.time;
        if (p.hp <= 0) this.downPlayer(p);
      }
      if (c.t <= 0) this.gas.splice(i, 1);
    }
    for (const tr of this.map.traps || []) {
      const ts = W.traps[tr.id];
      if (ts.a > 0) {
        ts.a -= dt;
        const [x0, z0, x1, z1] = tr.area;
        for (const z of this.zombies.slice()) if (z.x > x0 && z.x < x1 && z.z > z0 && z.z < z1 && z.y < .5 && z.state !== 'dormant' && z.state !== 'approach') {
          if (z.type === 'stalker') { if (z.state !== 'stun') { z.state = 'stun'; z.t = 8; this.ev({ e: 'stun', z: z.id }); } }
          else this.killZombie(z, null, false, 'trap');
        }
        for (const p of this.players) if (p.st === 'a' && p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) { p.hp -= 60 * dt; p.lastHurt = this.time; if (p.hp <= 0) this.downPlayer(p); }
        if (ts.a <= 0) { ts.a = 0; ts.cd = 40; this.ev({ e: 'trap', id: tr.id, on: false }); }
      } else ts.cd = Math.max(0, ts.cd - dt);
    }
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const u = this.powerups[i]; u.t -= dt;
      const p = this.alivePlayers().find(p => Math.hypot(p.x - u.x, p.z - u.z) < 1.3);
      if (p) { this.powerups.splice(i, 1); this.applyPowerup(u, p); continue; }
      if (u.t <= 0) this.powerups.splice(i, 1);
    }
  }
  updatePlayers(dt) {
    const W = this.W, touched = new Set(), o = objective(this.map, W);
    for (const id in W.puzzles) { const q = W.puzzles[id]; if (q.cd > 0) q.cd = Math.max(0, q.cd - dt); }
    for (const p of this.players) {
      p.gas = Math.max(0, p.gas - dt);
      p.grabT = Math.max(0, (p.grabT || 0) - dt);
      if (p.st !== 'a') continue;
      if (p.fl) { p.bat = Math.max(0, p.bat - dt / (FLASH_LIFE * this.diff.bat)); if (p.bat <= 0) p.fl = false; }
      // only light wounds heal on their own
      const cap = p.mhp * this.diff.regen;
      if (this.time - p.lastHurt > 4 && p.hp < cap) p.hp = Math.min(cap, p.hp + 10 * dt);
      if (p.hid) continue;
      // footsteps and sprinting are heard
      p.noiseT -= dt;
      if (p.noiseT <= 0 && p.moved > .5) { p.noiseT = .5; this.noise(p.x, p.z, p.moved > 5 ? 8 : 3, p); }
      if (o && o.id === 'exit' && this.map.exit) {
        const [x0, z0, x1, z1] = this.map.exit;
        if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) { p.st = 'e'; this.ev({ e: 'escaped', p: p.id }); this.checkOver(); continue; }
      }
      if (p.hold) {
        const rv = findRevive(this.players, p);
        if (rv) {
          touched.add(rv.id); rv.revBy = p.id; rv.rev += dt / 3;
          if (rv.rev >= 1) this.revivePlayer(rv, p);
          continue;
        }
        const win = findRepair(this.world, W, p);
        if (win && !this.zombies.some(z => z.win === win && z.state === 'climb')) {
          p.repairT += dt;
          if (p.repairT > .5) {
            p.repairT = 0;
            W.boards[win.id]++; p.boards++;
            this.ev({ e: 'board', win: win.id, n: W.boards[win.id], by: p.id });
            this.noise(p.x, p.z, 6, p);
            if (p.boardsPts < 500) { p.boardsPts += 10; this.addPts(p, 10); }
          }
        } else p.repairT = .25;
      } else p.repairT = .25;
    }
    for (const p of this.players) {
      if (p.st !== 'd') continue;
      if (!touched.has(p.id)) { p.rev = 0; p.revBy = null; p.bleed -= dt; }
      if (p.bleed <= 0) {
        p.st = 'x'; p.w = [this.newWeapon('m1911')]; p.cur = 0;
        this.ev({ e: 'dead', p: p.id });
        this.checkOver();
      }
    }
  }

  snapshot() {
    return {
      t: r2(this.time),
      W: JSON.parse(JSON.stringify(this.W)),
      z: this.zombies.map(z => [z.id, TI[z.type], Math.round(z.x * 100), Math.round(z.z * 100), Math.round(z.y * 100), Math.round(z.rot * 100), SI[z.state], z.lost,
        (z.swing > 0 ? ZFLAG.swing : 0) | (z.run || z.type === 'thin' ? ZFLAG.run : 0) | (z.scream > 0 ? ZFLAG.scream : 0) | (z.crawl ? ZFLAG.crawl : 0) | (z.state === 'chase' ? ZFLAG.alert : 0) | (z.flinchT > 0 ? ZFLAG.shield : 0) | (z.stagger > 0 ? ZFLAG.stagger : 0) | ((z.atkV || 0) << ATK_SHIFT),
        z.win ? z.win.id : 0]),
      p: this.players.map(p => ({
        id: p.id, name: p.name, color: p.color, x: r2(p.x), z: r2(p.z), y: r2(p.y), yaw: r2(p.yaw), pitch: r2(p.pitch), st: p.st,
        hp: Math.round(p.hp), mhp: p.mhp, pts: p.pts, score: p.score, w: p.w.map(w => ({ id: w.id, mag: w.mag, res: w.res })), cur: p.cur,
        g: p.g, bat: r2(p.bat), fl: p.fl, bleed: r2(p.bleed), rev: r2(p.rev), revBy: p.revBy,
        hid: p.hid, ack: p.ack, tp: p.tp, kills: p.kills, heads: p.heads, downs: p.downs, revives: p.revives, boards: p.boards, shots: p.shots, stuns: p.stuns, gas: p.gas > 0, sp: p.sprint, ads: !!p.ads, rl: !!p.rl, gr: p.grabT > 0
      })),
      pu: this.powerups.map(u => [u.id, u.kind, r2(u.x), r2(u.z), r2(u.t)]),
      g: this.grenades.map(g => [g.id, r2(g.x), r2(g.y), r2(g.z)]),
      gas: this.gas.map(c => [r2(c.x), r2(c.z), r2(c.t)]),
      ev: this.events.splice(0)
    };
  }
}
