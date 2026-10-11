// Bunker 115 server: serves the game files and runs co-op rooms over WebSocket on one port.
//
// Meant to be reachable from the internet. With GAME_PASSWORD set, a visitor without the
// password gets only a login page: no game files, no records, no co-op. Behind it, rooms,
// connections, messages and record submissions are capped.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room } from './room.js';
import { Records } from './records.js';
import { loginPage } from './login.js';
import MAPS from '../shared/maps/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +process.env.PORT || 8115;
const HOST = process.env.HOST || '0.0.0.0';
const PASSWORD = process.env.GAME_PASSWORD || '';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const LIMITS = {
  rooms: +process.env.MAX_ROOMS || 8,           // games running at once
  conns: +process.env.MAX_CONNECTIONS || 40,     // websockets in total
  perIp: +process.env.MAX_PER_IP || 6,           // websockets from one address
  msgRate: 90, msgBurst: 180,                    // messages per second per socket
  helloWait: 10000,                              // ms to say hello before being dropped
  createGap: 3000                                // ms between room creations per socket
};
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const records = new Records(DATA_DIR);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const PUBLIC = ['/client/', '/shared/', '/node_modules/three/build/'];
const HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'"
};

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const passwordOk = given => !PASSWORD || crypto.timingSafeEqual(sha(given || ''), sha(PASSWORD));

// A logged-in browser holds a cookie derived from the password and a secret kept on disk,
// so logins survive restarts and changing the password logs everybody out.
function sessionSecret() {
  const file = path.join(DATA_DIR, 'session.key');
  try { const k = fs.readFileSync(file); if (k.length >= 32) return k; } catch {}
  const k = crypto.randomBytes(32);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, k, { mode: 0o600 });
  return k;
}
const SESSION = PASSWORD ? crypto.createHmac('sha256', sessionSecret()).update(PASSWORD).digest('hex') : '';
const COOKIE = 'b115';
function authed(req) {
  if (!PASSWORD) return true;
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)b115=([0-9a-f]{64})/);
  return !!m && crypto.timingSafeEqual(Buffer.from(m[1]), Buffer.from(SESSION));
}
// 10 wrong passwords per address, then a 15-minute wait
const failures = new Map();
const LOCK = { tries: 10, ms: 15 * 60000 };
const lockedOut = ip => { const f = failures.get(ip); return !!f && f.n >= LOCK.tries && Date.now() - f.t < LOCK.ms; };
const clientIp = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
const log = (...a) => console.log(new Date().toISOString(), ...a);

// at most one record submission per address every 30 s
const lastPost = new Map();

const server = http.createServer((req, res) => {
  const reply = (code, body = '', type) => { res.writeHead(code, Object.assign({}, HEADERS, type ? { 'content-type': type, 'cache-control': 'no-cache' } : {})); res.end(body); };
  let url;
  try { url = path.posix.normalize(decodeURIComponent((req.url || '/').split('?')[0])); } catch { return reply(400); }
  if (url.includes('\0')) return reply(400);
  if (req.method !== 'GET' && req.method !== 'HEAD' && !(req.method === 'POST' && (url === '/records' || url === '/login'))) return reply(405);
  const go = to => { res.writeHead(303, Object.assign({ Location: to, 'cache-control': 'no-store' }, HEADERS)); res.end(); };
  if (url === '/login' && req.method === 'POST') return login(req, res, reply);
  if (!authed(req)) {
    if (url === '/health') return reply(401, JSON.stringify({ ok: false }), 'application/json');
    if (url === '/' || url === '/login' || url === '/client/' || url === '/client/index.html') {
      const q = (req.url || '').split('?')[1] || '';
      return reply(200, loginPage(lockedOut(clientIp(req)) ? 'Too many attempts. Try again later.' : q === 'wrong' ? 'Wrong password.' : ''), 'text/html; charset=utf-8');
    }
    return reply(401, 'Login required');
  }
  if (url === '/' || url === '/index.html' || url === '/login') return go('/client/');
  // single-player escapes are reported by the browser
  if (url === '/records' && req.method === 'POST') {
    const ip = clientIp(req), now = Date.now();
    if (now - (lastPost.get(ip) || 0) < 30000) return reply(429);
    lastPost.set(ip, now);
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2000) req.destroy(); });
    req.on('end', () => {
      try {
        const m = JSON.parse(body);
        if (MAPS[m.map] && ['easy', 'normal', 'nightmare'].includes(m.diff) && +m.time >= 60 && +m.time < 36000 && Array.isArray(m.names) && m.names.length)
          records.add(m.map, m.diff, m.names.slice(0, 4).map(cleanName), +m.time, Math.max(0, Math.min(20, m.notes | 0)));
      } catch {}
      reply(204);
    });
    return;
  }
  if (url === '/records') return reply(200, JSON.stringify(records.all()), 'application/json');
  if (url === '/health') return reply(200, JSON.stringify({ ok: true }), 'application/json');
  if (!PUBLIC.some(p => url.startsWith(p))) return reply(404, 'Not found');
  let file = path.join(ROOT, url);
  if (!file.startsWith(ROOT + path.sep)) return reply(403);
  if (url.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) return reply(404, 'Not found');
    reply(200, data, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

function login(req, res, reply) {
  const ip = clientIp(req);
  const go = to => { res.writeHead(303, Object.assign({ Location: to, 'cache-control': 'no-store' }, HEADERS)); res.end(); };
  if (!PASSWORD) return go('/client/');
  if (lockedOut(ip)) return go('/login');
  let body = '';
  req.on('data', c => { body += c; if (body.length > 1000) req.destroy(); });
  req.on('end', () => {
    const given = new URLSearchParams(body).get('password') || '';
    if (passwordOk(given)) {
      failures.delete(ip);
      log('login from', ip);
      res.writeHead(303, Object.assign({ Location: '/client/', 'cache-control': 'no-store', 'set-cookie': `${COOKIE}=${SESSION}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` }, HEADERS));
      return res.end();
    }
    const f = failures.get(ip);
    failures.set(ip, { n: f && Date.now() - f.t < LOCK.ms ? f.n + 1 : 1, t: Date.now() });
    log('wrong password from', ip);
    setTimeout(() => go('/login?wrong'), 700);   // slows down guessing
  });
}
server.headersTimeout = 10000;
server.requestTimeout = 15000;

const rooms = new Map();
const byToken = new Map();
const perIp = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (rooms.has(c));
  return c;
}
const cleanName = n => String(n || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16) || 'Survivor';

