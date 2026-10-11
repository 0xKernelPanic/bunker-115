// Every sound is synthesized with WebAudio. Positional sounds take (x, z) and are panned and
// attenuated relative to the listener set each frame. Music is a set of looping layers whose
// volume follows the tension of the moment.
import { R, pick, clamp } from '../shared/util.js';

let ac = null, out = null, nb = null, layers = null, musicBus = null, vol = { master: .75, music: 1 }, audioErr = '';
const L = { x: 0, z: 0, yaw: 0 };

// Phones: make the sound play even with the iPhone's silent switch on, and wake the audio
// up again after the browser suspended it (another app, a call, the screen going off).
function unlockMobile() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  const wake = () => { if (ac && ac.state !== 'running' && ac.state !== 'closed') ac.resume().catch(() => {}); };
  for (const ev of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(ev, wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  // older iOS only starts WebAudio after something has played inside a tap
  const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0);
}

export function initAudio() {
  if (ac) { if (ac.state !== 'running' && ac.state !== 'closed') ac.resume().catch(() => {}); return; }
  const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
  try {
    ac = new A();
    unlockMobile();
    if (ac.state !== 'running') ac.resume().catch(() => {});
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    out = ac.createGain(); out.gain.value = vol.master; out.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = vol.music; musicBus.connect(out);
    nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    buildLayers();
  } catch (e) { ac = null; audioErr = e.message || String(e); console.warn('[audio] could not start:', e); }
}
// 'running' when sound is playing; otherwise why not, for the settings screen
export function audioStatus() {
  if (!window.AudioContext && !window.webkitAudioContext) return 'unsupported';
  if (!ac) return audioErr ? 'error: ' + audioErr : 'not started';
  return ac.state;
}
// a plain, clearly audible beep through the master volume
export function testTone() {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = 660; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.3, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + .55);
}
export function setVolume(master, music) { vol.master = master; vol.music = music; if (out) out.gain.value = master; if (musicBus) musicBus.gain.value = music; }
export function setListener(x, z, yaw) { L.x = x; L.z = z; L.yaw = yaw; }
function place(x, z, range = 26) {
  if (x === undefined) return { v: 1, pan: 0 };
  const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
  const pan = d < .1 ? 0 : clamp((dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw)) / d, -1, 1);
  return { v: Math.max(0, 1 - d / range) ** 1.4, pan: pan * .8, d };
}
function dest(pan) {
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; p.connect(out); return p; }
  return out;
}
function noise({ f = 1000, q = .7, type = 'lowpass', vol = .4, dur = .2, delay = 0, pan = 0, a = .003, f2 }) {
  if (!ac || vol < .003) return;
  const t = ac.currentTime + delay, s = ac.createBufferSource(); s.buffer = nb;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dur);
  s.connect(fl); fl.connect(g); g.connect(dest(pan)); s.start(t, Math.random() * 1.5); s.stop(t + a + dur + .05);
}
function tone({ f = 440, f2, type = 'sine', vol = .2, dur = .2, delay = 0, pan = 0, a = .005, lp }) {
  if (!ac || vol < .003) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dur);
  let n = o; if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); n = fl; }
  n.connect(g); g.connect(dest(pan)); o.start(t); o.stop(t + a + dur + .05);
}
function voice({ f, f2, dur, vol, pan, band = 600, q = 1.4, vib = 7, type = 'sawtooth', delay = 0 }) {
  if (!ac || vol < .003) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f2, t + dur);
  const lfo = ac.createOscillator(); lfo.frequency.value = vib; const lg = ac.createGain(); lg.gain.value = f * .09; lfo.connect(lg); lg.connect(o.frequency);
  const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = band; fl.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .12); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(fl); fl.connect(g); g.connect(dest(pan)); o.start(t); lfo.start(t); o.stop(t + dur + .1); lfo.stop(t + dur + .1);
}

