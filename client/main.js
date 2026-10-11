// Bunker 115 client: menus, lobby, input, prediction of your own movement, interpolation of
// everyone else, shooting against zombie hitboxes, the flashlight, tension-driven sound, HUD.
import * as THREE from 'three';
import { createPipeline } from './render/psx.js';
import { makeTextures } from './render/textures.js';
import { buildWorldView } from './render/world.js';
import { gunMats, buildGun, addArms } from './render/guns.js';
import { FX, COL } from './render/fx.js';
import { Entities } from './render/entities.js';
import { poseHumanoid, poseDeath } from './render/rig.js';
import { HUD } from './hud.js';
import { initAudio, SFX, setListener, setTension, setVolume, audioStatus, testTone, musicState, matronArrives, matronDies, flush, setRain } from './audio.js';
import { nightLine } from '../shared/night.js';
import { opts, saveOpts, bindSettings, records, hints, docs, fmtTime } from './options.js';
import { pollPad } from './gamepad.js';
import { Fear } from './fear.js';
import { ACH, unlock, unlocked, endOfNight } from './achievements.js';
import { NOTES, INTRO, ending, epilogue, CREDITS } from '../shared/story.js';
import { DIFFICULTY } from '../shared/sim.js';
import { LocalTransport, WsTransport, serverAvailable } from './net.js';
import MAPS from '../shared/maps/index.js';
import { buildWorld, collide, setDoorOpen, zoneAt } from '../shared/world.js';
import { wdef, WEAPONS, capacity } from '../shared/weapons.js';
import { findInteract, findRevive, findRepair, objectiveText, objectiveGuide, KEY_NAMES } from '../shared/interact.js';
import { ZTYPES, ZSTATES, ZFLAG } from '../shared/sim.js';
import { clamp, lerp, R, angDiff } from '../shared/util.js';

const $ = id => document.getElementById(id);
const canvas = $('c');
const pipe = createPipeline(canvas);
const TX = makeTextures();
const GMv = gunMats(TX), GMw = gunMats(TX);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
// Picture "Auto": start at 360 lines, drop a step when the frame rate sags, climb back when it is smooth
const AUTO_LINES = [480, 360, 256, 200], autoRes = { i: 1, low: 0, high: 0 };
function autoResolution(fps, dt) {
  if (opts.res) return;
  autoRes.low = fps < 40 ? autoRes.low + dt : 0;
  autoRes.high = fps > 57 ? autoRes.high + dt : 0;
  let i = autoRes.i;
  if (autoRes.low > 3 && i < AUTO_LINES.length - 1) i++;
  else if (autoRes.high > 10 && i > 0) i--;
  if (i !== autoRes.i) { autoRes.i = i; autoRes.low = autoRes.high = 0; pipe.setLines(AUTO_LINES[i]); }
}
function applyOptions(changed) {
  setVolume(opts.vol, opts.music);
  pipe.post.uniforms.uBright.value = opts.bright;
  if (!changed || changed === 'res') { autoRes.i = 1; pipe.setLines(opts.res || AUTO_LINES[autoRes.i]); }
  $('fps').hidden = !opts.fps;
}
bindSettings(applyOptions);
$('nick').value = store.get('b115-nick', 'Survivor' + (Math.random() * 900 + 100 | 0));
$('nick').addEventListener('change', e => store.set('b115-nick', e.target.value.trim().slice(0, 16)));
let mapChoice = store.get('b115-map', 'sanatorium');
if (!MAPS[mapChoice]) mapChoice = 'sanatorium';

// noLock: the mouse cannot be captured (no Pointer Lock API, or every click is refused)
const app = { screen: 'menu', ws: null, lobby: null, mpOk: false, noLock: !('requestPointerLock' in Element.prototype) };
let G = null;
const keys = {};
let mouseDown = false, rmb = false, firedThisPress = false, pressF = false;
const errNote = text => { $('mpNote').textContent = text; $('mpNote').classList.add('err'); };

/* ===================== menus ===================== */
function screen(id) {
  app.screen = id;
  $('game').classList.toggle('playing', id === 'play');
  for (const s of ['menu', 'lobby', 'pause', 'over', 'settings', 'achScreen']) $(s).hidden = s !== id;
  HUD.show(!!G && (id === 'play' || id === 'pause'));
}
function mapCards(el, current, onPick, disabled) {
  el.innerHTML = '';
  for (const id in MAPS) {
    const m = MAPS[id], b = document.createElement('button');
    b.className = 'mapcard'; b.type = 'button'; b.setAttribute('aria-pressed', id === current);
    b.disabled = !!disabled;
    b.innerHTML = `<b></b><span></span><span class="rec"></span>`;
    b.querySelector('b').textContent = m.name; b.querySelector('span').textContent = m.blurb;
    const rec = records.get(id, opts.diff);
    b.querySelector('.rec').textContent = rec !== null ? `Best escape on ${DIFFICULTY[opts.diff].name}: ${fmtTime(rec)}` : '';
    b.addEventListener('click', () => onPick(id));
    el.appendChild(b);
  }
}
function renderMenuMaps() { mapCards($('maps'), mapChoice, id => { mapChoice = id; store.set('b115-map', id); renderMenuMaps(); renderHall(); menuBackdrop(id); }); }
const DIFF_NOTE = { easy: 'Easy', normal: 'Normal', nightmare: 'Nightmare' };
function diffButtons(el, current, onPick, disabled) {
  el.innerHTML = '';
  for (const id in DIFFICULTY) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = DIFF_NOTE[id];
    b.setAttribute('aria-pressed', id === current); b.disabled = !!disabled;
    b.addEventListener('click', () => onPick(id)); el.appendChild(b);
  }
}
function renderDiffs() { diffButtons($('diffs'), opts.diff, id => { opts.diff = id; saveOpts(); renderDiffs(); renderMenuMaps(); renderHall(); }); }
renderMenuMaps(); renderDiffs();
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) $('deviceNote').textContent = 'This game needs a keyboard and mouse or a gamepad. Touch screens are not supported.';
let settingsFrom = 'menu';
$('settingsBtn').addEventListener('click', () => { settingsFrom = 'menu'; screen('settings'); });
$('sndTest').addEventListener('click', () => {
  initAudio(); testTone();
  setTimeout(() => {
    const st = audioStatus();
    console.info('[audio] status:', st, '| volume:', opts.vol);
    $('sndState').textContent =
      st === 'running' ? (opts.vol > 0 ? 'Sound is on. If you heard nothing, check the tab and system volume.' : 'Sound is on, but Master volume is at 0.')
      : st === 'unsupported' ? 'This browser has no Web Audio, so the game cannot play sound.'
      : st === 'suspended' ? 'The browser is blocking sound for this site. Allow sound/autoplay in the site settings next to the address bar.'
      : 'Sound could not start (' + st + ').';
  }, 300);
});
$('pauseSettingsBtn').addEventListener('click', () => { settingsFrom = 'pause'; screen('settings'); });
$('pauseJournalBtn').addEventListener('click', () => { if (!G) return; resume(); setTimeout(openJournal, 50); });
$('settingsBack').addEventListener('click', () => screen(settingsFrom));
function renderAch() {
  const got = unlocked();
  $('achBtn').textContent = `Achievements ${Object.keys(got).length}/${ACH.length}`;
  $('achList').innerHTML = '';
  for (const a of ACH) {
    const li = document.createElement('li'); li.className = got[a.id] ? 'got' : 'locked';
    const b = document.createElement('b'); b.textContent = a.name;
    const sp = document.createElement('span'); sp.textContent = got[a.id] ? `${a.desc} Unlocked ${got[a.id]}.` : a.desc;
    li.append(b, sp); $('achList').appendChild(li);
  }
}
renderAch();
$('achBtn').addEventListener('click', () => { renderAch(); screen('achScreen'); });
$('achBack').addEventListener('click', () => screen('menu'));
function award(id) {
  if (!unlock(id)) return;
  const a = ACH.find(x => x.id === id);
  $('toastText').textContent = a.name;
  $('toast').classList.add('on'); SFX.objective();
  clearTimeout(award.t); award.t = setTimeout(() => $('toast').classList.remove('on'), 4500);
  renderAch();
}
// the hall of survivors lives on the server
let hall = null;
async function loadHall() {
  try { const r = await fetch('/records', { cache: 'no-store' }); if (r.ok) hall = await r.json(); } catch (e) { hall = null; }
  renderHall();
}
function renderHall() {
  const el = $('hall');
  if (!hall) { el.hidden = true; return; }
  const list = hall[mapChoice + ':' + opts.diff] || [];
  el.hidden = false;
  $('hallTitle').textContent = `Hall of survivors · ${MAPS[mapChoice].name} · ${DIFFICULTY[opts.diff].name}`;
  $('hallList').innerHTML = '';
  if (!list.length) { const li = document.createElement('li'); li.textContent = 'Nobody has escaped yet.'; $('hallList').appendChild(li); return; }
  for (const r of list.slice(0, 5)) {
    const li = document.createElement('li'); li.textContent = r.names.join(', ');
    const t = document.createElement('span'); t.className = 't'; t.textContent = fmtTime(r.time) + (r.notes ? ` · ${r.notes} docs` : '');
    li.appendChild(t); $('hallList').appendChild(li);
  }
}
// short captions for sounds that matter, each kind at most every few seconds
const capT = {};
function caption(key, text, every = 6) {
  if (!opts.captions || !G) return;
  if (capT[key] && G.time - capT[key] < every) return;
  capT[key] = G.time;
  const el = document.createElement('div'); el.textContent = `[${text}]`;
  $('captions').appendChild(el); setTimeout(() => el.remove(), 3500);
  while ($('captions').children.length > 3) $('captions').firstChild.remove();
}
const nick = () => ($('nick').value.trim() || 'Survivor').slice(0, 16);

serverAvailable().then(ok => {
  app.mpOk = ok;
  if (ok) loadHall();
  $('hostBtn').disabled = !ok; $('joinBtn').disabled = !ok;
  $('mpNote').textContent = ok
    ? 'Co-op: host a game and give your friends the code, or enter a code you were given. Up to 4 players.'
    : 'Co-op needs the Bunker 115 server (npm start). Only single player is available here.';
});