// only logged-in browsers on this very site may open a game connection
const sameSite = req => { try { return !req.headers.origin || new URL(req.headers.origin).host === req.headers.host; } catch { return false; } };
// snapshots are JSON and shrink to about a third when compressed, which matters for home upload speeds
const wss = new WebSocketServer({
  server, path: '/ws', maxPayload: 8 * 1024, verifyClient: ({ req }) => authed(req) && sameSite(req),
  perMessageDeflate: { threshold: 256, serverNoContextTakeover: true, clientNoContextTakeover: true, zlibDeflateOptions: { level: 3 } }
});
let nextId = 1;
wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
  const n = (perIp.get(ip) || 0) + 1;
  if (wss.clients.size > LIMITS.conns || n > LIMITS.perIp) { ws.close(1013, 'busy'); return; }
  perIp.set(ip, n);
  let client = null, tokens = LIMITS.msgBurst, last = Date.now(), dropped = 0, lastCreate = 0;
  const send = m => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const helloTimer = setTimeout(() => { if (!client) ws.close(1008, 'hello'); }, LIMITS.helloWait);
  ws.on('message', raw => {
    // token bucket: a flood is dropped, a sustained flood is disconnected
    const now = Date.now();
    tokens = Math.min(LIMITS.msgBurst, tokens + (now - last) / 1000 * LIMITS.msgRate); last = now;
    if (tokens < 1) { if (++dropped > 400) ws.close(1008, 'rate'); return; }
    tokens--;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'hello') {
      if (client) return;
      clearTimeout(helloTimer);
      const old = m.token && byToken.get(m.token);
      if (old && old.room && old.room.clients.has(old.id)) {
        client = old; client.name = cleanName(m.name) || client.name;
        client.room.reconnect(client, ws);
        send({ t: 'welcome', id: client.id, token: client.token, rejoined: true });
        return;
      }
      client = { id: 'p' + nextId++, token: crypto.randomUUID(), name: cleanName(m.name), ws, room: null, connected: true };
      byToken.set(client.token, client);
      send({ t: 'welcome', id: client.id, token: client.token });
      return;
    }
    if (!client) return;
    const room = client.room;
    switch (m.t) {
      case 'create': {
        if (now - lastCreate < LIMITS.createGap) return;
        lastCreate = now;
        if (room) room.leave(client);
        if (rooms.size >= LIMITS.rooms) return send({ t: 'error', msg: 'The server is full. Try again later.' });
        const code = newCode();
        const r = new Room(code, m.map, rm => { rooms.delete(rm.code); log('room closed', rm.code); }, records);
        rooms.set(code, r);
        r.join(client);
        log('room', code, 'created by', client.name, ip);
        break;
      }
      case 'join': {
        const r = rooms.get(String(m.code || '').toUpperCase().trim().slice(0, 4));
        if (!r) return send({ t: 'error', msg: 'There is no game with that code.' });
        if (r.full() && !r.clients.has(client.id)) return send({ t: 'error', msg: 'That game already has 4 players.' });
        if (room && room !== r) room.leave(client);
        r.join(client);
        break;
      }
      case 'leave': if (room) { room.leave(client); client.room = null; } break;
      case 'map': if (room) room.setMap(client, m.map); break;
      case 'diff': if (room) room.setDiff(client, m.diff); break;
      case 'start': if (room) room.start(client); break;
      case 'lobby': if (room) room.backToLobby(client); break;
      case 'resume': if (room) room.resume(client); break;
      case 'name': client.name = cleanName(m.name); if (room) room.broadcast(room.lobbyState()); break;
      case 'ping': send({ t: 'pong', c: +m.c || 0 }); break;
      default: if (room) room.input(client, m);
    }
  });
  ws.on('close', () => {
    clearTimeout(helloTimer);
    const left = (perIp.get(ip) || 1) - 1;
    if (left > 0) perIp.set(ip, left); else perIp.delete(ip);
    if (!client || client.ws !== ws) return;
    if (client.room) client.room.disconnect(client);
    else { client.connected = false; byToken.delete(client.token); }
  });
  ws.on('error', () => {});
});

// forget reconnect tokens of players who are gone for good, and old rate-limit entries
setInterval(() => {
  for (const [t, c] of byToken) if (!c.connected && (!c.room || !c.room.clients.has(c.id))) byToken.delete(t);
  const old = Date.now() - 60000;
  for (const [ip, t] of lastPost) if (t < old) lastPost.delete(ip);
  for (const [ip, f] of failures) if (Date.now() - f.t > LOCK.ms) failures.delete(ip);
}, 60000).unref();

server.listen(PORT, HOST, () => log(`Bunker 115 is running on port ${PORT}${PASSWORD ? ' (password protected)' : ' (no password: anyone who can reach it can play)'}`));