// ---------- music layers ----------
function loopBuffer(seconds, fill) {
  const b = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate), d = b.getChannelData(0);
  fill(d, ac.sampleRate);
  const s = ac.createBufferSource(); s.buffer = b; s.loop = true; return s;
}
function buildLayers() {
  const gain = v => { const g = ac.createGain(); g.gain.value = v; g.connect(musicBus); return g; };
  // always: a low drone and wind
  const drone = gain(.05), dfl = ac.createBiquadFilter(); dfl.type = 'lowpass'; dfl.frequency.value = 160; dfl.connect(drone);
  [41.2, 41.8, 61.7].forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(dfl); o.start(); });
  const wind = ac.createBufferSource(); wind.buffer = nb; wind.loop = true;
  const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 340; wf.Q.value = .6;
  const wg = gain(.03); const wl = ac.createOscillator(); wl.frequency.value = .11; const wlg = ac.createGain(); wlg.gain.value = .022;
  wl.connect(wlg); wlg.connect(wg.gain); wind.connect(wf); wf.connect(wg); wind.start(); wl.start();
  // dread: dissonant detuned strings breathing in and out
  const dread = gain(0), df = ac.createBiquadFilter(); df.type = 'bandpass'; df.frequency.value = 420; df.Q.value = 2.5; df.connect(dread);
  [110, 116.5, 155.6, 164.8].forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = R(-12, 12); o.connect(df); o.start(); });
  const dl = ac.createOscillator(); dl.frequency.value = .07; const dlg = ac.createGain(); dlg.gain.value = 260; dl.connect(dlg); dlg.connect(df.frequency); dl.start();
  // chase: a pounding low pulse with metallic ticks
  const chase = gain(0);
  const pulse = loopBuffer(2, (d, sr) => {
    for (let beat = 0; beat < 4; beat++) {
      const s0 = Math.floor(beat * .5 * sr);
      for (let i = 0; i < sr * .22 && s0 + i < d.length; i++) { const t = i / sr; d[s0 + i] += Math.sin(2 * Math.PI * (60 - t * 80) * t) * Math.exp(-t * 14) * .9; }
      const s1 = Math.floor((beat * .5 + .25) * sr);
      for (let i = 0; i < sr * .04 && s1 + i < d.length; i++) d[s1 + i] += (Math.random() * 2 - 1) * Math.exp(-i / sr * 90) * .25;
    }
  });
  pulse.connect(chase); pulse.start();
  // the Matron: a low cluster and a scraping texture
  const stalk = gain(0), sf = ac.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 300; sf.connect(stalk);
  [55, 58.3, 77.8].forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(sf); o.start(); });
  const scrape = ac.createBufferSource(); scrape.buffer = nb; scrape.loop = true;
  const scf = ac.createBiquadFilter(); scf.type = 'bandpass'; scf.frequency.value = 3200; scf.Q.value = 6;
  const scg = ac.createGain(); scg.gain.value = .25; const sl = ac.createOscillator(); sl.frequency.value = .4; const slg = ac.createGain(); slg.gain.value = .25; sl.connect(slg); slg.connect(scg.gain);
  scrape.connect(scf); scf.connect(scg); scg.connect(stalk); scrape.start(); sl.start();
  // pocket radio: static that grows when something is close
  const radio = gain(0), rs = ac.createBufferSource(); rs.buffer = nb; rs.loop = true;
  const rf = ac.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 1900; rf.Q.value = .7;
  const rc = ac.createGain(); rc.gain.value = 1;
  rs.connect(rf); rf.connect(rc); rc.connect(radio); rs.start();
  // the Matron's theme while she is anywhere on the map: a detuned music box playing a slow
  // lullaby, warped like an old tape, over a low pad
  const presence = gain(0), pf = ac.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 2200; pf.connect(presence);
  const box = loopBuffer(12.8, (d, sr) => {
    // A minor: A C E | G E C | F E D | E . . ; each note a bell with a little detune
    const notes = [57, 60, 64, 67, 64, 60, 65, 64, 62, 64, 0, 0, 57, 60, 64, 69, 67, 64, 62, 60, 59, 57, 0, 0];
    const step = 12.8 / notes.length;
    notes.forEach((n, i) => {
      if (!n) return;
      const f = 440 * Math.pow(2, (n - 69) / 12) * (1 + (Math.random() - .5) * .012), s0 = Math.floor(i * step * sr);
      for (let k = 0; k < sr * 2.2 && s0 + k < d.length; k++) {
        const t = k / sr, env = Math.exp(-t * 2.6) * Math.min(1, t * 400);
        d[s0 + k] += (Math.sin(2 * Math.PI * f * t) * .5 + Math.sin(2 * Math.PI * f * 2.76 * t) * .18 * Math.exp(-t * 6) + Math.sin(2 * Math.PI * f * 5.4 * t) * .07 * Math.exp(-t * 10)) * env * .35;
      }
    });
  });
  const wow = ac.createOscillator(); wow.frequency.value = .35; const wowG = ac.createGain(); wowG.gain.value = .012; wow.connect(wowG); wowG.connect(box.playbackRate); wow.start();
  box.connect(pf); box.start();
  const pad = ac.createGain(); pad.gain.value = .06; pad.connect(pf);
  [55, 65.4, 82.4].forEach(f => { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = R(-8, 8); o.connect(pad); o.start(); });
  layers = { dread, chase, stalk, radio, rc, presence, pf, box };
}
// steady rain on the roof and windows on a stormy night
let rain = null;
export function setRain(on) {
  if (!ac) return;
  if (on && !rain) {
    const src = loopBuffer(3, d => { for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (.6 + Math.random() * .4 * (Math.random() < .002 ? 3 : 1)); });
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = .5;
    const g = ac.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(out); src.start();
    g.gain.setTargetAtTime(.05, ac.currentTime, 2);
    rain = { src, g };
  } else if (!on && rain) { const r = rain; rain = null; r.g.gain.setTargetAtTime(0, ac.currentTime, .5); setTimeout(() => { try { r.src.stop(); } catch (e) {} }, 2000); }
}
// for tests: what the music is doing
export function musicState() {
  if (!layers) return null;
  return { dread: layers.dread.gain.value, chase: layers.chase.gain.value, stalker: layers.stalk.gain.value, presence: layers.presence.gain.value, rate: layers.box.playbackRate.value, cutoff: layers.pf.frequency.value };
}
// the Matron arrives: the music box grinds and stops, then a low chord
export function matronArrives() {
  if (!ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < 6; i++) tone({ f: 1400 - i * 170, f2: 900 - i * 120, type: 'square', vol: .14, dur: .09, delay: i * .11, lp: 2400 });
  voice({ f: 55, f2: 52, dur: 3.2, vol: .5, pan: 0, band: 220, q: 2, vib: 2, delay: .7 });
  voice({ f: 65.4, f2: 61.7, dur: 3.0, vol: .35, pan: 0, band: 260, q: 2, vib: 3, delay: .75 });
  void t;
}
// the Matron dies: a long breath going out of her, the lantern glass, then the music box winds down
// for the last time, slower and slower
export function matronDies() {
  if (!ac) return;
  voice({ f: 70, f2: 38, dur: 4.5, vol: .5, pan: 0, band: 240, q: 2, vib: 1 });
  noise({ f: 2600, type: 'bandpass', q: 3, vol: .25, dur: .35, delay: 1.2 });
  const notes = [988, 880, 784, 659, 587, 523, 440];
  notes.forEach((f, i) => tone({ f, f2: f * .985, type: 'triangle', vol: .1, dur: .5 + i * .15, delay: 2.2 + i * (.45 + i * .12), lp: 3000 }));
}
// clean water forced through the works: a long roar in the pipes
export function flush() {
  if (!ac) return;
  // the noise buffer is short, so the roar is a run of overlapping bursts
  for (let i = 0; i < 5; i++) { noise({ f: 400, type: 'lowpass', vol: .4 - i * .05, dur: .5, a: .4, delay: i * .9 }); noise({ f: 1800, type: 'bandpass', q: 1, vol: .13 - i * .02, dur: .4, a: .4, delay: i * .9 + .3 }); }
  voice({ f: 48, f2: 44, dur: 5, vol: .25, pan: 0, band: 150, q: 2, vib: 1 });
}
// tension: 0..1 values for each layer, smoothed by the audio clock
// presence: 0 when the Matron is not on the map, else 1 (far) .. 2 (close); stunned slows the box;
// muffled: the player is shut in a locker
export function setTension(dread, chase, stalker, radio, presence = 0, stunned = false, muffled = false) {
  if (!layers) return;
  const t = ac.currentTime;
  if (presence > 0) dread *= .4;   // her theme takes over
  // clearly there wherever she is; louder and brighter as she gets closer
  layers.presence.gain.setTargetAtTime(presence > 0 ? .34 + (presence - 1) * .3 : 0, t, presence > 0 ? 1.5 : 1.2);
  layers.pf.frequency.setTargetAtTime((muffled ? 1000 : 2200) + Math.max(0, presence - 1) * (muffled ? 800 : 4000), t, .8);
  layers.box.playbackRate.setTargetAtTime(stunned ? .7 : 1, t, stunned ? .6 : 1.5);
  layers.dread.gain.setTargetAtTime(dread * .05, t, .8);
  layers.chase.gain.setTargetAtTime(chase * .22, t, .4);
  layers.stalk.gain.setTargetAtTime(stalker * .12, t, .6);
  layers.radio.gain.setTargetAtTime(radio * .09, t, .15);
  // crackle: random dropouts in the static
  layers.rc.gain.setValueAtTime(Math.random() < .3 ? R(.2, 1.6) : 1, t);
}