$('soloBtn').addEventListener('click', () => {
  initAudio();
  const tr = new LocalTransport(mapChoice, nick(), opts.diff);
  tr.on('snap', s => onSnap(s));
  startGame(tr, mapChoice, tr.me);
  tr.start();
});
async function connect() {
  if (app.ws && app.ws.open) return app.ws;
  const ws = new WsTransport();
  ws.on('lobby', m => { app.lobby = m; app.lastCode = m.code; if (!G || G.tr !== ws) showLobby(); });
  ws.on('begin', m => { startGame(ws, m.map, m.you); });
  ws.on('snap', m => { if (G && G.tr === ws) onSnap(m.s); });
  ws.on('error', m => errNote(m.msg));
  ws.on('ended', () => { endGame(); showLobby(); });
  ws.on('close', () => { app.ws = null; reconnect(0); });
  await ws.connect(nick());
  app.ws = ws;
  return ws;
}
// The server keeps a dropped player's seat for 60 s; try to get back in quietly.
async function reconnect(attempt) {
  if (G && !G.tr.local) HUD.announce('Reconnecting…');
  try {
    const ws = await connect();
    if (!ws.rejoined && app.lastCode) ws.send({ t: 'join', code: app.lastCode });
  } catch (e) {
    if (attempt < 5) { setTimeout(() => reconnect(attempt + 1), 2000); return; }
    endGame(); screen('menu'); menuBackdrop(mapChoice);
    if (app.lastCode) $('joinCode').value = app.lastCode;
    errNote('Lost connection to the server. Press Join to get back into the game.');
  }
}
$('hostBtn').addEventListener('click', async () => {
  initAudio();
  try { const ws = await connect(); ws.send({ t: 'name', name: nick() }); ws.send({ t: 'create', map: mapChoice }); ws.send({ t: 'diff', diff: opts.diff }); }
  catch (e) { connectFailed(e); }
});
function connectFailed() {
  errNote('Could not connect to the server. It may be full or unreachable.');
  // a server password that changed since you logged in: go back to the login page
  fetch('/health', { cache: 'no-store' }).then(r => { if (r.status === 401) location.reload(); }).catch(() => {});
}
$('joinBtn').addEventListener('click', async () => {
  initAudio();
  const code = $('joinCode').value.trim().toUpperCase();
  if (code.length !== 4) { errNote('A game code has 4 characters.'); return; }
  try { const ws = await connect(); if (!ws.rejoined) { ws.send({ t: 'name', name: nick() }); ws.send({ t: 'join', code }); } }
  catch (e) { connectFailed(e); }
});
function showLobby() {
  const L = app.lobby; if (!L) return;
  screen('lobby');
  $('lobbyCode').textContent = L.code;
  const host = L.host === app.ws.me;
  mapCards($('lobbyMaps'), L.map, id => app.ws.send({ t: 'map', map: id }), !host);
  diffButtons($('lobbyDiffs'), L.diff || 'normal', id => app.ws.send({ t: 'diff', diff: id }), !host);
  const ul = $('lobbyPlayers'); ul.innerHTML = '';
  for (const p of L.players) {
    const li = document.createElement('li');
    const nm = document.createElement('span'); nm.textContent = p.name; li.appendChild(nm);
    const tag = document.createElement('span'); tag.className = 'tag';
    tag.textContent = [p.id === L.host ? 'host' : '', p.id === app.ws.me ? 'you' : '', p.connected ? '' : 'disconnected'].filter(Boolean).join(' · ');
    li.appendChild(tag); ul.appendChild(li);
  }
  $('startBtn').hidden = !host;
  $('lobbyNote').textContent = L.inGame ? 'A game is in progress. You will join it when the host starts again.'
    : host ? `Players: ${L.players.length}/4. Press Start when everyone is here.` : 'Waiting for the host to start.';
}
$('startBtn').addEventListener('click', () => app.ws && app.ws.send({ t: 'start' }));
$('leaveBtn').addEventListener('click', () => { if (app.ws) { app.ws.send({ t: 'leave' }); app.ws.close(); app.ws = null; } screen('menu'); });
$('resumeBtn').addEventListener('click', () => resume());
$('quitBtn').addEventListener('click', () => quitToMenu());
$('overMenuBtn').addEventListener('click', () => quitToMenu());
$('cpBtn').addEventListener('click', () => {
  if (!G) return;
  if (G.tr.local) G.tr.resume(); else if (app.ws) app.ws.send({ t: 'resume' });
});
$('againBtn').addEventListener('click', () => {
  if (!G) return;
  if (G.tr.local) { const tr = G.tr, map = G.mapId; tr.restart(); startGame(tr, map, tr.me); }
  else app.ws.send({ t: 'start' });
});
function quitToMenu() {
  if (!$('credits').hidden) closeCredits();
  if (G && !G.tr.local && app.ws) { app.ws.send({ t: 'leave' }); app.ws.close(); app.ws = null; }
  endGame(); screen('menu'); menuBackdrop(mapChoice);
}

/* ===================== pointer lock ===================== */
// Browsers only capture the mouse during a click or key press. Safari is strict about it, so a
// request made later (after loading, or when a co-op game begins) is refused; the game then waits
// behind a "Click to play" overlay, and that click captures the mouse.
// If even clicks are refused twice in a row (an embedded frame, a headless browser), give up and
// play with a free mouse, as the game did before.
let clickRefusals = 0, lockByClick = false;
function lockPointer(byClick) {
  if (app.noLock) return;
  lockByClick = !!byClick;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
}
function freeMouse() { app.noLock = true; $('game').classList.add('freemouse'); syncClickPlay(false); }
if (app.noLock) freeMouse();
document.addEventListener('pointerlockerror', () => {
  if (lockByClick && ++clickRefusals >= 2) freeMouse();
  lockByClick = false;
  if (app.screen === 'pause') resume(true);
});
const needClick = () => app.screen === 'play' && !!G && !app.noLock && document.pointerLockElement !== canvas && !G.reading && !G.journal;
function syncClickPlay(wait) {
  if ($('clickPlay').hidden === !wait) return;
  $('clickPlay').hidden = !wait;
  $('clickPlayBtn').textContent = G && !G.tr.local ? 'Click to take control' : 'Click to play';
  $('clickPlayNote').textContent = G && !G.tr.local ? 'The game goes on. Click to look and shoot again.' : 'The game waits until you click.';
}
$('clickPlay').addEventListener('click', () => { initAudio(); lockPointer(true); });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) { clickRefusals = 0; lockByClick = false; if (app.screen === 'pause') resume(true); }
  else if (app.screen === 'play' && !app.noLock && !(G && G.journal)) pause();
});
function pause() {
  if (app.screen !== 'play') return;
  closeReader(); closeJournal(); closeKeypad();
  mouseDown = rmb = false;
  screen('pause');
  const solo = G && G.tr.local;
  if (solo) G.tr.paused = true;
  $('pauseNote').textContent = solo ? 'The game is paused.' : 'The game goes on without you. Your character is standing still.';
  if (G && G.latest) $('pauseObj').textContent = `${G.map.name}. ${objectiveText(G.map, G.latest.W)}. Documents found: ${G.latest.W.notes.length}. ${nightLine(G.latest.W.night)}${G.latest.W.cp ? ` Checkpoint reached; returns left: ${2 - (G.latest.W.retries || 0)}.` : ''}`;
  if (document.pointerLockElement) document.exitPointerLock();
}
function resume(fromLock) {
  if (app.screen !== 'pause') return;
  if (!fromLock && !app.noLock) { lockPointer(true); return; }
  if (G && G.tr.local) G.tr.paused = false;
  screen('play');
}

/* ===================== input ===================== */
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (app.screen !== 'play' || !G) return;
  if (G.keypad) { keypadKey(e); return; }
  if (G.reading || G.journal) {
    if (!e.repeat && (e.code === 'KeyF' || e.code === 'Escape' || e.code === 'KeyJ' || e.code === 'Enter')) { if (G.journal && e.code !== 'KeyF') closeJournal(); else closeReader(); if (e.code === 'KeyJ' && !G.journal && G.readerWasJournal) openJournal(); }
    return;
  }
  if (e.code === 'KeyJ' && !e.repeat) { openJournal(); return; }
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyF') pressF = true;
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyV') knife();
  if (e.code === 'KeyG') throwGrenade();
  if (e.code === 'KeyL') { G.P.flashOn = !G.P.flashOn; SFX.flicker(); }
  if (e.code === 'Digit1') switchTo(0);
  if (e.code === 'Digit2') switchTo(1);
  if (e.code === 'KeyQ') switchTo(-1);
  if (e.code === 'KeyP' || (app.noLock && e.code === 'Escape')) pause();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = rmb = false; });
canvas.addEventListener('mousedown', e => {
  if (app.screen !== 'play') return;
  if (G && G.reading) { closeReader(); return; }
  if (!app.noLock && document.pointerLockElement !== canvas) { lockPointer(true); return; }
  if (e.button === 0) { mouseDown = true; firedThisPress = false; }
  if (e.button === 2) rmb = true;
});
addEventListener('mouseup', e => { if (e.button === 0) { mouseDown = false; firedThisPress = false; } if (e.button === 2) rmb = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (app.screen !== 'play' || !G) return;
  if (!app.noLock && document.pointerLockElement !== canvas) return;
  if (G.reading || G.journal) return;
  const P = G.P, s = .0022 * opts.sens * (P.ads > .5 ? .6 : 1);
  P.yaw -= e.movementX * s; P.pitch = clamp(P.pitch - e.movementY * s * (opts.invert ? -1 : 1), -1.5, 1.5);
  P.swayX = clamp(P.swayX + e.movementX * .00012, -.03, .03); P.swayY = clamp(P.swayY + e.movementY * .00012, -.03, .03);
});
addEventListener('wheel', () => { if (app.screen === 'play' && G) switchTo(-1); }, { passive: true });