const SHOTS = {
  pistol: v => { noise({ f: 2600, vol: .7 * v.v, dur: .16, pan: v.pan }); tone({ f: 150, f2: 50, vol: .55 * v.v, dur: .12, pan: v.pan }); },
  smg: v => { noise({ f: 3000, vol: .5 * v.v, dur: .09, pan: v.pan }); tone({ f: 130, f2: 50, vol: .4 * v.v, dur: .07, pan: v.pan }); },
  rifleAuto: v => { noise({ f: 3200, vol: .6 * v.v, dur: .12, pan: v.pan }); tone({ f: 120, f2: 45, vol: .5 * v.v, dur: .1, pan: v.pan }); },
  mg: v => { noise({ f: 2400, vol: .55 * v.v, dur: .08, pan: v.pan }); tone({ f: 100, f2: 40, vol: .5 * v.v, dur: .07, pan: v.pan }); },
  rifle: v => { noise({ f: 3600, vol: .9 * v.v, dur: .45, f2: 400, pan: v.pan }); tone({ f: 110, f2: 35, vol: .7 * v.v, dur: .25, pan: v.pan }); noise({ f: 900, type: 'bandpass', q: 3, vol: .15 * v.v, dur: .08, delay: .55, pan: v.pan }); },
  shotgun: v => { noise({ f: 1900, vol: .95 * v.v, dur: .38, f2: 300, pan: v.pan }); tone({ f: 85, f2: 32, vol: .8 * v.v, dur: .28, pan: v.pan }); }
};
const STEP = { tiles: [1800, .09], concrete: [900, .11], ground: [380, .14], planks: [650, .12] };