/* ===================== game session ===================== */
function startGame(tr, mapId, meId) {
  if (!$('credits').hidden) closeCredits();
  endGame();
  $('loading').hidden = false;
  if (tr.local) tr.paused = true;
  // let the loading screen paint before the heavy scene build
  setTimeout(() => buildGame(tr, mapId, meId), 30);
}
function buildGame(tr, mapId, meId) {
  const map = MAPS[mapId];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(map.fog.color);
  scene.fog = new THREE.Fog(map.fog.color, map.fog.near, map.fog.far);
  const camera = new THREE.PerspectiveCamera(72, 1.33, .05, 120); camera.rotation.order = 'YXZ';
  const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(58, 1.33, .01, 5);
  pipe.cams.length = 0; pipe.cams.push(camera, vmCam); pipe.resize();
  const world = buildWorld(map);
  const view = buildWorldView(scene, world, TX, GMw);
  const fx = new FX(scene, TX);
  const ent = new Entities(scene, TX, fx, GMw, map.clothes, map.helmets);
  const flash = new THREE.SpotLight(0xfff0d0, 1.7, 20, .5, .55, 1.1); scene.add(flash, flash.target);
  const muzzleLight = new THREE.PointLight(0xffc070, 0, 9, 1.5); scene.add(muzzleLight);
  // the Matron's lantern; always in the scene so adding her never recompiles the shaders
  const lanternLight = new THREE.PointLight(0xffa850, 0, 8, 1.6); scene.add(lanternLight);
  // dust hanging in the flashlight beam: points kept inside the cone in front of the camera
  const DUST = 140, dustPos = new Float32Array(DUST * 3), dustGeo = new THREE.BufferGeometry();
  const seedDust = i => { const z = -R(.9, 4.5), a = R(0, 6.28), rr = Math.sqrt(Math.random()) * Math.abs(z) * .42; dustPos[i * 3] = Math.cos(a) * rr; dustPos[i * 3 + 1] = Math.sin(a) * rr; dustPos[i * 3 + 2] = z; };
  for (let i = 0; i < DUST; i++) seedDust(i);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: .009, color: 0xfff0d8, transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false; dust.userData = { pos: dustPos, seed: seedDust, n: DUST }; scene.add(dust);
  vmScene.add(new THREE.AmbientLight(0x4a4850, .7));
  const vmSun = new THREE.DirectionalLight(0xffe2b8, .6); vmSun.position.set(.4, 1, .6); vmScene.add(vmSun);
  const vmFlash = new THREE.PointLight(0xffc070, 0, 2, 1); vmScene.add(vmFlash);
  const vmRoot = new THREE.Group(); vmScene.add(vmRoot);
  const knifeVM = buildGun('knife', GMv); knifeVM.visible = false; vmScene.add(knifeVM);
  const grenVM = buildGun('grenade', GMv); grenVM.visible = false; vmScene.add(grenVM);
  const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.flash, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flashSprite.scale.set(.2, .2, 1); flashSprite.visible = false;
  const sp = map.playerSpawns[0];
  G = {
    tr, map, mapId, meId, scene, camera, vmScene, vmCam, world, view, fx, ent, flash, muzzleLight, lanternLight, dust, vmFlash, vmRoot, vmModels: {}, knifeVM, grenVM, flashSprite,
    snaps: [], latest: null, me: null, pending: [], seq: 0, deadIds: new Set(), time: 0, stateT: 0, overT: -1, denyT: 0,
    P: { x: sp.x, z: sp.z, y: 0, vy: 0, yaw: 0, pitch: 0, fireT: 0, reloadT: 0, reloadDur: 1, reloadSlot: -1, switchT: .35, knifeT: 0, throwT: 0, thrown: true,
      ads: 0, recoil: 0, bloom: 0, bob: 0, lastStep: 0, moving: 0, sprint: 0, stamina: 1, swayX: 0, swayY: 0, hurtFx: 0, tp: -1, flashOn: true, muzzleT: 0, heartT: 0, flick: 0 },
    puViews: new Map(), grenViews: new Map(), gasViews: [], fogFar: map.fog.far, groanT: new Map(), stepT: new Map(), trapZapT: 0, objI: -1,
    fear: new Fear(scene, world), reading: null, journal: false, introT: 4.5, tipQ: [], tipT: 0, breathT: 0, fpsT: 0, frames: 0, doorsSeen: 0, lowBatTip: false
  };
  try { pipe.renderer.compile(scene, camera); } catch (e) {}
  HUD.reset();
  $('fade').className = 'overlay'; $('captions').innerHTML = '';
  menuScene = null;
  $('loading').hidden = true;
  screen('play');
  lockPointer();
  // opening card; single player waits for it to fade
  const lines = INTRO[mapId] || [map.name, '', ''];
  const intro = $('intro');
  intro.querySelector('.l1').textContent = lines[0]; intro.querySelector('.l2').textContent = lines[1]; intro.querySelector('.l3').textContent = lines[2];
  // alone, the night is already decided; in co-op it arrives with the first snapshot
  intro.querySelector('.l4').textContent = tr.local ? nightLine(tr.sim.W.night) : '';
  intro.classList.add('on');
  SFX.intro();
  setTimeout(() => { intro.classList.remove('on'); if (G && G.tr === tr && tr.local && app.screen === 'play') tr.paused = false; }, 4200);
  tip('walk', 'Walk. Sprinting and gunfire carry far, and the dead hear everything.', 5);
  tip('light', 'L toggles the flashlight. It drains the battery and lets the dead see you from further away.', 14);
  tip('guide', 'Lost? Hold Tab to see which way to go.', 26);
}
// one-time hints, shown in order with a pause between them
function tip(key, text, delay = 0) {
  if (!opts.tips || hints.seen(key) || !G) return;
  hints.mark(key);
  G.tipQ.push({ text, at: G.time + delay });
}
function openReader(id) {
  const n = NOTES[id] || (G && G.latest && G.latest.W.clues && G.latest.W.clues[id]); if (!n || !G) return;
  G.reading = id;
  $('readerTitle').textContent = n.title; $('readerText').textContent = n.text;
  $('reader').hidden = false;
  SFX.page();
  if (G.tr.local) G.tr.paused = true;
  mouseDown = false;
}
function closeReader() {
  if (!G || !G.reading) return;
  G.reading = null; $('reader').hidden = true;
  if (G.tr.local && app.screen === 'play') G.tr.paused = false;
}
// The combination lock: type four digits, Enter tries them.
function openKeypad(id) {
  if (!G || G.keypad) return;
  G.keypad = id; G.keyIn = '';
  const pz = G.map.puzzles.find(q => q.id === id);
  $('keypadTitle').textContent = pz.stash.kind === 'safe' ? 'The safe' : 'The lock';
  keypadDraw(); keypadMessage('Type the numbers. Enter to try, Backspace to erase, F to step away.');
  $('keypad').hidden = false; mouseDown = false;
  SFX.page();
}
function closeKeypad() { if (!G || !G.keypad) return; G.keypad = null; $('keypad').hidden = true; }
function keypadDraw() { $('keypadDigits').textContent = (G.keyIn + '____').slice(0, 4).split('').join(' '); }
function keypadMessage(t) { $('keypadMsg').textContent = t; }
function keypadKey(e) {
  if (e.repeat) return;
  const d = e.key && /^[0-9]$/.test(e.key) ? e.key : /^(Digit|Numpad)[0-9]$/.test(e.code) ? e.code.slice(-1) : null;
  if (d !== null && G.keyIn.length < 4) { G.keyIn += d; SFX.dial(); keypadDraw(); }
  else if (e.code === 'Backspace') { G.keyIn = G.keyIn.slice(0, -1); keypadDraw(); }
  else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && G.keyIn.length === 4) { send({ t: 'code', id: G.keypad, code: G.keyIn }); G.keyIn = ''; keypadDraw(); }
  else if (e.code === 'KeyF' || e.code === 'Escape') closeKeypad();
}
function openJournal() {
  if (!G || !G.latest) return;
  G.journal = true; $('journal').hidden = false;
  const prefix = G.map.notePrefix;
  const ids = Object.keys(NOTES).filter(k => k[0] === prefix), found = G.latest.W.notes;
  const list = $('jlist'); list.innerHTML = '';
  const show = id => { $('jTitle').textContent = NOTES[id].title; $('jText').textContent = NOTES[id].text; [...list.children].forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id)); SFX.page(); };
  for (const id of ids) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.id = id;
    if (found.includes(id)) { b.textContent = NOTES[id].title; b.addEventListener('click', () => show(id)); }
    else { b.textContent = 'Not found yet'; b.className = 'missing'; b.disabled = true; }
    list.appendChild(b);
  }
  // scraps with combinations and the secret papers from the stashes
  const clues = G.latest.W.clues || {};
  const showClue = id => { $('jTitle').textContent = clues[id].title; $('jText').textContent = clues[id].text; [...list.children].forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id)); SFX.page(); };
  if (Object.keys(clues).length) {
    const h = document.createElement('p'); h.className = 'jsep'; h.textContent = 'Scraps and secrets'; list.appendChild(h);
    for (const id in clues) { const b = document.createElement('button'); b.type = 'button'; b.dataset.id = id; b.textContent = clues[id].title; b.addEventListener('click', () => showClue(id)); list.appendChild(b); }
  }
  const first = ids.find(id => found.includes(id));
  if (first) show(first); else { $('jTitle').textContent = 'Journal'; $('jText').textContent = 'You have not found any documents yet. They lie on desks, beds and tables.'; }
  if (G.tr.local) G.tr.paused = true;
  if (document.pointerLockElement) { G.journalUnlocked = true; document.exitPointerLock(); }
}
function closeJournal() {
  if (!G || !G.journal) return;
  G.journal = false; $('journal').hidden = true;
  if (G.tr.local) G.tr.paused = false;
  if (G.journalUnlocked) { G.journalUnlocked = false; lockPointer(); }
}
$('reader').addEventListener('click', () => closeReader());
$('journal').addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyJ') closeJournal(); });
function endGame() {
  $('fade').className = 'overlay';
  syncClickPlay(false);
  setRain(false);
  if (!G) return;
  if (G.tr.local) G.tr.paused = true;
  G = null;
  setTension(0, 0, 0, 0);
  HUD.show(false);
  if (document.pointerLockElement) document.exitPointerLock();
}
function send(msg) { msg.s = ++G.seq; G.tr.send(msg); return msg.s; }

// the charges in the blocked drift go off: the whole mine shakes, dust pours from the roof
function blast() {
  const g = (G.map.spots || []).find(q => q.id === 'charges') || { x: G.P.x, z: G.P.z };
  SFX.explode(g.x, g.z, 1.6); SFX.thunder();
  G.fx.explosion(new THREE.Vector3(g.x, 1.2, g.z), 3, 'fire');
  G.fx.flash = .5; G.shake = 2.8;
  for (let i = 0; i < 14; i++) setTimeout(() => { if (G) G.fx.emit(new THREE.Vector3(G.P.x + R(-5, 5), 2.6, G.P.z + R(-5, 5)), 18, COL.dust, .6, 2, 2.2); }, i * 140);
  HUD.announce('The mountain shudders', 'big');
  caption('blast', 'A huge blast; rock and dust pour down', 5);
}
// what tonight is like: said on the opening card, rubble where something came down, rain if it storms
// Under the objective: what to do and where to look. With Tab (and briefly after the objective
// changes) an arrow points at the place to go, with the distance.
function updateGuide(dt, W, P) {
  G.guideT = Math.max(0, (G.guideT || 0) - dt);
  if (keys.Tab && app.screen === 'play') G.guideT = Math.max(G.guideT, .5);
  G.guideUpd = (G.guideUpd || 0) - dt;
  if (G.guideUpd <= 0) {
    G.guideUpd = .4;
    G.guide = objectiveGuide(G.world, W, G.me || {});
    const g = G.guide;
    $('objHint').textContent = g ? (g.hint + (g.where.length ? ` Look in: ${g.where.join(', ')}.` : '')).trim() : '';
    $('objNeed').textContent = g ? g.need : '';
  }
  const g = G.guide, on = G.guideT > 0 && g && app.screen === 'play';
  $('guide').classList.toggle('on', !!on);
  if (!on) return;
  if (g.target) {
    const dx = g.target.x - P.x, dz = g.target.z - P.z, d = Math.hypot(dx, dz);
    const rel = angDiff(P.yaw, Math.atan2(-dx, -dz));
    $('guideArrow').style.visibility = 'visible';
    $('guideArrow').style.transform = `rotate(${-rel}rad)`;
    $('guideText').textContent = `${Math.round(d)} m · ${g.target.label || ''}`;
  } else {
    $('guideArrow').style.visibility = 'hidden';
    $('guideText').textContent = g.where.length ? `Somewhere in: ${g.where.join(', ')}` : g.hint;
  }
}
function applyNight(W) {
  const line = nightLine(W.night);
  if (line && !G.tr.local) {
    const intro = $('intro');
    if (intro.classList.contains('on')) intro.querySelector('.l4').textContent = line;
    else HUD.note(line);
  }
  if (W.collapse !== null && W.collapse !== undefined && G.map.collapses) {
    const c = G.map.collapses[W.collapse], zn = G.map.zones.find(z => z.rects.some(r => (c.x0 + c.x1) / 2 >= r[0] && (c.x0 + c.x1) / 2 <= r[2] && (c.z0 + c.z1) / 2 >= r[1] && (c.z0 + c.z1) / 2 <= r[3]));
    G.world.colliders.push({ minX: c.x0, maxX: c.x1, minZ: c.z0, maxZ: c.z1, off: false, tag: 'prop' });
    G.view.addRubble(c, zn && zn.ceil);
  }
  setRain((W.night || []).includes('storm'));
}
function onSnap(s) {
  if (!G) return;
  G.snaps.push({ at: performance.now(), s });
  if (G.snaps.length > 30) G.snaps.shift();
  G.latest = s;
  G.me = s.p.find(p => p.id === G.meId) || null;
  if (!G.nightApplied) { G.nightApplied = true; applyNight(s.W); }
  if (G.me) {
    G.pending = G.pending.filter(a => a.s > G.me.ack);
    if (G.me.tp !== G.P.tp) { G.P.tp = G.me.tp; G.P.x = G.me.x; G.P.z = G.me.z; G.P.y = 0; G.P.vy = 0; }
  }
  for (const id in G.world.doors) setDoorOpen(G.world, id, !!s.W.doors[id]);
  for (const e of s.ev) onEvent(e);
}

// Your weapons as the server last reported them, with not-yet-confirmed shots/reloads/switches applied.
function myWeapons() {
  const me = G.me; if (!me) return { w: [], cur: 0 };
  const w = me.w.map(x => Object.assign({}, x)); let cur = me.cur;
  for (const a of G.pending) {
    const x = w[a.slot]; if (!x) continue;
    if (a.k === 'shot') x.mag = Math.max(0, x.mag - 1);
    else if (a.k === 'reload') { const d = wdef(x.id), take = Math.min(d.shell ? 1 : capacity(d, x.mag) - x.mag, x.res); if (take > 0) { x.mag += take; x.res -= take; } }
    else if (a.k === 'switch') cur = a.slot;
  }
  return { w, cur: clamp(cur, 0, Math.max(0, w.length - 1)) };
}
function playerName(id) { const p = G.latest && G.latest.p.find(p => p.id === id); return p ? p.name : 'Someone'; }
function zombiePos(id) { const c = G.ent.zombieView(id); return c ? c.group.position : null; }
const ITEM_LABEL = { fuse: 'a fuse', battery: 'a battery', medkit: 'a first aid kit', ammo: 'ammunition', grenade: 'a grenade', dynamite: 'dynamite', detonator: 'the blasting machine', handwheel: 'a valve handwheel' };

/* ===================== events from the simulation ===================== */
function onEvent(e) {
  const me = G.meId, W = G.latest.W;
  switch (e.e) {
    case 'shot': if (e.p !== me) {
      const pl = G.latest.p.find(p => p.id === e.p); if (!pl) break;
      SFX.shot(wdef(e.w).snd, pl.x, pl.z);
      const mz = G.ent.playerMuzzle(e.p);
      if (mz) G.fx.sprite(TX.flash, mz, .35, .06, { additive: true });
    } break;
    case 'kill':
      G.deadIds.add(e.z);
      if (e.type !== 'dog' && e.y < .5) G.view.addDecal(new THREE.Vector3(e.x, .03, e.zz), new THREE.Vector3(0, 1, 0), 1.1);
      if (e.by === me) HUD.hit(true);
      if (e.head) SFX.splat(e.x, e.zz);
      if (e.type === 'dog') SFX.explode(e.x, e.zz, .4);
      G.ent.kill(e);
      break;
    case 'pts': if (e.p === me) HUD.pop(e.n, e.n >= 50); break;
    case 'board': {
      const w = G.world.winById[e.win]; if (!w) break;
      if (e.torn) { caption('board', 'Wood splintering at a window', 5); SFX.boardBreak(w.x, w.z); const pl = G.view.planks[e.win][e.n]; if (pl) G.fx.emit(pl.position, 10, COL.wood, 2.2, 9, .7); tip('boards', 'Hold F at a window to board it up again.'); }
      else SFX.boardPlace(w.x, w.z);
      break;
    }
    case 'door': { const d = G.world.doors[e.id]; if (!d) break; SFX.door(d.x, d.z); G.fear.rebuildNav(); if (e.p) HUD.note(`${e.p === me ? 'You' : playerName(e.p)} opened: ${d.label}`); break; }
    case 'buy': if (e.p === me) SFX.buy(); break;
    case 'deny': if (e.p === me) { SFX.deny(); G.denyT = 1.2; } break;
    case 'give': if (e.p === me) { G.P.switchT = .35; G.P.reloadT = 0; } break;
    case 'pickup': {
      if (e.kind === 'clue' || e.kind === 'secret') {
        if (e.p === me) { setTimeout(() => openReader(e.clue), 60); tip('scraps', 'Scraps of paper and secret documents go into your journal too (J). Some of them open things.', 1); }
        else HUD.note(`${playerName(e.p)} found ${e.kind === 'secret' ? 'a sealed document' : 'a scrap of paper'} (J to read)`);
        break;
      }
      if (e.kind === 'note') {
        if (e.p === me) { openReader(e.note); tip('journal', 'Documents go into your journal. Press J to read them again.', 1); }
        else HUD.note(`${playerName(e.p)} found a document (J to read)`);
        break;
      }
      if (e.p === me) SFX.pickup();
      const who = e.p === me ? 'You' : playerName(e.p);
      const what = e.kind === 'weapon' ? `the ${WEAPONS[e.w].name}` : e.kind === 'key' ? `the ${KEY_NAMES[e.key] || 'key'}` : ITEM_LABEL[e.kind];
      if (e.kind === 'fuse') HUD.note(`${who} found a fuse (${W.fuses}/3)`);
      else if (e.kind === 'dynamite') HUD.note(`${who} found dynamite (${W.got.dynamite || 0}/3)`);
      else if (e.p === me || e.kind === 'key' || e.kind === 'handwheel') HUD.note(`${who} picked up ${what}`);
      break;
    }
    case 'objective': SFX.objective(); if (G.latest && G.map.objectives[e.i] && G.map.objectives[e.i].id === 'fuses') tip('fuses', 'The fuses could be anywhere. Search every room, and listen before you open a door.', 8); break;
    case 'power': SFX.power(); HUD.announce('The lights are back on', 'big'); G.fx.flash = .15; break;
    case 'useSpot':
      if (e.spot === 'charges') { SFX.boardPlace(); HUD.announce('The charges are set. Get well clear.'); }
      else if (e.spot === 'plunger') blast();
      else if (e.spot === 'tankA' || e.spot === 'tankB' || e.spot === 'tankC') {
        const sp = G.map.spots.find(q => q.id === e.spot); SFX.mechanism(sp.x, sp.z, 'valve'); SFX.steam(sp.x, sp.z);
        const left = G.map.objectives.slice(W.obj.i).filter(o => /^tank/.test(o.spot || '')).length;
        HUD.announce(left ? `The serum drains away. ${left === 1 ? 'One tank' : 'Two tanks'} left.` : 'The last of the serum drains away.');
        caption('drain', 'Liquid gushing onto the floor', 3);
      }
      else if (e.spot === 'sluice') { flush(); G.shake = 1.2; HUD.announce('The sluice gives. Clean water roars into the works.', 'big'); caption('sluice', 'Water roaring through the pipes', 5); }
      else HUD.announce('The engine coughs and dies. Keep trying.');
      break;
    case 'radio': SFX.radioUse(); HUD.announce('"Hold on. We are coming for you."'); break;
    case 'rescue': SFX.rescue(); HUD.announce(G.map.rescue || 'RUN.', 'big red'); break;
    case 'escaped': if (e.p === me) { SFX.escape(); HUD.announce('You made it out', 'big'); } else HUD.note(`${playerName(e.p)} escaped`); break;
    case 'trap': if (e.on) HUD.note('The electric trap is live'); break;
    case 'stalker': matronArrives(); HUD.note('Something heavy is walking in the dark'); SFX.groan(e.x ?? G.map.stalker.x, e.zz ?? G.map.stalker.z, 'stalker');
      if (W.obj.i >= (G.map.stalker.mortal ?? 1e9)) HUD.announce('She is here. Put her down for good.', 'big red');
      else tip('matron', 'You cannot kill the Matron. Shoot to knock her down, then run or hide.', 2);
      break;
    case 'mortal': HUD.announce('The serum is gone. Tonight she can die.', 'big red'); SFX.sting(); break;
    case 'matronDies': {
      matronDies(); G.fx.flash = .2; G.shake = 1;
      HUD.announce('The Matron is dead', 'big');
      caption('matronDies', 'A long, rattling breath, and then nothing', 3);
      if (e.by === me) award('lastrounds');
      break;
    }
    case 'spotted': SFX.stalkerSpotted(); G.fx.flash = .05; break;
    case 'stun': case 'wake': {
      const p = zombiePos(e.z); if (p) SFX.wake(p.x, p.z);
      if (e.e === 'stun') {
        caption('stun', 'The Matron collapses', 3); if (e.by === me && G.me && G.me.stuns + 1 >= 5) award('floor');
        if (e.downs) HUD.announce(e.downs === 1 ? 'She falls. She is weaker when she gets up.' : 'She falls again. Once more.', e.downs === 2 ? 'big red' : '');
      }
      else caption('wake', 'Bones cracking', 3);
      break;
    }
    case 'scare': SFX.scare(e.kind, e.x, e.z); caption('scare' + e.kind, { whisper: 'Whispering', scream: 'A distant scream', slam: 'A door slams somewhere', steps: 'Footsteps', lights: 'The lights die' }[e.kind], 2); break;
    case 'hide': case 'unhide': {
      const h = (G.map.hides || []).find(q => q.id === e.hide); G.view.openLocker(e.hide, .6); if (h) SFX.locker(h.x, h.z); if (e.forced && e.p === me) G.P.hurtFx = 1;
      if (e.e === 'hide' && e.p === me) {
        HUD.note(e.seen ? 'It saw you climb in. It will come for the locker.' : 'Nothing saw you. Keep still and they will lose you.');
        tip('hiding', 'Hiding only works if nothing watches you get in. The dead search where they last saw you, then wander off. The Matron checks lockers.', .5);
      }
      break;
    }
    case 'hideOpen': {
      const h = (G.map.hides || []).find(q => q.id === e.hide); G.view.openLocker(e.hide, 1.2); if (h) SFX.lockerBang(h.x, h.z); if (e.found) SFX.sting();
      caption('locker', 'A locker is torn open', 2);
      const mine = G.me && G.me.hid && (G.map.hides || []).find(q => q.id === G.me.hid);
      const z = G.ent.zombieView(e.z);
      if (mine && h && !e.found && z && z.type === 'stalker' && Math.hypot(mine.x - h.x, mine.z - h.z) < 3.5) award('breath');
      break;
    }
    case 'searching': HUD.note('You hear cupboard doors being opened'); caption('search', 'Cupboard doors opening', 4); break;
    case 'down':
      SFX.down();
      if (e.p === me) HUD.announce('You are down', 'big red');
      else HUD.announce(`${playerName(e.p)} is down. Help them!`, 'red');
      break;
    case 'revive': SFX.revive(); if (e.p !== me) HUD.note(`${playerName(e.p)} is back on their feet`); break;
    case 'dead': if (e.p !== me) HUD.note(`${playerName(e.p)} is dead`); break;
    case 'respawn': if (e.p === me) { G.P.switchT = .35; HUD.announce('You crawl back out of the dark', 'red'); } else HUD.note(`${playerName(e.p)} is back`); break;
    case 'hurt': if (e.p === me) { SFX.hurt(); G.P.hurtFx = 1; } break;
    case 'zatk': { const p = zombiePos(e.z); if (p) SFX.attack(p.x, p.z); break; }
    case 'scream': { const p = zombiePos(e.z); if (p) SFX.scream(p.x, p.z); caption('shriek', 'A shriek', 3); break; }
    case 'codeWrong': { const pz = G.map.puzzles.find(q => q.id === e.id); SFX.rattle(pz.stash.x, pz.stash.z); caption('rattle', 'A handle rattles', 3); if (e.p === me && G.keypad) keypadMessage('Wrong. The handle will not turn.'); break; }
    case 'switch': { const pz = G.map.puzzles.find(q => q.id === e.id), sw = pz.switches[e.i]; SFX.mechanism(sw.x, sw.z, sw.model); break; }
    case 'switchWrong': {
      const pz = G.map.puzzles.find(q => q.id === e.id), sw = pz.switches[e.i];
      if (sw.model === 'valve') { SFX.steam(sw.x, sw.z); caption('steam', 'Steam screaming from the pipes', 4); } else { SFX.thud(sw.x, sw.z); caption('books', 'Books crashing to the floor', 4); }
      if (e.p === me) HUD.note(sw.model === 'valve' ? 'Wrong order. The pressure drops back.' : 'Wrong book. Everything slides back into place.');
      break;
    }
    case 'unlock': {
      const pz = G.map.puzzles.find(q => q.id === e.id);
      SFX.unlock(pz.stash.x, pz.stash.z); caption('unlock', 'Something heavy unlocks', 4);
      if (G.keypad === e.id) closeKeypad();
      HUD.note({ safe: 'The safe swings open', cabinet: 'The tool cabinet clanks open', footlocker: 'The locker lid springs up', shelf: 'The bookcase slides aside' }[pz.stash.kind] || 'It opens');
      if (e.p === me && pz.type === 'code') award('safecracker');
      if (G.map.puzzles.every(q => q.id === e.id || (W.puzzles[q.id] && W.puzzles[q.id].open))) award('hidden');
      break;
    }
    case 'checkpoint': HUD.note('You catch your breath. (Checkpoint)'); break;
    case 'resumed':
      G.overT = -1; $('fade').className = 'overlay'; screen('play'); lockPointer(true);
      HUD.announce('You come to, back where you last caught your breath');
      break;
    case 'thunder': SFX.thunder(); G.fx.flash = .35; caption('thunder', 'Thunder', 5); break;
    case 'generator': SFX.generator(); caption('generator', 'The generator coughs and dies', 3); break;
    case 'howl': { const p = zombiePos(e.z); if (p) SFX.howl(p.x, p.z); caption('howl', 'A howl that carries through the walls', 3); break; }
    case 'shriek': { const p = zombiePos(e.z); if (p) SFX.shriek(p.x, p.z); caption('wshriek', 'A shriek, close', 3); if (e.p === me) { G.fx.flash = .08; G.P.hurtFx = Math.max(G.P.hurtFx, .4); } break; }
    case 'charge': { const p = zombiePos(e.z); if (p) SFX.charge(p.x, p.z); caption('charge', 'Something heavy running at you', 3); break; }
    case 'thud': SFX.thud(e.x, e.zz); G.fx.emit(new THREE.Vector3(e.x, 1.2, e.zz), 22, COL.dust, 2.5, 6, 1); if (Math.hypot(e.x - G.P.x, e.zz - G.P.z) < 9) G.P.hurtFx = Math.max(G.P.hurtFx, .3); break;
    case 'slam': if (e.p === me) { SFX.slam(); G.P.hurtFx = 1.5; G.P.pitch += .25; } break;
    case 'grab': if (e.p === me) { SFX.grab(); caption('grab', 'Hands grabbing at you', 2); tip('shove', 'Press V to shove it off you. It also stops a blow that is coming.'); } break;
    case 'shove': { const p = zombiePos(e.z); if (p) SFX.shove(p.x, p.z); if (e.p === me) G.shake = Math.max(G.shake || 0, .12); break; }
    case 'backstab': { const p = zombiePos(e.z); if (p) SFX.stab(p.x, p.z); if (e.p === me) { HUD.hit(true); G.P.knifeStyle = 'stab'; } break; }
    case 'breakfree': if (e.p === me) { HUD.note('You tear yourself free'); } break;
    case 'trip': { const p = zombiePos(e.z); if (p) SFX.trip(p.x, p.z); break; }
    case 'vanish': SFX.vanish(e.x, e.zz); G.fx.emit(new THREE.Vector3(e.x, 1, e.zz), 26, COL.dust, 1.5, 3, 1.4); break;
    case 'rise': SFX.rise(e.x, e.z); G.fx.emit(new THREE.Vector3(e.x, .1, e.z), 30, COL.dirt, 2.5, 8, 1.2); break;
    case 'lightning': G.fx.lightning(e.x, e.z); SFX.lightning(e.x, e.z); break;
    case 'explode': {
      const p = new THREE.Vector3(e.x, e.y, e.z);
      if (e.kind === 'gas') { G.fx.explosion(p, e.r, 'gas'); SFX.gas(e.x, e.z); }
      else { G.fx.explosion(p, e.r, 'fire'); SFX.explode(e.x, e.z, 1); }
      break;
    }
    case 'pu':
      SFX.powerup();
      if (e.kind === 'nuke') { SFX.nuke(); G.fx.flash = .9; }
      HUD.announce({ ammo: 'Max ammo', insta: 'Insta-kill', double: 'Double points', nuke: 'Nuke', carpenter: 'Carpenter' }[e.kind]);
      break;
    case 'throw': if (e.p === me) SFX.throwG(); break;
    case 'knife': if (e.p !== me) SFX.knife(); break;
    case 'join': if (e.p !== me) HUD.note(`${e.name} joined`); break;
    case 'leave': HUD.note(`${e.name} left`); break;
    case 'over': G.overT = e.result === 'escaped' ? 3 : 2.6; if (e.result !== 'escaped') SFX.gameOver(); $('fade').className = 'overlay on' + (e.result === 'escaped' ? '' : ' red'); break;
  }
}