export const SFX = {
  shot(kind, x, z) { const v = place(x, z, 60); (SHOTS[kind] || SHOTS.pistol)(v); },
  empty() { tone({ f: 1800, type: 'square', vol: .05, dur: .02 }); },
  reload(d) { tone({ f: 1600, f2: 1100, type: 'square', vol: .06, dur: .03, delay: d * .2 }); noise({ f: 2000, type: 'bandpass', q: 4, vol: .12, dur: .05, delay: d * .45 }); tone({ f: 1900, f2: 1300, type: 'square', vol: .07, dur: .03, delay: d * .85 }); },
  // a round going into a body, into a skull, off a wall
  flesh(x, z) { const v = place(x, z, 30); noise({ f: 420, type: 'bandpass', q: 1.4, vol: .3 * v.v, dur: .07, pan: v.pan }); },
  headshot(x, z) { const v = place(x, z, 30); noise({ f: 2600, type: 'bandpass', q: 3, vol: .25 * v.v, dur: .03, pan: v.pan }); noise({ f: 600, type: 'bandpass', q: 1.2, vol: .3 * v.v, dur: .12, delay: .02, pan: v.pan }); },
  ricochet(x, z) { const v = place(x, z, 30); tone({ f: 2600, f2: 900, type: 'sine', vol: .08 * v.v, dur: .25, pan: v.pan }); },
  shove(x, z) { const v = place(x, z, 20); noise({ f: 220, type: 'lowpass', vol: .4 * v.v, dur: .12, pan: v.pan }); voice({ f: 90, f2: 60, dur: .3, vol: .12 * v.v, pan: v.pan, band: 400 }); },
  stab(x, z) { const v = place(x, z, 12); noise({ f: 700, type: 'bandpass', q: 1.5, vol: .3 * v.v, dur: .15, pan: v.pan }); noise({ f: 300, type: 'lowpass', vol: .25 * v.v, dur: .3, delay: .12, pan: v.pan }); },
  hit(kill) { noise({ f: kill ? 500 : 900, type: 'bandpass', q: 2, vol: .12, dur: .05 }); },
  splat(x, z) { const v = place(x, z); noise({ f: 700, type: 'bandpass', q: 1.2, vol: .4 * v.v, dur: .18, pan: v.pan }); },
  step(surface, x, z, heavy) {
    const [f, vol] = STEP[surface] || STEP.tiles, v = x === undefined ? { v: 1, pan: 0 } : place(x, z, heavy ? 30 : 16);
    noise({ f: heavy ? f * .4 : f, type: 'bandpass', q: 1.5, vol: vol * v.v * (heavy ? 3 : 1), dur: heavy ? .18 : .06, pan: v.pan });
    if (heavy) tone({ f: 48, f2: 30, vol: .35 * v.v, dur: .2, pan: v.pan });
  },
  groan(x, z, kind) {
    const v = place(x, z, 24); if (v.v <= 0) return;
    if (kind === 'dog') { voice({ f: R(90, 130), f2: R(60, 80), dur: .7, vol: .25 * v.v, pan: v.pan, band: 300, vib: 22 }); return; }
    if (kind === 'stalker') { voice({ f: R(40, 50), f2: R(32, 38), dur: 2.2, vol: .3 * v.v, pan: v.pan, band: 180, q: 3, vib: 3 }); return; }
    if (kind === 'brute') {   // a deep, wet snort and a groan from under the sack
      noise({ f: 260, type: 'bandpass', q: 1.5, vol: .3 * v.v, dur: .35, pan: v.pan, a: .05 });
      voice({ f: R(38, 46), f2: R(30, 36), dur: 1.4, vol: .3 * v.v, pan: v.pan, band: 160, q: 2.5, vib: 4, delay: .3 }); return;
    }
    if (kind === 'screamer') {   // ragged, rattling breaths through the torn jaw
      for (let i = 0; i < 3; i++) noise({ f: R(1800, 2600), type: 'bandpass', q: 3, vol: .1 * v.v, dur: .35, delay: i * .45, pan: v.pan, a: .08 });
      voice({ f: R(220, 260), f2: R(160, 190), dur: .9, vol: .08 * v.v, pan: v.pan, band: 1600, q: 4, vib: 30 }); return;
    }
    const f = kind === 'thin' ? R(150, 200) : kind === 'bloater' ? R(45, 60) : R(62, 100);
    voice({ f, f2: f * R(.6, .85), dur: R(1.0, 1.6), vol: .2 * v.v, pan: v.pan, band: kind === 'bloater' ? 260 : R(380, 720) });
  },
  // a woman crying softly somewhere in the dark: catching breaths and a broken voice
  sob(x, z) {
    const v = place(x, z, 18); if (v.v <= 0) return;
    for (let i = 0; i < 3; i++) {
      noise({ f: 1100, type: 'bandpass', q: 2, vol: .09 * v.v, dur: .12, delay: i * .32, pan: v.pan, a: .02 });
      voice({ f: R(300, 360), f2: R(240, 280), dur: .28, vol: .1 * v.v, pan: v.pan, band: 900, q: 3, vib: 9, type: 'triangle', delay: i * .32 + .08 });
    }
    voice({ f: 340, f2: 230, dur: 1.2, vol: .08 * v.v, pan: v.pan, band: 800, q: 2.5, vib: 6, type: 'triangle', delay: 1.1 });
  },
  // tearing and chewing
  feed(x, z) {
    const v = place(x, z, 12); if (v.v <= 0) return;
    for (let i = 0; i < 4; i++) noise({ f: R(500, 1100), type: 'bandpass', q: 1.2, vol: .12 * v.v, dur: R(.08, .2), delay: i * R(.15, .35), pan: v.pan });
    noise({ f: 180, type: 'lowpass', vol: .1 * v.v, dur: .3, delay: .6, pan: v.pan });
  },
  // the screamer: a long rising howl that carries through the whole building
  howl(x, z) {
    const v = place(x, z, 60), vol = Math.max(.25, v.v);
    voice({ f: 260, f2: 980, dur: 1.6, vol: .4 * vol, pan: v.pan, band: 1300, q: 1.6, vib: 9, type: 'square' });
    voice({ f: 390, f2: 1400, dur: 1.5, vol: .2 * vol, pan: v.pan, band: 2100, q: 2.5, vib: 14, delay: .1 });
    noise({ f: 2500, type: 'bandpass', q: 1, vol: .15 * vol, dur: 1.5, pan: v.pan, a: .2 });
  },
  // the weeper turning on you
  shriek(x, z) {
    const v = place(x, z, 30), vol = Math.max(.3, v.v);
    voice({ f: 700, f2: 1700, dur: .7, vol: .45 * vol, pan: v.pan, band: 1800, q: 1.2, vib: 25, type: 'sawtooth' });
    voice({ f: 1100, f2: 2300, dur: .6, vol: .25 * vol, pan: v.pan, band: 2600, q: 2, vib: 31, type: 'square', delay: .03 });
    noise({ f: 3500, type: 'highpass', vol: .2 * vol, dur: .6, pan: v.pan });
  },
  // the brute: a roar and pounding feet
  charge(x, z) {
    const v = place(x, z, 35);
    voice({ f: 70, f2: 55, dur: 1.1, vol: .4 * v.v, pan: v.pan, band: 300, q: 1.5, vib: 6 });
    for (let i = 0; i < 6; i++) noise({ f: 120, type: 'lowpass', vol: .35 * v.v, dur: .12, delay: .1 + i * .19, pan: v.pan });
  },
  thud(x, z) {
    const v = place(x, z, 30);
    noise({ f: 90, type: 'lowpass', vol: .6 * v.v, dur: .5, pan: v.pan, f2: 40 }); tone({ f: 55, f2: 30, vol: .35 * v.v, dur: .5, pan: v.pan });
    noise({ f: 1800, type: 'bandpass', q: 1, vol: .2 * v.v, dur: .3, delay: .05, pan: v.pan });
  },
  slam() { noise({ f: 140, type: 'lowpass', vol: .6, dur: .4 }); tone({ f: 70, f2: 35, vol: .4, dur: .4 }); noise({ f: 2400, type: 'bandpass', q: .8, vol: .2, dur: .15 }); },
  grab() { for (let i = 0; i < 4; i++) noise({ f: R(700, 1400), type: 'bandpass', q: 1, vol: .2, dur: .1, delay: i * .12 }); voice({ f: 95, f2: 70, dur: .6, vol: .22, pan: 0, band: 500 }); },
  trip(x, z) { const v = place(x, z, 14); noise({ f: 160, type: 'lowpass', vol: .35 * v.v, dur: .25, pan: v.pan }); noise({ f: 120, type: 'lowpass', vol: .25 * v.v, dur: .2, delay: .25, pan: v.pan }); },
  vanish(x, z) { const v = place(x, z, 20); noise({ f: 1400, f2: 200, type: 'bandpass', q: 1.5, vol: .25 * v.v, dur: .8, pan: v.pan, a: .05 }); },
  // puzzles: a lock that will not give, a turning mechanism, steam, a heavy bolt sliding back
  rattle(x, z) { const v = place(x, z, 16); for (let i = 0; i < 5; i++) noise({ f: R(1800, 2600), type: 'bandpass', q: 5, vol: .22 * v.v, dur: .05, delay: i * .07, pan: v.pan }); noise({ f: 300, type: 'lowpass', vol: .2 * v.v, dur: .12, delay: .35, pan: v.pan }); },
  mechanism(x, z, kind) {
    const v = place(x, z, 14);
    if (kind === 'valve') { voice({ f: 520, f2: 380, dur: .7, vol: .12 * v.v, pan: v.pan, band: 1200, q: 6, vib: 4, type: 'square' }); noise({ f: 900, type: 'bandpass', q: 2, vol: .1 * v.v, dur: .5, pan: v.pan }); }
    else { noise({ f: 1400, type: 'bandpass', q: 1, vol: .14 * v.v, dur: .3, pan: v.pan, a: .05 }); noise({ f: 200, type: 'lowpass', vol: .15 * v.v, dur: .1, delay: .3, pan: v.pan }); }
  },
  steam(x, z) { const v = place(x, z, 30), vol = Math.max(.3, v.v); noise({ f: 3500, type: 'highpass', vol: .35 * vol, dur: 1.6, pan: v.pan, a: .02 }); noise({ f: 200, type: 'lowpass', vol: .3 * vol, dur: .4, pan: v.pan }); },
  unlock(x, z) { const v = place(x, z, 20); noise({ f: 700, type: 'bandpass', q: 3, vol: .3 * v.v, dur: .08, pan: v.pan }); noise({ f: 160, type: 'lowpass', vol: .35 * v.v, dur: .35, delay: .1, pan: v.pan }); voice({ f: 180, f2: 120, dur: 1.2, vol: .1 * v.v, pan: v.pan, band: 500, q: 8, vib: 1, type: 'square', delay: .3 }); },
  dial() { noise({ f: 3200, type: 'bandpass', q: 8, vol: .12, dur: .025 }); },
  // storm
  thunder() {
    const d = R(.1, .9);
    noise({ f: 2400, type: 'highpass', vol: .25, dur: .25, delay: d * .2 });
    noise({ f: 160, type: 'lowpass', vol: .6, dur: 3.2, delay: d, a: .3, f2: 50 });
    noise({ f: 70, type: 'lowpass', vol: .45, dur: 2.6, delay: d + .5, a: .5 });
  },
  // the generator coughing and dying
  generator() { for (let i = 0; i < 6; i++) noise({ f: 90 + i * 6, type: 'lowpass', vol: .3 * (1 - i / 7), dur: .18, delay: i * (.18 + i * .05) }); tone({ f: 60, f2: 25, vol: .15, dur: 1.4, delay: .2 }); },
  breath(x, z) { const v = place(x, z, 10); noise({ f: 600, type: 'bandpass', q: 1, vol: .12 * v.v, dur: .8, pan: v.pan, a: .3 }); },
  scream(x, z) {
    const v = place(x, z, 40);
    voice({ f: R(380, 480), f2: R(900, 1200), dur: 1.1, vol: .35 * v.v, pan: v.pan, band: 1400, q: 2, vib: 13, type: 'square' });
    voice({ f: R(520, 600), f2: R(1300, 1500), dur: 1.0, vol: .15 * v.v, pan: v.pan, band: 2000, q: 3, vib: 17, delay: .05 });
  },
  attack(x, z) { const v = place(x, z); noise({ f: 1200, type: 'bandpass', q: .8, vol: .3 * v.v, dur: .2, pan: v.pan }); voice({ f: R(90, 120), f2: 60, dur: .4, vol: .2 * v.v, pan: v.pan, band: 500 }); },
  wake(x, z) { const v = place(x, z, 16); for (let i = 0; i < 4; i++) noise({ f: R(1500, 3000), type: 'bandpass', q: 6, vol: .25 * v.v, dur: .03, delay: i * R(.06, .14), pan: v.pan }); voice({ f: 70, f2: 95, dur: 1.2, vol: .2 * v.v, pan: v.pan, band: 400, delay: .3 }); },
  hurt() { tone({ f: 95, f2: 38, vol: .7, dur: .32 }); noise({ f: 420, vol: .5, dur: .25 }); },
  knife() { noise({ f: 3500, type: 'highpass', vol: .25, dur: .12, f2: 1500 }); },
  boardBreak(x, z) { const v = place(x, z); noise({ f: 900, type: 'bandpass', q: 2.2, vol: .5 * v.v, dur: .16, pan: v.pan }); tone({ f: 220, f2: 110, type: 'triangle', vol: .3 * v.v, dur: .1, pan: v.pan }); },
  boardPlace(x, z) { const v = place(x, z); tone({ f: 190, type: 'triangle', vol: .35 * v.v, dur: .07, pan: v.pan }); tone({ f: 170, type: 'triangle', vol: .3 * v.v, dur: .07, delay: .11, pan: v.pan }); noise({ f: 1500, type: 'bandpass', q: 3, vol: .2 * v.v, dur: .04, delay: .11, pan: v.pan }); },
  buy() { noise({ f: 2500, type: 'bandpass', q: 4, vol: .15, dur: .04 }); tone({ f: 330, type: 'triangle', vol: .08, dur: .15, delay: .03 }); },
  deny() { tone({ f: 110, type: 'square', vol: .08, dur: .2, lp: 900 }); },
  pickup() { noise({ f: 1800, type: 'bandpass', q: 3, vol: .15, dur: .05 }); tone({ f: 260, type: 'triangle', vol: .06, dur: .2, delay: .04 }); },
  door(x, z) { const v = place(x, z, 40); noise({ f: 300, vol: .6 * v.v, dur: .5, pan: v.pan }); voice({ f: 120, f2: 70, dur: .8, vol: .15 * v.v, pan: v.pan, band: 900, q: 6, vib: 2, type: 'square' }); },
  objective() { [55, 58.3, 82.4].forEach((f, i) => tone({ f, type: 'sawtooth', vol: .12, dur: 2.6, delay: i * .1, a: .6, lp: 500 })); },
  power() { tone({ f: 40, f2: 120, type: 'sawtooth', vol: .4, dur: 2.5, lp: 400 }); noise({ f: 5000, type: 'highpass', vol: .3, dur: .4 }); for (let i = 0; i < 6; i++) noise({ f: 4000, type: 'highpass', vol: .15, dur: .03, delay: .3 + i * R(.1, .3) }); },
  radioUse() { noise({ f: 1900, type: 'bandpass', vol: .4, dur: 2.5, q: .7 }); for (let i = 0; i < 5; i++) voice({ f: R(160, 220), f2: R(140, 200), dur: .35, vol: .12, pan: 0, band: 1200, q: 3, vib: 5, type: 'square', delay: .6 + i * .4 }); },
  rescue() { tone({ f: 220, type: 'square', vol: .12, dur: 1.2, lp: 700 }); tone({ f: 277, type: 'square', vol: .1, dur: 1.2, lp: 700, delay: .05 }); noise({ f: 120, vol: .4, dur: 3, delay: .5 }); },
  escape() { [110, 165, 220, 330].forEach((f, i) => tone({ f, type: 'triangle', vol: .12, dur: 3, delay: i * .3, a: .5 })); },
  scare(kind, x, z) {
    const v = place(x, z, 30);
    if (kind === 'whisper') for (let i = 0; i < 6; i++) noise({ f: R(2500, 5000), type: 'bandpass', q: 8, vol: .12 * Math.max(.4, v.v), dur: R(.08, .2), delay: i * R(.12, .25), pan: v.pan });
    else if (kind === 'scream') voice({ f: R(500, 700), f2: R(250, 350), dur: 1.6, vol: .2, pan: v.pan, band: 1500, q: 2, vib: 9, type: 'square' });
    else if (kind === 'slam') { noise({ f: 250, vol: .7 * Math.max(.4, v.v), dur: .4, pan: v.pan }); tone({ f: 60, f2: 35, vol: .5 * Math.max(.4, v.v), dur: .3, pan: v.pan }); }
    else if (kind === 'steps') for (let i = 0; i < 5; i++) SFX.step('concrete', x + i * .4, z, false);
    else if (kind === 'lights') { noise({ f: 5000, type: 'highpass', vol: .35, dur: .1 }); tone({ f: 120, f2: 30, type: 'sawtooth', vol: .3, dur: 1.5, lp: 300 }); }
  },
  stalkerSpotted() { voice({ f: 60, f2: 45, dur: 2.5, vol: .35, pan: 0, band: 200, q: 3, vib: 2 }); noise({ f: 3000, type: 'bandpass', q: 5, vol: .25, dur: 1.5 }); },
  explode(x, z, big = 1) { const v = place(x, z, 60); noise({ f: 900, vol: .95 * v.v * big, dur: .9, f2: 80, pan: v.pan }); tone({ f: 60, f2: 22, vol: .9 * v.v * big, dur: .8, pan: v.pan }); },
  gas(x, z) { const v = place(x, z, 30); noise({ f: 300, vol: .7 * v.v, dur: .5, f2: 90, pan: v.pan }); noise({ f: 2500, type: 'bandpass', vol: .15 * v.v, dur: 1.8, delay: .2, pan: v.pan }); },
  nuke() { noise({ f: 300, vol: .9, dur: 2.2, f2: 60 }); tone({ f: 60, f2: 25, vol: .8, dur: 2 }); },
  lightning(x, z) { const v = place(x, z, 50); noise({ f: 4000, type: 'highpass', vol: .5 * Math.max(.3, v.v), dur: .25, pan: v.pan }); noise({ f: 200, vol: .7 * Math.max(.3, v.v), dur: 1.4, delay: .1, pan: v.pan }); },
  powerup() { [196, 247, 294].forEach((f, i) => tone({ f, type: 'triangle', vol: .1, dur: .6, delay: i * .12 })); },
  puSpawn(x, z) { const v = place(x, z, 30); tone({ f: 330, type: 'sine', vol: .08 * v.v, dur: .5, pan: v.pan }); },
  zap(x, z) { const v = place(x, z, 30); noise({ f: 3000, type: 'bandpass', q: 2, vol: .35 * v.v, dur: .1, pan: v.pan }); },
  down() { tone({ f: 200, f2: 60, vol: .5, dur: 1.2 }); noise({ f: 300, vol: .4, dur: .8 }); },
  revive() { tone({ f: 220, type: 'triangle', vol: .12, dur: .5 }); tone({ f: 330, type: 'triangle', vol: .1, dur: .5, delay: .15 }); },
  heartbeat() { tone({ f: 55, vol: .5, dur: .12 }); tone({ f: 50, vol: .4, dur: .14, delay: .2 }); },
  throwG() { noise({ f: 1500, type: 'bandpass', vol: .15, dur: .15 }); },
  rise(x, z) { const v = place(x, z, 25); noise({ f: 300, vol: .4 * v.v, dur: 1.2, pan: v.pan }); },
  flicker() { noise({ f: 5000, type: 'highpass', vol: .06, dur: .03 }); },
  ambient(kind, x, z) {
    const v = place(x, z, 30), vol = Math.max(.25, v.v);
    if (kind === 'drip') for (let i = 0; i < 3; i++) tone({ f: R(1400, 2200), f2: R(700, 1000), vol: .05 * vol, dur: .06, delay: i * R(.4, .9), pan: v.pan });
    else if (kind === 'clock') for (let i = 0; i < 8; i++) noise({ f: i % 2 ? 2600 : 2000, type: 'bandpass', q: 9, vol: .07 * vol, dur: .02, delay: i * .5, pan: v.pan });
    else if (kind === 'artillery') { noise({ f: 120, vol: .35, dur: 1.6, delay: .1, f2: 50 }); tone({ f: 40, f2: 25, vol: .25, dur: 1.4 }); }
    else if (kind === 'creak') voice({ f: R(90, 140), f2: R(60, 90), dur: .9, vol: .07 * vol, pan: v.pan, band: 700, q: 7, vib: 3, type: 'square' });
    else if (kind === 'rumble') { noise({ f: 90, type: 'lowpass', vol: .3 * vol, dur: 2.2, a: .6, pan: v.pan }); for (let i = 0; i < 8; i++) noise({ f: R(1500, 3500), type: 'bandpass', q: 3, vol: .05 * vol, dur: .05, delay: .8 + i * R(.08, .2), pan: v.pan }); }
    else if (kind === 'tap') for (let i = 0; i < 4; i++) noise({ f: 1800, type: 'bandpass', q: 6, vol: .09 * vol, dur: .04, delay: i * R(.9, 1.3), pan: v.pan });
    else if (kind === 'pipes') { tone({ f: 55, f2: 52, type: 'sawtooth', vol: .07 * vol, dur: 1.6, a: .3, lp: 220, pan: v.pan }); noise({ f: 3000, type: 'bandpass', q: 4, vol: .04 * vol, dur: .8, delay: .4, pan: v.pan }); }
    else if (kind === 'crow') voice({ f: 700, f2: 500, dur: .35, vol: .1 * vol, pan: v.pan, band: 1200, q: 2, vib: 30, type: 'square' });
    else if (kind === 'piano') tone({ f: [220, 233, 196][Math.random() * 3 | 0], type: 'triangle', vol: .05 * vol, dur: 2.2, a: .01, pan: v.pan });
  },
  crank(x, z) { const v = place(x, z, 60); for (let i = 0; i < 5; i++) { tone({ f: 38, f2: 30, type: 'sawtooth', vol: .3 * v.v, dur: .12, delay: i * .16, lp: 300, pan: v.pan }); noise({ f: 400, vol: .2 * v.v, dur: .1, delay: i * .16, pan: v.pan }); } },
  engine(x, z) { const v = place(x, z, 60); tone({ f: 46, f2: 48, type: 'sawtooth', vol: .25 * v.v, dur: 1.1, a: .1, lp: 260, pan: v.pan }); },
  locker(x, z) { const v = place(x, z, 20); noise({ f: 1400, type: 'bandpass', q: 5, vol: .3 * v.v, dur: .25, pan: v.pan }); tone({ f: 180, f2: 120, type: 'square', vol: .06 * v.v, dur: .3, lp: 900, pan: v.pan }); },
  lockerBang(x, z) { const v = place(x, z, 25); noise({ f: 500, vol: .7 * v.v, dur: .2, pan: v.pan }); tone({ f: 90, f2: 50, vol: .4 * v.v, dur: .2, pan: v.pan }); },
  page() { noise({ f: 3000, type: 'bandpass', q: 1, vol: .12, dur: .25 }); noise({ f: 2200, type: 'bandpass', q: 1, vol: .08, dur: .2, delay: .2 }); },
  sting() { voice({ f: 900, f2: 1600, dur: .7, vol: .18, pan: R(-.6, .6), band: 2200, q: 3, vib: 25, type: 'square' }); noise({ f: 6000, type: 'highpass', vol: .15, dur: .4 }); },
  heldBreath() { noise({ f: 500, type: 'bandpass', q: 1.2, vol: .07, dur: 1.4, a: .5 }); },
  intro() { tone({ f: 41, f2: 38, type: 'sawtooth', vol: .25, dur: 5, a: 1.5, lp: 200 }); noise({ f: 200, vol: .2, dur: 4, a: 1.5 }); },
  gameOver() { [98, 92.5, 87.3, 73.4].forEach((f, i) => tone({ f, type: 'sawtooth', vol: .15, dur: 1.4, delay: i * .5, a: .1, lp: 600 })); }
};