/* ===================== actions ===================== */
function startReload() {
  if (!G || !G.me) return;
  const { w, cur } = myWeapons(), x = w[cur], P = G.P;
  if (!x || P.reloadT > 0 || P.switchT > 0 || G.me.st === 'x' || G.me.st === 'e') return;
  const d = wdef(x.id);
  if (x.mag >= (d.shell ? d.mag : capacity(d, x.mag)) || x.res <= 0) return;
  // a shell at a time; a tactical swap is quicker than one from empty
  P.reloadDur = P.reloadT = d.shell ? d.shell : d.reload * (x.mag > 0 ? .8 : 1.1);
  P.reloadSlot = cur;
  SFX.reload(P.reloadDur);
}
function switchTo(i) {
  if (!G || !G.me) return;
  const { w, cur } = myWeapons();
  if (w.length < 2) return;
  const n = i < 0 ? (cur + 1) % w.length : i;
  if (n === cur || !w[n]) return;
  const s = send({ t: 'switch', slot: n });
  G.pending.push({ s, k: 'switch', slot: n });
  G.P.switchT = .35; G.P.reloadT = 0;
}
// V: shove and slash. Costs breath; you can't do it again straight away.
function knife() {
  const P = G.P;
  if (!G.me || G.me.st !== 'a' || P.knifeT > 0 || P.switchT > 0 || (P.meleeCd || 0) > 0) return;
  if (P.stamina < .1) { SFX.heldBreath && SFX.heldBreath(); return; }
  P.stamina = Math.max(-.25, P.stamina - .25);
  P.knifeT = .45; P.meleeCd = .65; P.reloadT = 0; P.knifeSide = -(P.knifeSide || 1); P.knifeStyle = 'slash';
  SFX.knife();
  send({ t: 'knife' });
}
function throwGrenade() {
  const P = G.P;
  if (!G.me || G.me.st !== 'a' || G.me.g <= 0 || P.throwT > 0 || P.knifeT > 0) return;
  P.throwT = .6; P.thrown = false; P.reloadT = 0;
}
const fwdV = new THREE.Vector3(), ray = new THREE.Raycaster();
ray.far = 90;
function camForward(out) { return out.set(0, 0, -1).applyQuaternion(G.camera.quaternion); }
function tryFire() {
  const P = G.P, me = G.me;
  if (!me || (me.st !== 'a' && me.st !== 'd')) return false;
  const { w, cur } = myWeapons(), x = w[cur];
  if (x && P.reloadT > 0 && wdef(x.id).shell && x.mag > 0) P.reloadT = 0;   // fire mid-reload with what is loaded
  if (!x || P.reloadT > 0 || P.switchT > 0 || P.knifeT > 0 || P.throwT > 0 || P.fireT > 0) return false;
  if (P.sprint > .5) return false;
  const d = wdef(x.id);
  if (x.mag <= 0) { SFX.empty(); P.fireT = .25; startReload(); return false; }
  P.fireT = d.rate;
  const cam = G.camera;
  G.scene.updateMatrixWorld();
  const targets = G.view.solids.concat(G.ent.hitTargets());
  const spread = (d.spread * (P.ads > .5 ? .3 : 1) + P.bloom) * (P.moving ? 1.5 : 1);
  const hits = new Map();
  let end = null, anyHit = false;
  let headHit = false;
  for (let i = 0; i < (d.pellets || 1); i++) {
    camForward(fwdV);
    fwdV.x += R(-1, 1) * spread; fwdV.y += R(-1, 1) * spread; fwdV.z += R(-1, 1) * spread; fwdV.normalize();
    ray.set(cam.position, fwdV);
    // follow the round through bodies (rifles and the MG go through) until it meets a wall
    const list = ray.intersectObjects(targets, false), seen = new Set();
    let through = 0, stop = null;
    for (const h of list) {
      const zid = h.object.userData.zid;
      if (zid === undefined) { stop = h; break; }
      if (h.object.userData.dead || seen.has(zid)) continue;
      seen.add(zid);
      const part = h.object.userData.part, k = zid + ':' + part + ':' + through, e = hits.get(k);
      if (e) e[2]++; else hits.set(k, [zid, part, 1, through]);
      G.ent.hit(zid, part, h.point, fwdV); anyHit = true;
      if (part === 0) headHit = true;
      if (i === 0 || Math.random() < .3) { if (part === 0) SFX.headshot(h.point.x, h.point.z); else SFX.flesh(h.point.x, h.point.z); }
      if (!stop && i === 0 && through === 0) end = h.point.clone();
      // spray onto whatever is right behind
      ray.set(h.point, fwdV); ray.far = 2.6;
      const wall = ray.intersectObjects(G.view.solids, false)[0];
      ray.far = 90; ray.set(cam.position, fwdV);
      if (wall && wall.face && Math.random() < .6) G.view.addDecal(wall.point, wall.face.normal.clone().transformDirection(wall.object.matrixWorld), .55);
      if (++through > (d.pierce || 0)) break;
    }
    if (i === 0 && !end) end = stop ? stop.point.clone() : cam.position.clone().addScaledVector(fwdV, 60);
    if (stop && through <= (d.pierce || 0)) {
      // the wall: dust, a few sparks, and now and then the whine of a ricochet
      const at = stop.point.clone().addScaledVector(fwdV, -.05);
      G.fx.emit(at, 5, COL.dust, 1.2, 6, .4);
      if (Math.random() < .5) G.fx.emit(at, 2, COL.spark, 2.5, 9, .2);
      if (i === 0 && Math.random() < .15) SFX.ricochet(at.x, at.z);
    }
  }
  if (!end) end = cam.position.clone().addScaledVector(camForward(fwdV), 60);
  const s = send({ t: 'shot', slot: cur, hits: [...hits.values()], end: [end.x, end.y, end.z] });
  G.pending.push({ s, k: 'shot', slot: cur });
  if (anyHit) { HUD.hit(headHit ? 'head' : false); SFX.hit(false); }
  P.bloom = Math.min(P.bloom + d.spread * .45, d.spread * 2.5);
  P.recoil = Math.min(P.recoil + d.kick, 2);
  // each gun kicks its own way; most of the climb comes back down when you let go
  const rc = d.recoil || { up: d.kick, side: .3, drift: 0 }, aimK = P.ads > .5 ? .6 : 1;
  const up = rc.up * .016 * aimK;
  P.lastShotT = G.time;
  P.pitch = clamp(P.pitch + up, -1.5, 1.5);
  P.yaw += (rc.drift + R(-1, 1) * rc.side) * .006 * aimK;
  P.kickBack = Math.min(.35, (P.kickBack || 0) + up * .7);
  if (d.cls === 'shotgun') G.shake = Math.max(G.shake || 0, .22);
  P.muzzleT = .05;
  if (d.cls !== 'shotgun') {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    G.fx.emit(cam.position.clone().addScaledVector(camForward(fwdV), .5).addScaledVector(right, .2).add(new THREE.Vector3(0, -.12, 0)), 1, [.75, .6, .25], 1.6, 9, .7);
  }
  SFX.shot(d.snd);
  if (x.mag - 1 <= 0 && x.res > 0) setTimeout(() => { if (G) startReload(); }, d.rate * 1000);
  return true;
}

/* ===================== interpolation ===================== */
function interp() {
  const sn = G.snaps; if (!sn.length) return null;
  const rt = performance.now() - (G.tr.local ? 55 : 110);
  let a = sn[0], b = sn[sn.length - 1];
  for (let i = sn.length - 1; i > 0; i--) if (sn[i - 1].at <= rt) { a = sn[i - 1]; b = sn[i]; break; }
  const span = b.at - a.at, t = span > 0 ? clamp((rt - a.at) / span, 0, 1) : 1;
  const am = new Map(a.s.z.map(z => [z[0], z]));
  const zs = [];
  for (const z of b.s.z) {
    if (G.deadIds.has(z[0])) continue;
    const o = am.get(z[0]) || z;
    zs.push({ id: z[0], type: ZTYPES[z[1]], x: lerp(o[2], z[2], t) / 100, z: lerp(o[3], z[3], t) / 100, y: lerp(o[4], z[4], t) / 100,
      rot: o[5] / 100 + angDiff(o[5] / 100, z[5] / 100) * t, state: ZSTATES[z[6]], lost: z[7], flags: z[8], win: z[9] });
  }
  const pm = new Map(a.s.p.map(p => [p.id, p]));
  const ps = b.s.p.map(p => { const o = pm.get(p.id) || p; return Object.assign({}, p, { x: lerp(o.x, p.x, t), z: lerp(o.z, p.z, t), y: lerp(o.y, p.y, t), yaw: o.yaw + angDiff(o.yaw, p.yaw) * t, pitch: lerp(o.pitch, p.pitch, t) }); });
  return { zs, ps };
}
function surfaceAt(x, z) {
  const zn = G.map.zones.find(q => q.id === zoneAt(G.map, x, z));
  return zn ? zn.floor : 'ground';
}

/* ===================== per-frame update ===================== */
const hipPos = new THREE.Vector3(.17, -.17, -.32), adsPos = new THREE.Vector3(0, -.105, -.27);
function updateGame(dt) {
  G.time += dt;
  const wait = needClick();
  syncClickPlay(wait);
  G.tr.tick(wait && G.tr.local && G.latest ? 0 : dt);
  const P = G.P, me = G.me, cam = G.camera;
  if (!G.latest || !me) { pipe.render(G.scene, cam); return; }
  const W = G.latest.W, st = me.st, active = app.screen === 'play' && !G.reading && !G.journal;
  const hidden = !!me.hid, hideSpot = hidden && (G.map.hides || []).find(h => h.id === me.hid);
  const playing = st === 'a' || st === 'd';
  const { w: weps, cur } = myWeapons(), wcur = weps[cur];
  G.introT -= dt;
  // ---- gamepad ----
  const pad = active ? pollPad() : null;
  if (pad) {
    P.yaw -= pad.lx * dt * 2.8 * opts.sens; P.pitch = clamp(P.pitch - pad.ly * dt * 2.1 * opts.sens * (opts.invert ? -1 : 1), -1.5, 1.5);
    if (pad.use) pressF = true;
    if (pad.knife) knife();
    if (pad.grenade) throwGrenade();
    if (pad.swap) switchTo(-1);
    if (pad.light) { P.flashOn = !P.flashOn; SFX.flicker(); }
    if (pad.journal) openJournal();
    if (pad.guide) G.guideT = Math.max(G.guideT || 0, .5);
    if (pad.pause) pause();
    if (pad.fire && !G.padFire) firedThisPress = false;
    G.padFire = pad.fire;
  }
  const firing = mouseDown || !!(pad && pad.fire), aiming = rmb || !!(pad && pad.aim), holdF = !!keys.KeyF || !!(pad && pad.hold);
  // ---- movement (your own position is predicted locally) ----
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  let mf = active ? (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) : 0, ms = active ? (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) : 0;
  if (pad && !mf && !ms) { mf = -pad.my; ms = pad.mx; }
  if (hidden) mf = ms = 0;
  const mx = fx * mf + rx * ms, mz = fz * mf + rz * ms;
  const ml = Math.hypot(mx, mz), mAmt = Math.min(1, ml);
  P.moving = ml > .05 && playing ? 1 : 0;
  const wantSprint = active && (keys.ShiftLeft || keys.ShiftRight || (pad && pad.sprint)) && mf > .3 && P.ads < .5 && P.reloadT <= 0 && st === 'a' && P.stamina > 0;
  P.stamina = clamp(P.stamina + (wantSprint ? -dt / 4 : dt / 3), -.25, 1);
  P.sprint = lerp(P.sprint, wantSprint ? 1 : 0, Math.min(1, dt * 10));
  // shut in a locker you don't walk anywhere
  if (ml > .05 && playing && !hidden) {
    const base = (st === 'd' ? .55 : wantSprint ? 6.4 : 4.0) * (me && me.gr ? .35 : 1);   // held by a grab
    const sp = base * mAmt * (P.ads > .5 && st === 'a' ? .6 : 1);
    P.x += mx / ml * sp * dt; P.z += mz / ml * sp * dt;
    P.bob += dt * (wantSprint ? 13 : 9) * mAmt;
  }
  if (playing && !hidden) {
    collide(P, .3, G.world.colliders);
    for (const c of G.ent.z.values()) {
      if (c.lastState === 'dormant' || c.lastState === 'ceiling') continue;
      const gp = c.group.position, dx = P.x - gp.x, dz = P.z - gp.z, d = Math.hypot(dx, dz);
      if (d < .55 && d > 1e-3 && gp.y > -.5) { P.x += dx / d * (.55 - d) * .5; P.z += dz / d * (.55 - d) * .5; }
    }
  }
  if (active && (keys.Space || (pad && pad.jump)) && P.y <= 0 && st === 'a' && !hidden) P.vy = 4.6;
  P.vy -= 13 * dt; P.y += P.vy * dt; if (P.y < 0) { P.y = 0; P.vy = 0; }
  // footsteps follow the head bob
  if (P.moving && st === 'a' && P.y <= 0) {
    const step = Math.floor(P.bob / Math.PI);
    if (step !== P.lastStep) { P.lastStep = step; SFX.step(surfaceAt(P.x, P.z)); }
  }
  // ---- camera ----
  const iv = interp();
  if (!playing) {
    const mate = iv && iv.ps.find(p => p.id !== G.meId && p.st === 'a');
    G.deathT = (G.deathT || 0) + dt;
    if (st === 'x' && G.deathT < 4) {
      // you fall where you stood before the view goes anywhere else
      const k = Math.min(1, G.deathT * 1.4);
      cam.position.set(P.x, lerp(1.62, .3, k * k), P.z);
      cam.rotation.set(P.pitch * (1 - k) + .25 * k, P.yaw, .9 * k);
    } else if (mate) { cam.position.set(mate.x, 1.62 + mate.y, mate.z); cam.rotation.set(mate.pitch, mate.yaw, 0); }
    else { cam.position.set(P.x, 2.5, P.z); cam.rotation.set(-.4, P.yaw + G.time * .08, 0); }
  } else if (hideSpot) {
    G.deathT = 0;
    // peeking out through the locker slats, the view can only turn a little
    const base = Math.atan2(-hideSpot.nx, -hideSpot.nz);
    if (!G.wasHidden) { P.yaw = base; P.pitch = 0; }
    P.yaw = base + clamp(angDiff(base, P.yaw), -.6, .6); P.pitch = clamp(P.pitch, -.35, .35);
    cam.position.set(hideSpot.x + hideSpot.nx * .12, 1.58 + Math.sin(G.time * 1.3) * .006, hideSpot.z + hideSpot.nz * .12);
    cam.rotation.set(P.pitch, P.yaw, 0);
  } else {
    G.deathT = 0;
    const bobY = P.moving && st === 'a' ? Math.abs(Math.sin(P.bob)) * .045 : 0;
    const eye = st === 'd' ? .5 : 1.62;
    cam.position.set(P.x, eye + P.y + bobY, P.z);
    cam.rotation.set(P.pitch, P.yaw, st === 'd' ? .25 : 0);
  }
  // a winded or wounded body can't hold the aim still
  if (G.me && G.me.st === 'a' && !hidden) {
    const winded = clamp(1 - P.stamina, 0, 1), hurt = clamp(1 - G.me.hp / G.me.mhp - .3, 0, 1), sw = .0025 * (winded * winded * 2 + hurt * 2.5);
    if (sw > 0) { cam.rotation.x += Math.sin(G.time * 1.3) * sw; cam.rotation.y += Math.sin(G.time * .85 + 1) * sw * .8; }
  }
  // the ground shakes (a blast, a brute hitting a wall)
  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt);
    const k = Math.min(1, G.shake) * .05;
    cam.position.x += R(-1, 1) * k; cam.position.y += R(-1, 1) * k; cam.position.z += R(-1, 1) * k; cam.rotation.z += R(-1, 1) * k * .6;
  }
  if (hidden !== G.wasHidden) G.view.insideLocker(hidden ? me.hid : null);
  G.wasHidden = hidden;
  cam.fov = lerp(opts.fov, opts.fov - ((wcur && wdef(wcur.id).zoom) || 16), P.ads); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  setListener(cam.position.x, cam.position.z, cam.rotation.y);
  // ---- weapon timers ----
  P.fireT = Math.max(0, P.fireT - dt); P.switchT = Math.max(0, P.switchT - dt);
  P.bloom = Math.max(0, P.bloom - dt * .08);
  P.recoil = Math.max(0, P.recoil - dt * 8 * Math.max(P.recoil, .3));
  P.meleeCd = Math.max(0, (P.meleeCd || 0) - dt);
  if (G.time - (P.lastShotT || 0) > .15 && P.kickBack > 0) { const back = Math.min(P.kickBack, dt * (1.2 + P.kickBack * 8)); P.pitch -= back; P.kickBack -= back; }
  if (P.reloadT > 0) {
    P.reloadT -= dt;
    if (P.reloadT <= 0) {
      P.reloadT = 0; const s = send({ t: 'reloaded', slot: P.reloadSlot }); G.pending.push({ s, k: 'reload', slot: P.reloadSlot });
      // shotgun: the next shell, unless you fire or run
      const { w } = myWeapons(), x = w[P.reloadSlot], d = x && wdef(x.id);
      if (d && d.shell && x.mag < d.mag && x.res > 0 && !mouseDown && P.sprint < .5) { P.reloadT = P.reloadDur = d.shell; SFX.reload(d.shell); }
    }
  }
  if (P.knifeT > 0) P.knifeT -= dt;
  if (P.throwT > 0) {
    P.throwT -= dt;
    if (!P.thrown && P.throwT < .3) {
      P.thrown = true;
      camForward(fwdV);
      const o = cam.position.clone().addScaledVector(fwdV, .5);
      send({ t: 'grenade', y: o.y, vx: fwdV.x * 13, vy: fwdV.y * 13 + 3.5, vz: fwdV.z * 13 });
    }
  }
  P.ads = lerp(P.ads, active && aiming && !hidden && P.reloadT <= 0 && P.knifeT <= 0 && P.sprint < .5 && playing ? 1 : 0, Math.min(1, dt * ((wcur && wdef(wcur.id).adsSpeed) || 12)));
  if (active && firing && !hidden && wcur && (wdef(wcur.id).auto || !firedThisPress)) { if (tryFire()) firedThisPress = true; }
  // ---- interaction prompt ----
  let prompt = '', bar = null, barLabel = '';
  const meNow = Object.assign({}, me, { x: P.x, z: P.z, w: weps, cur });
  if (st === 'a') {
    const rv = findRevive(G.latest.p, meNow);
    if (rv && !hidden) { prompt = `Hold F  Revive ${rv.name}`; if (holdF) { bar = rv.rev; barLabel = 'Reviving'; } }
    else {
      const it = findInteract(G.world, W, meNow);
      if (it) { prompt = it.text; if (pressF && it.kind === 'code') openKeypad(it.id); else if (pressF && it.kind !== 'none') send({ t: 'use' }); }
      else if (findRepair(G.world, W, meNow)) prompt = 'Hold F  Board up the window';
      if (it && it.kind === 'hide') tip('locker', 'Lockers hide you. Do not let anything see you climb in.');
    }
  }
  pressF = false;
  if (G.denyT > 0) { G.denyT -= dt; prompt = 'Not enough points'; }
  HUD.prompt(prompt, G.denyT > 0);
  if (st === 'd') {
    if (me.revBy) { bar = me.rev; barLabel = `${playerName(me.revBy)} is reviving you`; }
    else { bar = me.bleed / 30; barLabel = 'Bleeding out'; }
    HUD.down('You are down');
  } else if (st === 'x') HUD.down(W.phase === 'over' ? null : 'You are dead. Wait for the others.');
  else if (st === 'e') HUD.down(W.phase === 'over' ? null : 'You escaped. Waiting for the others.');
  else HUD.down(null);
  HUD.bar(barLabel, bar);
  // ---- flashlight: the battery lives on the server, the switch is yours ----
  const lightOn = P.flashOn && me.bat > 0 && playing && !hidden;
  if (me.bat < .2 && me.bat > 0 && !G.lowBatTip) { G.lowBatTip = true; tip('battery', 'Your battery is dying. Batteries lie on desks, benches and shelves.'); }
  P.flick -= dt;
  let flick = 1;
  if (lightOn && me.bat < .15) { if (P.flick <= 0) P.flick = R(.05, .6); if (P.flick < .08) flick = Math.random() < .5 ? 0 : .3; }
  G.flash.visible = lightOn && flick > 0;
  G.flash.intensity = 1.7 * flick * (me.bat < .15 ? .7 : 1);
  G.flash.position.copy(cam.position).add(new THREE.Vector3(.15, -.1, 0).applyQuaternion(cam.quaternion));
  G.flash.target.position.copy(cam.position).add(camForward(fwdV).multiplyScalar(5));
  {
    const D = G.dust, u = D.userData;
    D.visible = G.flash.visible && !hidden;
    if (D.visible) {
      D.position.copy(cam.position); D.quaternion.copy(cam.quaternion);
      D.material.opacity = .3 * Math.min(1, G.flash.intensity / 1.7);
      const t = G.time;
      for (let i = 0; i < u.n; i++) {
        const k = i * 3;
        u.pos[k] += Math.sin(t * .3 + i) * dt * .02; u.pos[k + 1] += (Math.cos(t * .23 + i * 1.7) * .02 - .008) * dt; u.pos[k + 2] += Math.sin(t * .17 + i * .7) * dt * .02;
        // moving drags the dust through the beam
        u.pos[k + 2] += P.moving * dt * .9;
        const z = u.pos[k + 2], rr = Math.hypot(u.pos[k], u.pos[k + 1]);
        if (z > -.85 || z < -4.6 || rr > Math.abs(z) * .45) u.seed(i);
      }
      D.geometry.attributes.position.needsUpdate = true;
    }
  }
  // ---- send our state at ~30 Hz ----
  G.stateT -= dt;
  if (G.stateT <= 0) {
    G.stateT = 1 / 30;
    send({ t: 'state', tp: P.tp, x: +P.x.toFixed(3), z: +P.z.toFixed(3), y: +P.y.toFixed(2), yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3), f: active && holdF, sp: P.sprint > .5, ads: P.ads > .5, rl: P.reloadT > 0, fl: P.flashOn && !hidden });
  }
  // ---- world, characters, effects, sound ----
  let dread = Math.min(.6, W.level * .5), chase = 0, stalker = 0, radio = 0;
  if (iv) {
    G.ent.lampMax = 1 - .25 * (W.matronDowns || 0);
  G.ent.sync(iv.zs, dt, G.time, G.camera.position);
    G.ent.syncPlayers(iv.ps, G.meId, dt, G.time);
    const near = [];
    for (const z of iv.zs) {
      const d = Math.hypot(z.x - cam.position.x, z.z - cam.position.z);
      const hidden = z.state === 'dormant' || z.state === 'ceiling';
      radio = Math.max(radio, Math.max(0, 1 - d / 12) * (hidden ? .35 : 1));
      if (z.type === 'stalker') stalker = Math.max(stalker, Math.max(0, 1 - d / 30) * (z.flags & ZFLAG.alert ? 1 : .6));
      if (z.flags & ZFLAG.alert) chase = Math.max(chase, Math.max(0, 1 - d / 18));
      else if (!hidden) dread = Math.max(dread, Math.max(0, 1 - d / 25));
      if (!hidden && z.state !== 'stun') near.push([d, z]);
      let t = G.groanT.get(z.id);
      if (t === undefined) t = R(.5, 6);
      t -= dt;
      if (t <= 0) {
        t = z.state === 'weep' ? R(2, 4) : z.state === 'feed' ? R(1.5, 3.5) : R(3, 9);
        if (z.state === 'weep') { SFX.sob(z.x, z.z); if (d < 12) caption('sob', 'Someone crying softly', 8); }
        else if (z.state === 'feed') { SFX.feed(z.x, z.z); if (d < 10) caption('feed', 'Wet tearing and chewing', 8); }
        else if (!hidden) { SFX.groan(z.x, z.z, z.type); if (d < 14) caption(z.type === 'stalker' ? 'matron' : 'groan', z.type === 'stalker' ? 'A low, wet breathing' : z.type === 'dog' ? 'Snarling' : z.type === 'brute' ? 'Heavy snorting' : 'Groaning', 8); }
      }
      G.groanT.set(z.id, t);
      // the first time you come across one of the worse ones
      if (d < 13 && !hidden) {
        if (z.state === 'weep') tip('weeper', 'Someone is crying in the corner. Do not shine your light on her, and do not get close. Walk around.');
        else if (z.type === 'brute') tip('brute', 'The brute charges in a straight line. Step out of the way and let it hit the wall.');
        else if (z.type === 'screamer') tip('screamer', 'A screamer calls every one of the dead nearby. Kill it before it sees you, or stay out of its sight.');
        else if (z.state === 'feed') tip('feeder', 'It is feeding and has not noticed you. Creep up behind it and press V to kill it quietly.');
      }
    }
    // teammates' footsteps
    for (const v of iv.ps) {
      if (v.id === G.meId || v.st !== 'a') continue;
      const pe = G.ent.players.get(v.id); if (!pe || pe.speed < .5) continue;
      let t = (G.stepT.get(v.id) || 0) - dt;
      if (t <= 0) { t = v.sp ? .3 : .48; SFX.step(surfaceAt(v.x, v.z), v.x, v.z, false); }
      G.stepT.set(v.id, t);
    }
    // footsteps of the four nearest moving dead
    near.sort((a, b) => a[0] - b[0]);
    for (const [d, z] of near.slice(0, 4)) {
      const c = G.ent.zombieView(z.id); if (!c || c.speed < .3 || d > 18) continue;
      let t = (G.stepT.get(z.id) || 0) - dt;
      if (t <= 0) { t = z.type === 'stalker' ? .75 : .9 / Math.max(.5, c.speed); SFX.step(surfaceAt(z.x, z.z), z.x, z.z, z.type === 'stalker'); if (z.type === 'stalker') caption('heavy', 'Heavy footsteps', 6); }
      G.stepT.set(z.id, t);
    }
  }
  // fear builds in the dark and near the dead; hallucinations follow
  const powered = !G.map.hasPower || W.power;
  const darkHere = !lightOn && (!powered || W.blackout > 0);
  G.fear.update({ dt, dark: darkHere && playing, chase, stalker, hpLow: st === 'a' ? Math.max(0, 1 - me.hp / me.mhp - .3) : 0, hidden, cam, enabled: !!opts.fear && playing });
  if (G.fear.radio > 0) radio = Math.max(radio, .8);
  if (hidden && (chase > .2 || stalker > .4)) { G.breathT -= dt; if (G.breathT <= 0) { G.breathT = 1.8; SFX.heldBreath(); } }
  const matron = W.stalker ? iv.zs.find(z => z.type === 'stalker') : null;
  setTension(playing ? dread : 0, playing ? chase : 0, playing ? stalker : 0, playing ? radio : 0,
    playing && W.stalker ? 1 + stalker : 0, !!matron && matron.state === 'stun', hidden);
  const lan = G.ent.lanternState();
  G.lanternLight.intensity = lan ? lan.flame * 1.3 : 0;
  if (lan) G.lanternLight.position.copy(lan.pos);
  G.view.update(dt, W, G.time, lan && lan.flame > .3 ? { x: lan.pos.x, z: lan.pos.z } : null, cam.position);
  syncPickups(dt);
  G.fx.update(dt);
  // darkness: fog closes in without power, during blackouts and while hellhounds run
  const dogs = G.latest.z.some(z => ZTYPES[z[1]] === 'dog');
  const farTarget = (W.blackout > 0 || dogs ? 13 : powered ? (G.map.fogPowered || G.map.fog.far) : G.map.fog.far) * ((W.night || []).includes('fog') ? .6 : 1);
  G.fogFar = lerp(G.fogFar, farTarget, Math.min(1, dt * .8));
  G.scene.fog.far = G.fogFar;
  // the building breathes: a sound from the map's own palette every so often
  G.ambT = (G.ambT ?? R(4, 9)) - dt;
  if (G.ambT <= 0 && G.map.ambience && playing) {
    G.ambT = R(7, 16);
    const a = R(0, Math.PI * 2), d = R(5, 14);
    SFX.ambient(G.map.ambience[Math.random() * G.map.ambience.length | 0], cam.position.x + Math.cos(a) * d, cam.position.z + Math.sin(a) * d);
  }
  // the doctor's car: cranking while you hold out, then idling
  const car = G.map.spots && G.map.spots.find(q => q.id === 'car'), ob = G.map.objectives[W.obj.i];
  if (car && ob && (ob.id === 'hold' || ob.id === 'exit')) { G.engineT = (G.engineT || 0) - dt; if (G.engineT <= 0) { if (ob.id === 'hold') { G.engineT = R(1.1, 1.8); SFX.crank(car.x, car.z + 3); } else { G.engineT = 1; SFX.engine(car.x, car.z + 3); } } }
  if (G.map.traps) for (const tr of G.map.traps) if (W.traps[tr.id] && W.traps[tr.id].a > 0) { G.trapZapT -= dt; if (G.trapZapT <= 0) { G.trapZapT = R(.05, .2); SFX.zap((tr.area[0] + tr.area[2]) / 2, (tr.area[1] + tr.area[3]) / 2); } }
  P.muzzleT = Math.max(0, P.muzzleT - dt);
  const on = P.muzzleT > 0;
  G.muzzleLight.intensity = on ? 2.4 : 0; G.vmFlash.intensity = on ? 3 : 0;
  if (on) G.muzzleLight.position.copy(cam.position).add(camForward(fwdV).multiplyScalar(.8));
  updateViewmodel(dt, wcur, st);
  // ---- HUD ----
  if (G.objI !== W.obj.i) G.guideT = G.objI >= 0 ? 6 : 8;   // show the way for a moment when the objective changes
  HUD.objective(objectiveText(G.map, W), G.objI >= 0 && G.objI !== W.obj.i);
  updateGuide(dt, W, P);
  G.objI = W.obj.i;
  HUD.points(me.pts);
  HUD.ammo(wcur, wcur ? wcur.mag : 0, wcur ? wcur.res : 0, me.g);
  HUD.battery(me.bat, lightOn);
  HUD.team(G.latest.p, G.meId);
  HUD.powerups(W.insta, W.dbl);
  const spreadNow = wcur ? (wdef(wcur.id).spread * (P.ads > .5 ? .3 : 1) + P.bloom) * (P.moving ? 1.5 : 1) : 0;
  HUD.crosshair(5 + spreadNow * 260 + P.sprint * 10, P.ads > .6 || P.sprint > .5 || !playing);
  // ---- post-processing ----
  P.hurtFx = Math.max(0, P.hurtFx - dt * 1.6);
  const low = st === 'a' ? 1 - me.hp / me.mhp : st === 'd' ? .9 : 0;
  if (st === 'a' && low > .5) { P.heartT -= dt; if (P.heartT <= 0) { P.heartT = .5 + (1 - low) * 1.2; SFX.heartbeat(); } }
  const post = pipe.post.uniforms;
  const dead = W.phase === 'over' && W.result !== 'escaped';
  post.uHurt.value = Math.max(P.hurtFx * .8, low > .45 ? low * .9 : 0, dead ? .8 : 0);
  post.uSat.value = dead || st === 'x' ? .15 : st === 'd' ? .3 : .85 - Math.max(0, low - .3) * .7;
  post.uFlash.value = G.fx.flash;
  post.uGas.value = me.gas ? .7 : Math.max(0, post.uGas.value - dt);
  post.uFrost.value = 0;
  post.uTime.value = G.time;
  post.uFear.value = opts.fear ? Math.max(0, (G.fear.level - .5) * 1.6) : 0;
  post.uHide.value = hidden ? 1 : 0;
  // hints and the frame counter
  if (G.tipT > 0) { G.tipT -= dt; if (G.tipT <= 0) $('tip').classList.remove('on'); }
  else if (G.tipQ.length && G.tipQ[0].at <= G.time && G.introT <= 0) { const t = G.tipQ.shift(); $('tip').textContent = t.text; $('tip').classList.add('on'); G.tipT = 6; }
  G.frames++; G.fpsT += dt;
  if (G.fpsT >= .5) { const f = G.frames / G.fpsT; if (opts.fps) $('fps').textContent = Math.round(f) + ' fps' + (opts.res ? '' : ' · ' + AUTO_LINES[autoRes.i]); autoResolution(f, G.fpsT); G.frames = 0; G.fpsT = 0; }
  if (G.overT > 0) { G.overT -= dt; if (G.overT <= 0) showOver(); }
  pipe.render(G.scene, cam, playing && W.phase !== 'over' ? G.vmScene : null, G.vmCam);
}

function syncPickups(dt) {
  const s = G.latest;
  const seen = new Set();
  for (const [id, kind, x, z, t] of s.pu) {
    seen.add(id);
    let v = G.puViews.get(id);
    if (!v) {
      const grp = new THREE.Group();
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: .6 })); glow.scale.set(1.2, 1.2, 1);
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.pu[kind], depthWrite: false, transparent: true, fog: false })); icon.scale.set(.6, .6, 1);
      grp.add(glow, icon); G.scene.add(grp); v = { grp, icon }; G.puViews.set(id, v);
      SFX.puSpawn(x, z);
    }
    v.grp.position.set(x, 1 + Math.sin(G.time * 3) * .15, z);
    v.icon.material.rotation = Math.sin(G.time * 2) * .3;
    v.grp.visible = t > 6 || Math.sin(G.time * 18) > 0;
  }
  for (const [id, v] of G.puViews) if (!seen.has(id)) { G.scene.remove(v.grp); G.puViews.delete(id); }
  const gs = new Set();
  for (const [id, x, y, z] of s.g) {
    gs.add(id);
    let m = G.grenViews.get(id);
    if (!m) { m = buildGun('grenade', GMw); m.scale.setScalar(1.3); G.scene.add(m); G.grenViews.set(id, m); }
    m.position.x += (x - m.position.x) * Math.min(1, dt * 15); m.position.y += (y - m.position.y) * Math.min(1, dt * 15); m.position.z += (z - m.position.z) * Math.min(1, dt * 15);
    m.rotation.x += dt * 8;
  }
  for (const [id, m] of G.grenViews) if (!gs.has(id)) { G.scene.remove(m); G.grenViews.delete(id); }
  while (G.gasViews.length < s.gas.length * 4) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.smoke, color: 0x7ab038, transparent: true, depthWrite: false, opacity: .5 }));
    sp.scale.set(2.4, 2.4, 1); G.scene.add(sp); G.gasViews.push(sp);
  }
  G.gasViews.forEach((sp, i) => {
    const c = s.gas[i >> 2];
    sp.visible = !!c;
    if (c) { const a = G.time * .4 + i * 1.7; sp.position.set(c[0] + Math.cos(a) * .9, .8 + (i % 4) * .25, c[1] + Math.sin(a) * .9); sp.material.opacity = Math.min(.5, c[2] * .2); sp.material.rotation = a; }
  });
}

function vmModel(id) {
  if (!G.vmModels[id]) { const m = buildGun(id, GMv); addArms(m, GMv); m.visible = false; G.vmRoot.add(m); G.vmModels[id] = m; }
  return G.vmModels[id];
}
function updateViewmodel(dt, wcur, st) {
  const P = G.P;
  const cur = wcur ? vmModel(wcur.id) : null;
  const hidden = !wcur || P.knifeT > 0 || P.throwT > 0 || (st !== 'a' && st !== 'd') || !!G.me.hid;
  for (const k in G.vmModels) G.vmModels[k].visible = !hidden && G.vmModels[k] === cur;
  if (cur && G.flashSprite.parent !== cur) { cur.add(G.flashSprite); G.flashSprite.position.set(0, .01, cur.userData.muzzle - .04); }
  G.flashSprite.visible = P.muzzleT > 0 && !!wcur;
  G.flashSprite.material.rotation = R(0, 6.28);
  P.swayX *= Math.pow(.002, dt); P.swayY *= Math.pow(.002, dt);
  const pos = hipPos.clone().lerp(adsPos, P.ads);
  const bobAmt = (1 - P.ads * .85) * P.moving;
  pos.x += Math.sin(P.bob * .5) * .012 * bobAmt - P.swayX;
  // breathing: worse when winded or badly hurt, almost gone while aiming
  const winded = clamp(1 - P.stamina, 0, 1), hurt = G.me ? clamp(1 - G.me.hp / G.me.mhp - .3, 0, 1) : 0;
  const breath = (1 - P.ads * .8) * (1 + winded * 3 + hurt * 3);
  pos.y += -Math.abs(Math.cos(P.bob * .5)) * .01 * bobAmt + P.swayY + Math.sin(G.time * 1.6) * .002 * breath;
  pos.x += Math.sin(G.time * 1.1) * .0015 * breath;
  pos.z += P.recoil * .035;
  let rx = P.recoil * .12, ry = 0, rz = 0;
  if (P.reloadT > 0) { const p = 1 - P.reloadT / P.reloadDur, k = Math.sin(Math.PI * p); pos.y -= .1 * k; rx -= .5 * k; rz += .45 * k; }
  // the magazine drops out and a fresh one goes in
  if (cur) for (const m of cur.userData.mag || []) {
    const p = P.reloadT > 0 ? 1 - P.reloadT / P.reloadDur : 1;
    const out = p < .3 ? p / .3 : p < .65 ? 1 : 1 - (p - .65) / .35;
    m.position.copy(m.userData.home); m.position.y -= out * .28; m.visible = out < .98;
  }
  if (P.switchT > 0) { pos.y -= .35 * (P.switchT / .35); rx -= .6 * (P.switchT / .35); }
  if (P.sprint > .01) { pos.x -= .04 * P.sprint; pos.y -= .03 * P.sprint; ry += .7 * P.sprint; rx -= .25 * P.sprint; }
  if (st === 'd') { pos.y -= .02; rz -= .2; }
  G.vmRoot.position.copy(pos); G.vmRoot.rotation.set(rx, ry, rz);
  G.vmFlash.position.set(pos.x, pos.y + .05, pos.z - .3);
  G.knifeVM.visible = P.knifeT > 0;
  if (P.knifeT > 0) {
    const p = 1 - P.knifeT / .45, k = Math.sin(Math.PI * Math.min(1, p * 1.3)), sd = P.knifeSide || 1;
    if (P.knifeStyle === 'stab') {   // down into the back of the neck
      G.knifeVM.position.set(.05, lerp(.05, -.2, p), -.35 - k * .1);
      G.knifeVM.rotation.set(lerp(-1.4, -.4, p), 0, 0);
    } else {   // a shove with the left hand and a slash, alternating sides
      G.knifeVM.position.set(sd * lerp(.3, -.1, p), -.15 + k * .05, -.3 - k * .12);
      G.knifeVM.rotation.set(-.2, sd * lerp(.9, -.6, p), sd * lerp(.4, -.3, p));
      G.camera.position.addScaledVector(camForward(fwdV), k * .06);
    }
  }
  G.grenVM.visible = P.throwT > 0 && !P.thrown;
  if (P.throwT > 0) { const p = 1 - P.throwT / .6; G.grenVM.position.set(.2, -.15 + p * .12, -.3 + p * .1); G.grenVM.rotation.set(p * 2, 0, 0); }
}

function showOver() {
  const s = G.latest, W = s.W, won = W.result === 'escaped';
  const me = s.p.find(p => p.id === G.meId);
  const mine = me && me.st === 'e';
  const end = ending(G.mapId, W, s.p, G.meId, G.map.notePrefix);
  $('overTitle').textContent = end.title;
  $('overTitle').classList.toggle('won', won && mine);
  $('overEyebrow').textContent = `${G.map.name} · ${DIFFICULTY[W.diff || 'normal'].name}`;
  $('ending').textContent = end.text;
  let line = `Time: ${fmtTime(W.elapsed)}. Documents found: ${W.notes.length}.`;
  // an escape that needed a checkpoint does not set records
  if (W.retries) line += ` Returned to a checkpoint ${W.retries === 1 ? 'once' : 'twice'}.`;
  else if (won && mine && records.set(G.mapId, W.diff || 'normal', W.elapsed)) line += ' New best escape.';
  if (won && mine && !W.retries && G.tr.local && app.mpOk) fetch('/records', { method: 'POST', body: JSON.stringify({ map: G.mapId, diff: W.diff, names: [me.name], time: W.elapsed, notes: W.notes.length }) }).catch(() => {});
  $('overTime').textContent = line;
  const status = p => p.st === 'e' ? 'Escaped' : 'Dead';
  const rows = s.p.slice().sort((a, b) => b.score - a.score).map(p =>
    `<tr><td>${p.name.replace(/[<>&]/g, '')}</td><td>${status(p)}</td><td>${p.score}</td><td>${p.kills}</td><td>${p.heads}</td><td>${p.downs}</td><td>${p.revives}</td></tr>`).join('');
  $('overTable').innerHTML = `<tr><th>Player</th><th>Status</th><th>Points</th><th>Kills</th><th>Headshots</th><th>Downs</th><th>Revives</th></tr>${rows}`;
  const host = G.tr.local || (app.lobby && app.lobby.host === app.ws.me);
  $('againBtn').hidden = !host;
  const left = 2 - (W.retries || 0);
  $('cpBtn').hidden = !(host && W.result === 'dead' && W.cp && left > 0);
  $('cpBtn').textContent = `Return to the last checkpoint (${left} left)`;
  $('overNote').textContent = host ? '' : 'The host can start another night.';
  closeReader(); closeJournal(); closeKeypad();
  const prefix = G.map.notePrefix;
  for (const id of endOfNight(G.mapId, W, s.p, me, Object.keys(NOTES).filter(k => k[0] === prefix).length)) award(id);
  docs.add(W.notes.filter(id => NOTES[id]));
  if (G.map.last && won && mine) setTimeout(() => rollCredits(W), 400);
  $('fade').className = 'overlay';
  screen('over');
  if (app.mpOk) loadHall();
  renderMenuMaps();
  if (document.pointerLockElement) document.exitPointerLock();
}

// After the last night: the epilogue, who they were, how it went, and the end.
let creditsT = 0;
function rollCredits(W) {
  const read = docs.all(), allDocs = Object.keys(NOTES).every(id => read[id]);
  if (allDocs) award('wholetruth');
  const got = unlocked(), nights = ['escape_b', 'escape_s', 'escape_e', 'escape_m', 'closed'].filter(id => got[id]).length;
  const el = $('creditsRoll'); el.innerHTML = '';
  const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; n.textContent = text; el.appendChild(n); return n; };
  for (const para of epilogue(allDocs)) add('p', '', para);
  add('h2', '', CREDITS[0][0]).style.marginTop = '24vh';
  for (const [a, b] of CREDITS.slice(1)) {
    const w = add('div', 'who', '');
    for (const [tag, text] of [['b', a], ['span', b]]) if (text) { const n = document.createElement(tag); n.textContent = text; w.appendChild(n); }
  }
  add('p', 'stat', `Nights survived: ${nights} of 5`).style.marginTop = '10vh';
  add('p', 'stat', `The last night: ${fmtTime(W.elapsed)}`);
  add('p', 'stat', `Documents read: ${Object.keys(read).filter(id => NOTES[id]).length} of ${Object.keys(NOTES).length}`);
  add('p', 'end', 'The End');
  const box = $('credits'); box.hidden = false; requestAnimationFrame(() => box.classList.add('on'));
  // it scrolls until "The End" stands in the middle of the screen, then stays there
  const t0 = performance.now(), secs = Math.max(45, el.offsetHeight / 55);
  cancelAnimationFrame(creditsT);
  const tick = now => {
    const k = Math.min(1, (now - t0) / 1000 / secs);
    el.style.transform = `translate(-50%, ${-k * (el.offsetHeight + innerHeight * .05)}px)`;
    if (k < 1 && !box.hidden) creditsT = requestAnimationFrame(tick);
  };
  creditsT = requestAnimationFrame(tick);
}
function closeCredits() { const box = $('credits'); box.classList.remove('on'); cancelAnimationFrame(creditsT); setTimeout(() => { box.hidden = true; }, 600); }
$('creditsSkip').addEventListener('click', closeCredits);

/* ===================== menu backdrop ===================== */
let menuScene = null;
function menuBackdrop(mapId) {
  const map = MAPS[mapId];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(map.fog.color); scene.fog = new THREE.Fog(map.fog.color, map.fog.near, map.fog.far * .8);
  const world = buildWorld(map), view = buildWorldView(scene, world, TX, GMw);
  const fx = new FX(scene, TX), ent = new Entities(scene, TX, fx, GMw, map.clothes, map.helmets);
  const cam = new THREE.PerspectiveCamera(70, 1.33, .05, 120);
  pipe.cams.length = 0; pipe.cams.push(cam); pipe.resize();
  const sp = map.playerSpawns[0];
  const zs = [];
  for (let i = 0; i < 3; i++) { const c = ent.makeZombie(100 + i, i === 2 ? 'thin' : 'walker'); c.group.position.set(sp.x + R(-3, 3), 0, sp.z - 3 - i * 1.2); zs.push(c); }
  const lying = ent.makeZombie(120, 'walker'); lying.group.position.set(sp.x + 1.5, 0, sp.z - 1); zs.push(lying);
  const lamp = new THREE.SpotLight(0xfff0d0, 1.5, 16, .5, .6, 1.1); scene.add(lamp, lamp.target);
  const W = { doors: {}, boards: {}, traps: {}, items: [], power: false, blackout: 0, obj: { i: 0 }, hides: {} };
  menuScene = { scene, cam, view, zs, lying, W, t: 0, sp, lamp };
}
menuBackdrop(mapChoice);

/* ===================== main loop ===================== */
let last = performance.now();
// Menu sound: browsers only allow it after the first click or key press on the page,
// so the drone, the wind and the map's distant noises start then.
const menuAudio = { on: false, next: 0, tens: 0 };
function startMenuAudio() {
  if (menuAudio.on) return;
  menuAudio.on = true; initAudio();
}
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, startMenuAudio, { capture: true, passive: true });
document.addEventListener('click', e => { if (!G && e.target.closest && e.target.closest('button')) SFX.empty(); }, true);
function menuSoundTick(now) {
  if (!menuAudio.on) return;
  if (now > menuAudio.tens) { menuAudio.tens = now + 1000; setTension(.35, 0, 0, 0); }
  if (now > menuAudio.next) {
    if (menuAudio.next) { const amb = MAPS[mapChoice].ambience || ['drip']; SFX.ambient(amb[Math.random() * amb.length | 0]); }
    menuAudio.next = now + R(6000, 13000);
  }
}

// Tell the player when the browser keeps the game silent, once per night.
function soundWatch(now) {
  if (G.sndChecked || now - (G.sndT || (G.sndT = now)) < 4000) return;
  G.sndChecked = true;
  const st = audioStatus();
  if (st !== 'running') { console.warn('[audio] no sound in game:', st); HUD.announce(st === 'suspended' ? 'No sound: the browser is blocking it. Click to allow.' : 'No sound: see Settings > Sound check.'); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, .05); last = now;
  if (G) { soundWatch(now); updateGame(dt); return; }
  menuSoundTick(now);
  if (menuScene) {
    const m = menuScene; m.t += dt;
    const a = m.t * .05;
    m.cam.position.set(m.sp.x + Math.sin(a) * 4, 1.7, m.sp.z + Math.cos(a) * 3 + 2);
    m.cam.lookAt(m.sp.x, 1.2, m.sp.z - 3);
    m.cam.updateMatrixWorld();
    m.lamp.position.copy(m.cam.position);
    m.lamp.target.position.set(m.sp.x + Math.sin(m.t * .4) * 2, .8, m.sp.z - 3);
    for (const c of m.zs) {
      if (c === m.lying) { poseHumanoid(c, dt, { mode: 'walk', speed: 0, t: m.t, swing: 0 }); poseDeath(c, 1, 0, false); }
      else poseHumanoid(c, dt, { mode: 'walk', speed: .3, t: m.t, swing: 0 });
    }
    m.view.update(dt, m.W, m.t, null, m.cam.position);
    pipe.post.uniforms.uHurt.value = 0; pipe.post.uniforms.uSat.value = .7; pipe.post.uniforms.uFlash.value = 0;
    pipe.render(m.scene, m.cam);
  }
}
applyOptions();
requestAnimationFrame(frame);
window.__b115 = {
  get G() { return G; }, app, THREE, startSolo: () => $('soloBtn').click(), info: () => Object.assign({}, pipe.stats, { programs: pipe.renderer.info.programs.length, geometries: pipe.renderer.info.memory.geometries, textures: pipe.renderer.info.memory.textures }),
  music: () => musicState(),
  mouse(on) { mouseDown = on; firedThisPress = false; }, key(code, on) { keys[code] = on; }, press(code) { dispatchEvent(new KeyboardEvent('keydown', { code })); dispatchEvent(new KeyboardEvent('keyup', { code })); }
};
