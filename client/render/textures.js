// Procedural low-res textures. Everything is drawn on small canvases at load, nothing is downloaded.
import * as THREE from 'three';
import { R, rng } from '../../shared/util.js';

export function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function toTex(c, rep = true, mip = true) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = mip ? THREE.NearestMipmapNearestFilter : THREE.NearestFilter;
  if (!mip) t.generateMipmaps = false;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
function grain(g, w, h, amt, color = false, rnd = Math.random) {
  const d = g.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue;
    if (color) { a[i] += (rnd() - .5) * amt; a[i + 1] += (rnd() - .5) * amt; a[i + 2] += (rnd() - .5) * amt; }
    else { const n = (rnd() - .5) * amt; a[i] += n; a[i + 1] += n; a[i + 2] += n; }
  }
  g.putImageData(d, 0, 0);
}
function blotch(g, x0, y0, w, h, n, col, rmin, rmax, rnd = Math.random) {
  for (let i = 0; i < n; i++) { g.fillStyle = col; g.beginPath(); g.arc(x0 + rnd() * w, y0 + rnd() * h, rmin + rnd() * (rmax - rmin), 0, Math.PI * 2); g.fill(); }
}
function simple(size, base, amt, extra) {
  const c = mkCanvas(size, size), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  if (extra) extra(g, size);
  grain(g, size, size, amt);
  return toTex(c);
}
function crack(g, x, y, len, col) {
  g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
  for (let i = 0; i < len; i++) { x += R(-2, 2); y += R(0, 3); g.lineTo(x | 0, y | 0); }
  g.stroke();
}

function brick() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = '#2b2722'; g.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * 8;
    for (let col = -1; col < 5; col++) {
      const x = col * 16 + off, y = row * 8, k = R(.7, 1.12);
      g.fillStyle = rgb(108 * k, 52 * k, 38 * k); g.fillRect(x + 1, y + 1, 14, 6);
      if (Math.random() < .3) { g.fillStyle = rgb(62 * k, 44 * k, 36 * k); g.fillRect(x + 1 + (R(0, 9) | 0), y + 1, R(3, 6) | 0, 6); }
    }
  }
  blotch(g, 0, 0, 64, 64, 5, 'rgba(20,24,14,.25)', 3, 9);
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(14,18,8,.35)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  grain(g, 64, 64, 26);
  return toTex(c);
}
function plaster() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = rgb(118, 126, 108); g.fillRect(0, 0, 64, 64);
  blotch(g, 0, 0, 64, 64, 10, 'rgba(70,74,58,.25)', 3, 10);
  for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(50,46,30,.28)'; g.fillRect(R(0, 64) | 0, R(0, 30) | 0, R(1, 3) | 0, R(10, 40) | 0); }
  for (let i = 0; i < 3; i++) crack(g, R(0, 64), R(0, 40), 10, 'rgba(30,30,24,.7)');
  g.fillStyle = 'rgba(80,90,72,.6)'; g.fillRect(0, 44, 64, 20);
  g.fillStyle = 'rgba(30,34,26,.8)'; g.fillRect(0, 43, 64, 1);
  grain(g, 64, 64, 20);
  return toTex(c);
}
function wallpaper() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = rgb(44, 58, 46); g.fillRect(0, 0, 64, 64);
  // damask: rows of diamonds and dots
  for (let y = 0; y < 64; y += 16) for (let x = (y / 16 % 2) * 8; x < 64; x += 16) {
    g.fillStyle = 'rgba(96,110,78,.55)'; g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + 5, y + 8); g.lineTo(x, y + 14); g.lineTo(x - 5, y + 8); g.fill();
    g.fillStyle = 'rgba(20,26,20,.6)'; g.fillRect(x - 1, y + 7, 2, 2);
  }
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(30,26,16,.35)'; g.fillRect(R(0, 64) | 0, R(10, 40) | 0, R(2, 5) | 0, R(10, 24) | 0); }
  blotch(g, 0, 0, 64, 64, 6, 'rgba(70,64,40,.25)', 3, 9);
  const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(0,0,0,.2)'); gr.addColorStop(1, 'rgba(10,8,4,.35)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  grain(g, 64, 64, 18);
  return toTex(c);
}
function books() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = '#2a1a10'; g.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 4; row++) {
    let x = 1;
    while (x < 62) {
      const w = R(2, 5) | 0, h = R(10, 14) | 0, k = R(.5, 1);
      g.fillStyle = pick2([[110, 30, 24], [40, 60, 40], [70, 50, 30], [30, 40, 70], [120, 100, 60]], k);
      g.fillRect(x, row * 16 + 16 - h, w, h - 1); x += w + (Math.random() < .2 ? 2 : 0);
    }
    g.fillStyle = '#1a0e06'; g.fillRect(0, row * 16 + 15, 64, 2);
  }
  grain(g, 64, 64, 18);
  return toTex(c);
}
function pick2(list, k) { const c = list[Math.random() * list.length | 0]; return rgb(c[0] * k, c[1] * k, c[2] * k); }
function paint() {
  return simple(32, rgb(58, 20, 22), 18, g => { blotch(g, 0, 0, 32, 32, 6, 'rgba(90,50,20,.5)', 1, 4); g.fillStyle = 'rgba(200,190,170,.25)'; g.fillRect(0, 4, 32, 1); });
}
function tiles() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const k = R(.85, 1.05), alt = (x + y) % 2;
    g.fillStyle = alt ? rgb(150 * k, 156 * k, 140 * k) : rgb(96 * k, 118 * k, 112 * k);
    g.fillRect(x * 8, y * 8, 8, 8);
  }
  g.fillStyle = 'rgba(30,30,24,.7)'; for (let i = 0; i < 8; i++) { g.fillRect(i * 8, 0, 1, 64); g.fillRect(0, i * 8, 64, 1); }
  blotch(g, 0, 0, 64, 64, 8, 'rgba(40,34,20,.35)', 2, 8);
  grain(g, 64, 64, 18);
  return toTex(c);
}
function concrete() {
  return simple(64, rgb(84, 84, 80), 26, g => {
    blotch(g, 0, 0, 64, 64, 10, 'rgba(40,40,34,.3)', 2, 9);
    blotch(g, 0, 0, 64, 64, 3, 'rgba(10,10,8,.4)', 3, 7);
    for (let i = 0; i < 4; i++) crack(g, R(0, 64), R(0, 64), 8, 'rgba(20,20,18,.8)');
  });
}
// raw rock face for the mine: dark, layered, cracked, damp
function rock() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = rgb(52, 48, 44); g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 26; i++) { const k = R(.7, 1.25); g.fillStyle = rgb(60 * k, 55 * k, 50 * k); g.beginPath(); g.ellipse(R(0, 64), R(0, 64), R(4, 14), R(3, 9), R(0, 3), 0, Math.PI * 2); g.fill(); }
  g.fillStyle = 'rgba(20,18,16,.45)'; for (let y = 6; y < 64; y += R(9, 15)) g.fillRect(0, y | 0, 64, 1);   // strata
  g.strokeStyle = 'rgba(12,10,8,.8)'; g.lineWidth = 1;
  for (let i = 0; i < 6; i++) { g.beginPath(); let x = R(0, 64), y = R(0, 64); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += R(-8, 8); y += R(3, 9); g.lineTo(x, y); } g.stroke(); }
  blotch(g, 0, 0, 64, 64, 6, 'rgba(70,60,30,.25)', 2, 6);   // iron stains
  blotch(g, 0, 0, 64, 64, 5, 'rgba(10,14,16,.35)', 3, 8);   // damp
  grain(g, 64, 64, 30);
  return toTex(c);
}
function gravel() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = rgb(46, 42, 38); g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 220; i++) { const k = R(.6, 1.5); g.fillStyle = rgb(64 * k, 60 * k, 54 * k); g.fillRect(R(0, 64) | 0, R(0, 64) | 0, R(1, 4) | 0, R(1, 3) | 0); }
  blotch(g, 0, 0, 64, 64, 6, 'rgba(18,16,14,.4)', 3, 9);
  grain(g, 64, 64, 26);
  return toTex(c);
}
function stone() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = '#262420'; g.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 4; row++) {
    let x = -(row % 2) * 10;
    while (x < 64) {
      const w = R(12, 22) | 0, k = R(.75, 1.1);
      g.fillStyle = rgb(86 * k, 84 * k, 74 * k); g.fillRect(x + 1, row * 16 + 1, w - 2, 14);
      x += w;
    }
  }
  blotch(g, 0, 0, 64, 64, 8, 'rgba(30,44,20,.35)', 2, 6);
  grain(g, 64, 64, 28);
  return toTex(c);
}
function planks(f = 1) {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    const k = R(.78, 1.1) * f;
    g.fillStyle = rgb(86 * k, 60 * k, 38 * k); g.fillRect(i * 8, 0, 8, 64);
    for (let j = 0; j < 7; j++) { g.fillStyle = 'rgba(30,18,8,.35)'; g.fillRect(i * 8 + (R(1, 7) | 0), R(0, 64) | 0, 1, R(4, 16) | 0); }
    g.fillStyle = 'rgba(12,8,4,.85)'; g.fillRect(i * 8, 0, 1, 64); g.fillRect(i * 8, R(0, 64) | 0, 8, 1);
  }
  blotch(g, 0, 0, 64, 64, 4, 'rgba(10,6,2,.25)', 3, 8);
  grain(g, 64, 64, 22);
  return toTex(c);
}
function ground(green = 0) {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = green ? '#25281a' : '#2e2a20'; g.fillRect(0, 0, 64, 64);
  blotch(g, 0, 0, 64, 64, 18, green ? 'rgba(42,58,24,.7)' : 'rgba(48,52,30,.6)', 2, 7);
  blotch(g, 0, 0, 64, 64, 12, 'rgba(22,18,12,.6)', 2, 6);
  blotch(g, 0, 0, 64, 64, 30, 'rgba(70,64,48,.5)', .5, 1.5);
  grain(g, 64, 64, 34, true);
  return toTex(c);
}
function board() {
  const c = mkCanvas(64, 16), g = c.getContext('2d');
  g.fillStyle = rgb(124, 92, 58); g.fillRect(0, 0, 64, 16);
  for (let j = 0; j < 10; j++) { g.fillStyle = 'rgba(60,38,18,.45)'; g.fillRect(R(0, 60) | 0, R(1, 15) | 0, R(6, 22) | 0, 1); }
  g.fillStyle = 'rgba(30,18,8,.9)'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 15, 64, 1);
  g.fillStyle = '#1a1a1a'; [[3, 4], [3, 10], [59, 5], [59, 11]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
  grain(g, 64, 16, 22);
  return toTex(c);
}
function crate() {
  const c = mkCanvas(32, 32), g = c.getContext('2d');
  g.fillStyle = rgb(104, 78, 44); g.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(40,24,10,.6)'; g.fillRect(0, i * 8, 32, 1); }
  g.fillStyle = rgb(72, 52, 28); g.fillRect(0, 0, 32, 4); g.fillRect(0, 28, 32, 4); g.fillRect(0, 0, 4, 32); g.fillRect(28, 0, 4, 32);
  g.strokeStyle = rgb(72, 52, 28); g.lineWidth = 4; g.beginPath(); g.moveTo(3, 3); g.lineTo(29, 29); g.stroke();
  grain(g, 32, 32, 20);
  return toTex(c);
}
function panelTex(kind) {
  const c = mkCanvas(32, 32), g = c.getContext('2d');
  if (kind === 'trap') {
    for (let i = -32; i < 64; i += 8) { g.fillStyle = '#d0a020'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 4, 0); g.lineTo(i + 36, 32); g.lineTo(i + 32, 32); g.fill(); }
    g.fillStyle = '#222'; g.fillRect(8, 8, 16, 16);
    g.fillStyle = '#ffd040'; g.beginPath(); g.moveTo(17, 9); g.lineTo(11, 17); g.lineTo(15, 17); g.lineTo(13, 23); g.lineTo(21, 14); g.lineTo(17, 14); g.fill();
  } else {
    g.fillStyle = '#4a4c48'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#2a2c28'; g.fillRect(3, 3, 26, 26);
    g.fillStyle = '#ffd040'; g.beginPath(); g.moveTo(17, 5); g.lineTo(10, 15); g.lineTo(15, 15); g.lineTo(12, 26); g.lineTo(22, 12); g.lineTo(17, 12); g.fill();
  }
  grain(g, 32, 32, 16);
  return toTex(c, false);
}
export function signTex(name, price) {
  const c = mkCanvas(128, 48), g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k < 3; k++) {
    g.globalAlpha = k ? .35 : .95; g.fillStyle = '#ece6d4';
    const ox = k ? R(-1, 1) : 0, oy = k ? R(-1, 1) : 0;
    g.font = 'bold 15px "Courier New", monospace'; g.fillText(name, 64 + ox, 15 + oy);
    if (price) { g.font = 'bold 15px "Courier New", monospace'; g.fillText(price, 64 + ox, 35 + oy); }
  }
  g.globalAlpha = 1;
  return toTex(c, false, false);
}
export function labelTex(text, color) {
  const c = mkCanvas(128, 24), g = c.getContext('2d');
  g.font = 'bold 15px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(text, 65, 13);
  g.fillStyle = color; g.fillText(text, 64, 12);
  return toTex(c, false, false);
}
function moon() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, 'rgba(230,236,220,1)'); gr.addColorStop(.38, 'rgba(200,210,190,.95)'); gr.addColorStop(.45, 'rgba(120,140,130,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  blotch(g, 0, 0, 64, 64, 5, 'rgba(150,160,140,.4)', 2, 4);
  return toTex(c, false, false);
}
function flash() {
  const c = mkCanvas(32, 32), g = c.getContext('2d');
  g.translate(16, 16);
  for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.fillStyle = 'rgba(255,210,120,.9)'; g.beginPath(); g.moveTo(0, -3); g.lineTo(15, 0); g.lineTo(0, 3); g.fill(); }
  g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
  return toTex(c, false, false);
}
export function glowTex(r, gg, b) {
  const c = mkCanvas(32, 32), g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, rgb(r, gg, b, .95)); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return toTex(c, false, false);
}
export function bloodTex(seed) {
  const c = mkCanvas(64, 64), g = c.getContext('2d'), r = rng(seed);
  const blob = (x, y, rad, a) => { g.fillStyle = `rgba(${70 + r() * 30 | 0},${4 + r() * 6 | 0},${2 + r() * 4 | 0},${a})`; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); };
  blob(32, 32, 10 + r() * 6, .85);
  for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = 6 + r() * 20; blob(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 1 + r() * 5, .6 + r() * .3); }
  for (let i = 0; i < 4; i++) { const a = r() * Math.PI * 2; g.strokeStyle = 'rgba(70,6,3,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); g.stroke(); }
  return toTex(c, false);
}
function smoke() {
  const c = mkCanvas(32, 32), g = c.getContext('2d');
  for (let i = 0; i < 9; i++) { const gr = g.createRadialGradient(R(10, 22), R(10, 22), 0, 16, 16, R(8, 15)); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
  return toTex(c, false, false);
}
function powerup(kind) {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = '#9dff7a'; g.strokeStyle = '#9dff7a'; g.lineWidth = 4;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (kind === 'ammo') { for (let i = 0; i < 3; i++) { const x = 18 + i * 14; g.fillRect(x - 4, 24, 8, 26); g.beginPath(); g.arc(x, 24, 4, Math.PI, 0); g.fill(); } }
  else if (kind === 'double') { g.font = 'bold 34px Arial, sans-serif'; g.fillText('x2', 32, 34); }
  else if (kind === 'insta') { g.beginPath(); g.arc(32, 28, 16, 0, Math.PI * 2); g.fill(); g.fillRect(22, 36, 20, 14); g.fillStyle = '#000'; g.beginPath(); g.arc(25, 28, 5, 0, Math.PI * 2); g.arc(39, 28, 5, 0, Math.PI * 2); g.fill(); g.fillRect(27, 44, 2, 6); g.fillRect(31, 44, 2, 6); g.fillRect(35, 44, 2, 6); }
  else if (kind === 'carpenter') { g.fillRect(28, 26, 8, 30); g.fillRect(14, 14, 36, 14); g.fillStyle = '#000'; g.fillRect(40, 16, 6, 4); }
  else { g.beginPath(); g.arc(32, 32, 5, 0, Math.PI * 2); g.fill(); for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 - Math.PI / 2; g.beginPath(); g.moveTo(32, 32); g.arc(32, 32, 22, a - .5, a + .5); g.closePath(); g.fill(); } g.fillStyle = '#000'; g.beginPath(); g.arc(32, 32, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#9dff7a'; g.beginPath(); g.arc(32, 32, 5, 0, Math.PI * 2); g.fill(); }
  return toTex(c, false, false);
}
function sheet() {
  return simple(32, rgb(170, 172, 160), 16, g => { blotch(g, 0, 0, 32, 32, 4, 'rgba(110,100,60,.4)', 2, 6); blotch(g, 0, 0, 32, 32, 2, 'rgba(110,10,8,.6)', 2, 4); });
}

// ---------- character atlases (128x128) ----------
// Regions: head [0,0,64,48], jaw [0,48,64,16], torso [64,0,64,64], upperArm [0,64,32,64], forearm+hand [32,64,32,64], legs [64,64,64,64]
export const ATLAS = {
  head: [0, 0, 64, 48], jaw: [0, 48, 64, 16], torso: [64, 0, 64, 64], upper: [0, 64, 32, 64], fore: [32, 64, 32, 44], hand: [32, 108, 32, 20], legs: [64, 64, 64, 64],
  thigh: [64, 64, 64, 32], shin: [64, 96, 64, 32]
};
// [u0, v0, u1, v1]: v0 is where a body tube starts. The head and torso tubes run upwards from the
// neck and the hips, so the top of those painted regions (hair, collar) must land at the tube's end.
export function atlasUV(name) {
  const [x, y, w, h] = ATLAS[name];
  if (name === 'head' || name === 'torso') return [x / 128, 1 - (y + h) / 128, (x + w) / 128, 1 - y / 128];
  return [x / 128, 1 - y / 128, (x + w) / 128, 1 - (y + h) / 128];
}
const SKIN = {
  walker: [150, 152, 144], thin: [176, 174, 170], bloater: [158, 156, 118], soldier: [196, 156, 124],
  screamer: [168, 166, 160], brute: [138, 128, 118], weeper: [192, 190, 186]
};
// Random damage painted over a zombie atlas so no two look alike: hair, a peeled scalp,
// bandages, burns, a bite, holes torn in the clothes, blood down the chin and chest.
function zombieLayers(g, kind, rnd, skin, blood, rot) {
  const hair = rnd();
  if (hair < .3) { g.fillStyle = 'rgba(24,20,16,.9)'; g.fillRect(0, 0, 64, 12); for (let x = 0; x < 64; x += 1.5) g.fillRect(x, 10, 1, 4 + rnd() * 18); }   // long, matted
  else if (hair < .55) { g.fillStyle = 'rgba(40,32,24,.85)'; g.fillRect(0, 0, 64, 9); }
  if (rnd() < .3) { // scalp torn away, bone showing
    const x = rnd() * 40, w = 10 + rnd() * 14;
    g.fillStyle = 'rgba(110,16,10,.9)'; g.fillRect(x - 1, 0, w + 2, 10);
    g.fillStyle = '#cfc6a6'; g.fillRect(x, 0, w, 7);
  }
  if (rnd() < .3) { // bandage round the head
    g.fillStyle = 'rgba(196,188,162,.95)'; g.fillRect(0, 12, 64, 5);
    g.fillStyle = 'rgba(120,90,60,.5)'; for (let x = 0; x < 64; x += 5) g.fillRect(x, 12, 1, 5);
    blotch(g, 0, 12, 64, 5, 3, 'rgba(110,10,6,.7)', 1, 2.5, rnd);
  }
  if (rnd() < .5) { // blood down the chin onto the chest
    g.fillStyle = 'rgba(50,12,8,.65)';
    for (let i = 0; i < 5; i++) { const x = 41 + rnd() * 14; g.fillRect(x, 48, 1.2, 10 + rnd() * 6); g.fillRect(x + 64 + 48 - 48, 0, 1.4, 8 + rnd() * 26); }
    blotch(g, 100, 0, 24, 24, 6, blood, 1.5, 4, rnd);
  }
  if (rnd() < .35) { // a bite torn out of the neck and shoulder
    const x = 70 + rnd() * 50;
    g.fillStyle = 'rgba(70,6,4,.95)'; g.beginPath(); g.ellipse(x, 4, 7, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d8ccb0'; for (let t = 0; t < 6; t++) g.fillRect(x - 6 + t * 2.2, 1 + rnd() * 2, 1, 1.5);
  }
  if (rnd() < .3) { // burned: black char with raw edges
    const x = 64 + rnd() * 50, y = 64 + rnd() * 40, w = 12 + rnd() * 14, h = 10 + rnd() * 16;
    g.fillStyle = 'rgba(120,30,14,.8)'; g.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    g.fillStyle = 'rgba(14,10,8,.95)'; g.fillRect(x, y, w, h);
    blotch(g, x, y, w, h, 6, 'rgba(60,24,12,.8)', 1, 2.5, rnd);
  }
  if (kind !== 'thin' && rnd() < .55) { // holes torn in the shirt, skin and ribs beneath
    for (let i = 0; i < 1 + (rnd() * 3 | 0); i++) {
      const x = 68 + rnd() * 52, y = 8 + rnd() * 40, rx = 3 + rnd() * 6, ry = 2 + rnd() * 5;
      g.fillStyle = 'rgba(30,24,16,.9)'; g.beginPath(); g.ellipse(x, y, rx + 1, ry + 1, rnd() * 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = skin(.8); g.beginPath(); g.ellipse(x, y, rx, ry, rnd() * 3, 0, Math.PI * 2); g.fill();
      if (rnd() < .5) { g.fillStyle = '#d8d0b0'; for (let k = -ry + 1; k < ry; k += 2) g.fillRect(x - rx + 1, y + k, rx * 2 - 2, .8); }
      g.fillStyle = 'rgba(100,14,8,.7)'; g.fillRect(x - 1, y - 1, 2, 2);
    }
  }
  if (rnd() < .3) { // bandaged forearm, soaked through
    g.fillStyle = 'rgba(190,182,156,.95)'; g.fillRect(32, 76, 32, 22);
    g.fillStyle = 'rgba(120,96,70,.6)'; for (let y = 77; y < 98; y += 3) g.fillRect(32, y, 32, .7);
    blotch(g, 32, 80, 32, 16, 4, 'rgba(110,10,6,.8)', 1.5, 4, rnd);
  }
  // dirt and old blood everywhere, finer than the base pass
  blotch(g, 0, 0, 128, 128, 30, 'rgba(30,22,14,.18)', .5, 2, rnd);
  blotch(g, 0, 0, 128, 128, 10, 'rgba(90,8,5,.35)', .5, 1.5, rnd);
  void rot;
}

// What makes the three late arrivals recognisable at a glance.
function classLayers(g, kind, rnd, skin, blood) {
  if (kind === 'brute') {
    // a burlap sack tied over the head, two ragged eye holes
    g.fillStyle = rgb(118, 96, 64); g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 2) { g.fillStyle = 'rgba(60,44,24,.35)'; g.fillRect(0, y, 64, .6); }
    for (let x = 0; x < 64; x += 2) { g.fillStyle = 'rgba(160,136,96,.25)'; g.fillRect(x, 0, .6, 64); }
    g.fillStyle = '#080604'; g.beginPath(); g.ellipse(42, 20, 3.5, 2.5, .2, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(54, 21, 3, 2.5, -.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(40,28,14,.9)'; g.fillRect(0, 44, 64, 3);   // the rope at the neck
    blotch(g, 34, 26, 26, 26, 6, blood, 1.5, 4, rnd);
    // straitjacket: dirty canvas, straps across the chest with buckles, arms the same
    g.fillStyle = rgb(176, 168, 144); g.fillRect(64, 0, 64, 64); g.fillRect(0, 64, 64, 44);
    blotch(g, 64, 0, 64, 64, 14, 'rgba(90,70,40,.35)', 2, 6, rnd);
    blotch(g, 0, 64, 64, 44, 10, 'rgba(90,70,40,.35)', 2, 5, rnd);
    for (const y of [14, 30, 46]) {
      g.fillStyle = 'rgba(52,36,22,.95)'; g.fillRect(64, y, 64, 4);
      g.fillStyle = 'rgba(180,170,140,.95)'; g.fillRect(104, y - .5, 4, 5); g.fillStyle = '#2a2420'; g.fillRect(105, y + 1, 2, 2);
    }
    g.fillStyle = 'rgba(52,36,22,.95)'; g.fillRect(0, 96, 64, 4);
    blotch(g, 64, 0, 64, 64, 8, blood, 1.5, 5, rnd);
    g.fillStyle = skin(.8); g.fillRect(32, 108, 32, 20);
    g.fillStyle = rgb(70, 66, 58); g.fillRect(64, 64, 64, 48);
  } else if (kind === 'screamer') {
    // the mouth is torn open to the chest: a long dark hole lined with teeth
    g.fillStyle = '#1c0604'; g.fillRect(38, 30, 20, 34);
    g.fillStyle = '#d0c6a0'; for (let x = 39; x < 57; x += 2.5) { g.fillRect(x, 30, 1.4, 3); g.fillRect(x, 60, 1.4, 3); }
    g.fillStyle = 'rgba(110,10,6,.9)'; g.fillRect(36, 30, 2, 34); g.fillRect(58, 30, 2, 34);
    g.fillStyle = '#1c0604'; g.fillRect(36, 48, 24, 16);
    g.fillStyle = 'rgba(230,236,226,.95)'; g.fillRect(40.5, 17.5, 4, 3); g.fillRect(51.5, 17.5, 4, 3);   // wide white eyes
  } else if (kind === 'weeper') {
    // a hospital gown, and long black hair hanging over the face
    g.fillStyle = rgb(170, 178, 176); g.fillRect(64, 0, 64, 64); g.fillRect(0, 64, 32, 64); g.fillRect(64, 64, 64, 64);
    g.fillStyle = 'rgba(80,96,100,.35)'; for (let x = 64; x < 128; x += 6) for (let y = 0; y < 64; y += 6) g.fillRect(x + (y % 12 ? 3 : 0), y, 1.2, 1.2);
    blotch(g, 64, 0, 64, 64, 10, 'rgba(120,110,80,.35)', 2, 6, rnd);
    blotch(g, 96, 30, 30, 34, 8, blood, 1.5, 5, rnd);
    g.fillStyle = skin(.9); g.fillRect(64, 104, 64, 24);
    g.fillStyle = '#0c0a0a'; g.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 1) { g.fillStyle = `rgba(${30 + rnd() * 20},${26 + rnd() * 14},${24 + rnd() * 10},.9)`; g.fillRect(x, 0, .7, 40 + rnd() * 24); }
    g.fillStyle = skin(.85); g.fillRect(45, 30, 2, 18);   // a sliver of face between the strands
    g.fillStyle = 'rgba(200,204,196,.9)'; g.fillRect(45, 24, 2, 2);
    g.fillStyle = skin(.85); g.fillRect(32, 64, 32, 44);
    blotch(g, 32, 64, 32, 44, 6, 'rgba(100,100,120,.4)', 1, 3, rnd);
    g.fillStyle = 'rgba(90,8,6,.9)'; g.fillRect(36, 84, 22, 1.5); g.fillRect(38, 90, 18, 1.5);   // cuts along the wrists
  }
}

// ---------- the dead ----------
// Painted in 128-unit coordinates. Tubes wrap around: the front of the head, torso and legs is
// at u = .75 (x = 48 on the head, 112 on the torso and legs), the back at u = .25.
// Head and torso: top of the region = top of the body part. Limbs: top = shoulder / hip.
const shade = (g, x, y, w, h, top, bot) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, `rgba(0,0,0,${top})`); gr.addColorStop(1, `rgba(0,0,0,${bot})`); g.fillStyle = gr; g.fillRect(x, y, w, h); };
// darker toward the back and the sides of a wrapped region whose front is at fx
const wrapShade = (g, x, y, w, h, fx, a = .4) => {
  const gr = g.createLinearGradient(x, 0, x + w, 0), f = (fx - x) / w, b = (f + .5) % 1;
  const stops = [[0, Math.abs(0 - f) < .5 ? .5 : 1], [b, 1], [f, 0], [1, Math.abs(1 - f) < .5 ? .5 : 1]].sort((p, q) => p[0] - q[0]);
  for (const [o, k] of stops) gr.addColorStop(o, `rgba(0,0,0,${a * k})`);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
};
const soft = (g, x, y, rx, ry, inner, outer = 'rgba(0,0,0,0)') => {
  const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry)); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2); g.fill(); g.restore();
};
// an old bloodstain: dark brown rim, deeper red inside, runs below
function stain(g, x, y, r, rnd, runs = 3) {
  soft(g, x, y, r * 1.3, r, 'rgba(50,16,8,.45)');
  soft(g, x, y, r * .8, r * .6, 'rgba(66,14,8,.62)');
  for (let i = 0; i < runs; i++) { const rx = x + (rnd() - .5) * r * 1.4; g.fillStyle = 'rgba(64,12,6,.5)'; g.fillRect(rx, y, .9, r + rnd() * r * 2.5); }
}
function zombieAtlas(kind, seed, extra = {}) {
  const rnd = rng(seed * 7 + 3), [c, g] = atlasCanvas();
  const base = SKIN[kind] || SKIN.walker;
  // dead skin: grey, bluish, waxy yellow, the odd one with a green cast
  const tint = [[1, 1, 1], [.94, .97, 1.08], [1.05, 1.0, .88], [.9, .9, .96], [.92, 1.0, .9]][(seed * 3 + 1) % 5];
  const S = base.map((v, i) => v * tint[i] * .92);
  const skin = (k = 1, a = 1) => rgb(S[0] * k, S[1] * k, S[2] * k, a);
  const blood = 'rgba(54,14,8,.8)', rot = 'rgba(70,76,56,.45)';
  const veins = (x0, y0, w, h, n, a = .5) => {
    g.strokeStyle = `rgba(48,40,72,${a})`; g.lineWidth = .45;
    for (let i = 0; i < n; i++) { g.beginPath(); let x = x0 + rnd() * w, y = y0 + rnd() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - .5) * 3.5; y += (rnd() - .3) * 3; g.lineTo(x, y); } g.stroke(); }
  };
  const style = kind === 'walker' ? (extra.style || ['uniform', 'shirt', 'overalls', 'suit'][seed % 4]) : kind;
  const top = extra.uniform || [[74, 78, 64], [64, 66, 58], [86, 80, 62], [58, 62, 70]][seed % 4];
  const pants = extra.pants || [50, 52, 46];
  const cloth = (col, k = 1, a = 1) => rgb(col[0] * k, col[1] * k, col[2] * k, a);

  // ---- head: grey, mottled skin, veins, sunken or empty eyes, a lipless grin
  g.fillStyle = skin(); g.fillRect(0, 0, 64, 64);
  blotch(g, 0, 0, 64, 48, 10, rot, 2, 7, rnd);
  blotch(g, 0, 0, 64, 48, 7, 'rgba(70,46,80,.28)', 2, 6, rnd);   // bruising
  veins(28, 6, 10, 26, 6); veins(58, 6, 6, 26, 6); veins(36, 12, 24, 16, 5, .35); veins(30, 40, 36, 24, 8);   // temples, round the eyes, the throat
  wrapShade(g, 0, 0, 64, 64, 48, .5);
  shade(g, 0, 0, 64, 12, .3, 0);
  shade(g, 0, 36, 64, 28, 0, .35);
  const empty = rnd() < .5, noNose = rnd() < .45, tears = rnd() < .35;
  for (const ex of [42.5, 53.5]) {
    soft(g, ex, 20, 7.5, 6, 'rgba(6,3,3,1)', 'rgba(24,14,14,0)');
    if (empty) { soft(g, ex, 20.5, 3, 2.4, 'rgba(0,0,0,1)'); continue; }
    soft(g, ex, 20.5, 1.7, 1.3, 'rgba(176,180,162,.9)', 'rgba(140,140,120,.15)');
    soft(g, ex + (rnd() - .5) * .6, 20.5, .55, .55, 'rgba(96,100,90,.85)');
  }
  if (tears) for (const ex of [42.5, 53.5]) { g.fillStyle = 'rgba(92,10,8,.8)'; g.fillRect(ex - .4 + (rnd() - .5), 23, .9, 8 + rnd() * 10); }
  shade(g, 34, 12, 28, 5, .45, 0);   // a heavy shadow under the brow
  if (noNose) { soft(g, 48.2, 27, 2.8, 3.6, 'rgba(10,4,4,1)'); g.fillStyle = 'rgba(200,190,160,.6)'; g.fillRect(47.7, 24, 1, 1.5); }
  else { soft(g, 48.3, 26, 1.6, 4, 'rgba(0,0,0,.4)'); g.fillStyle = 'rgba(10,4,4,.9)'; g.fillRect(46.6, 29, 1.2, .9); g.fillRect(49.2, 29, 1.2, .9); }
  soft(g, 39.5, 31, 5, 6, 'rgba(0,0,0,.4)'); soft(g, 57.5, 31, 5, 6, 'rgba(0,0,0,.4)');   // hollow cheeks
  // the grin: no lips left, both rows of teeth bared to the gums
  soft(g, 48, 37.3, 10, 4.6, 'rgba(16,4,3,.98)', 'rgba(40,10,6,.35)');
  g.fillStyle = 'rgba(96,30,28,.9)'; g.fillRect(39, 33.6, 18, 1.1); g.fillRect(39.5, 40.6, 17, 1.1);   // gums
  for (let x = 39.4; x < 56.6; x += 1.45) {
    const col = () => rnd() < .25 ? '#7a6a3a' : rnd() < .5 ? '#bdb08a' : '#d2c6a0';
    if (rnd() > .15) { g.fillStyle = col(); g.fillRect(x, 34.6, 1.05, 2.2 + rnd() * 1.2); }
    if (rnd() > .2) { g.fillStyle = col(); g.fillRect(x + .3, 38.2 - rnd() * .8, 1.05, 2.1 + rnd()); }
  }
  for (let i = 0; i < 3; i++) { const x = 42 + rnd() * 12; g.fillStyle = 'rgba(70,10,6,.7)'; g.fillRect(x, 41, .8, 4 + rnd() * 12); }
  // skin torn away: raw muscle, a glimpse of bone
  if (rnd() < .45) {
    const spots = [[38, 31, 5, 4], [57, 31, 5, 4], [48, 9, 8, 4], [44, 44, 7, 3]], [fx, fy, rx, ry] = spots[(rnd() * spots.length) | 0];
    soft(g, fx, fy, rx + 1.5, ry + 1.5, 'rgba(60,20,14,.7)');
    soft(g, fx, fy, rx, ry, 'rgba(112,32,24,.95)', 'rgba(90,24,18,.8)');
    g.strokeStyle = 'rgba(60,14,10,.6)'; g.lineWidth = .4; for (let k = -ry; k < ry; k += 1.2) { g.beginPath(); g.moveTo(fx - rx * .8, fy + k); g.lineTo(fx + rx * .8, fy + k + .6); g.stroke(); }
    soft(g, fx + (rnd() - .5) * rx * .6, fy, rx * .35, ry * .3, 'rgba(206,196,168,.9)');
  }
  // jaw: chin and throat in shadow, old blood
  shade(g, 0, 48, 64, 16, .2, .4);
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(54,14,8,.7)'; g.fillRect(42 + rnd() * 12, 48, .8, 6 + rnd() * 9); }

  // ---- torso (top = collar, bottom = hips; front at x = 112, back at x = 80)
  const bare = kind === 'thin' || kind === 'screamer';
  g.fillStyle = bare ? skin(.95) : cloth(top); g.fillRect(64, 0, 64, 64);
  const sleeve = style === 'servant' || style === 'suit' ? [30, 30, 34] : style === 'overalls' ? [118, 112, 100] : top;
  if (!bare) {
    if (style === 'pyjamas') {
      for (let x = 64; x < 128; x += 5) { g.fillStyle = 'rgba(60,72,110,.45)'; g.fillRect(x, 0, 1.6, 64); }
      g.fillStyle = skin(.9); g.beginPath(); g.moveTo(104, 0); g.lineTo(120, 0); g.lineTo(112, 10); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,40,60,.6)'; g.lineWidth = .6; g.strokeRect(99, 16, 8, 7);
      for (let y = 13; y < 60; y += 9) soft(g, 112, y, .9, .9, 'rgba(230,226,210,.9)');
    } else if (style === 'gown') {
      for (let i = 0; i < 70; i++) soft(g, 64 + rnd() * 64, rnd() * 64, .6, .6, 'rgba(70,90,110,.5)');
      g.fillStyle = skin(.85); g.fillRect(76, 0, 8, 64);   // open at the back
      g.fillStyle = cloth(top, .7); for (const y of [10, 26, 42]) g.fillRect(73, y, 14, 1.2);
    } else if (style === 'coat') {
      g.strokeStyle = cloth(top, .55); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(103, 0); g.lineTo(110, 30); g.moveTo(121, 0); g.lineTo(114, 30); g.stroke();
      g.fillStyle = rgb(60, 70, 80); g.beginPath(); g.moveTo(106, 0); g.lineTo(118, 0); g.lineTo(112, 12); g.closePath(); g.fill();
      for (let y = 32; y < 62; y += 8) { soft(g, 109, y, .9, .9, 'rgba(40,40,40,.7)'); soft(g, 115, y, .9, .9, 'rgba(40,40,40,.7)'); }
      g.strokeStyle = cloth(top, .6); g.lineWidth = .6; g.strokeRect(97, 40, 8, 8); g.strokeRect(119, 40, 8, 8);
    } else if (style === 'servant') {
      g.fillStyle = rgb(196, 192, 180); g.fillRect(64, 0, 64, 64);   // shirt
      g.fillStyle = cloth(top); g.fillRect(98, 8, 28, 56); g.fillRect(64, 8, 28, 56);
      g.fillStyle = rgb(196, 192, 180); g.beginPath(); g.moveTo(104, 8); g.lineTo(120, 8); g.lineTo(112, 24); g.closePath(); g.fill();
      g.fillStyle = '#121212'; g.fillRect(108, 2, 8, 3);   // bow tie
      for (let y = 28; y < 60; y += 7) soft(g, 112, y, .8, .8, 'rgba(160,140,90,.9)');
    } else if (style === 'suit') {
      g.fillStyle = rgb(186, 182, 170); g.beginPath(); g.moveTo(104, 0); g.lineTo(120, 0); g.lineTo(112, 26); g.closePath(); g.fill();
      g.fillStyle = rgb(90, 20, 20); g.beginPath(); g.moveTo(110.5, 2); g.lineTo(113.5, 2); g.lineTo(114, 22); g.lineTo(112, 25); g.lineTo(110, 22); g.closePath(); g.fill();
      g.strokeStyle = cloth(top, .5); g.lineWidth = 1; g.beginPath(); g.moveTo(103, 0); g.lineTo(110, 28); g.moveTo(121, 0); g.lineTo(114, 28); g.stroke();
    } else if (style === 'overalls') {
      g.fillStyle = rgb(118, 112, 100); g.fillRect(64, 0, 64, 64);   // shirt underneath
      g.fillStyle = cloth(pants); g.fillRect(100, 14, 24, 50); g.fillRect(64, 40, 64, 24);
      g.fillRect(102, 0, 4, 14); g.fillRect(118, 0, 4, 14); g.fillRect(76, 0, 4, 40); g.fillRect(84, 0, 4, 40);
      soft(g, 104, 16, 1.2, 1.2, 'rgba(170,170,160,.95)'); soft(g, 120, 16, 1.2, 1.2, 'rgba(170,170,160,.95)');
      g.strokeStyle = cloth(pants, .6); g.lineWidth = .6; g.strokeRect(106, 22, 12, 9);
    } else if (style === 'shirt') {
      g.strokeStyle = 'rgba(30,22,16,.85)'; g.lineWidth = 1.6;   // braces
      g.beginPath(); g.moveTo(104, 0); g.lineTo(104, 64); g.moveTo(120, 0); g.lineTo(120, 64); g.moveTo(76, 0); g.lineTo(88, 64); g.moveTo(88, 0); g.lineTo(76, 64); g.stroke();
      g.fillStyle = skin(.9); g.beginPath(); g.moveTo(107, 0); g.lineTo(117, 0); g.lineTo(112, 7); g.closePath(); g.fill();
    } else {   // uniform
      for (let i = 0; i < 5; i++) soft(g, 108, 5 + i * 7, .9, .9, 'rgba(0,0,0,.5)');
      g.strokeStyle = cloth(top, .65); g.lineWidth = .6; g.strokeRect(97, 10, 8, 7); g.strokeRect(117, 10, 8, 7);
      if (extra.patch) { g.fillStyle = extra.patch; g.fillRect(68, 6, 10, 8); }
    }
    // belt at the hips for most
    if (style !== 'gown' && style !== 'coat' && style !== 'overalls') { g.fillStyle = 'rgba(25,20,14,.95)'; g.fillRect(64, 56, 64, 5); g.fillStyle = 'rgba(150,130,80,.9)'; g.fillRect(110, 56, 4, 5); }
    // folds, dirt rising from below, old blood
    for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(64 + rnd() * 64, rnd() * 20, .8, 20 + rnd() * 40); }
    blotch(g, 64, 36, 64, 28, 14, 'rgba(40,30,16,.3)', 1.5, 5, rnd);
    for (let i = 0; i < 1 + (rnd() * 3 | 0); i++) stain(g, 96 + rnd() * 30, 2 + rnd() * 30, 3 + rnd() * 4, rnd);
  } else {
    // ribs, sunken belly
    soft(g, 112, 40, 10, 16, 'rgba(40,20,20,.4)');
    for (let y = 8; y < 34; y += 4.5) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(98, y + 2, 28, 1.6); g.fillStyle = skin(1.15, .7); g.fillRect(98, y, 28, 1.6); }
    blotch(g, 64, 0, 64, 64, 10, rot, 2, 5, rnd);
  }
  wrapShade(g, 64, 0, 64, 64, 112, .4);
  shade(g, 64, 0, 64, 64, 0, .35);

  // ---- arms: sleeves to the elbow, forearms torn or rolled up
  g.fillStyle = bare ? skin(.9) : cloth(sleeve); g.fillRect(0, 64, 32, 64);
  if (style === 'pyjamas' && !bare) for (let x = 0; x < 32; x += 5) { g.fillStyle = 'rgba(60,72,110,.45)'; g.fillRect(x, 64, 1.6, 64); }
  blotch(g, 0, 64, 32, 64, 6, 'rgba(30,24,14,.35)', 1, 4, rnd);
  wrapShade(g, 0, 64, 32, 64, 24, .4); shade(g, 0, 64, 32, 64, 0, .3);
  const torn = bare || style === 'shirt' || style === 'overalls' || rnd() < .55;
  g.fillStyle = torn ? skin(.9) : cloth(sleeve); g.fillRect(32, 64, 32, 44);
  if (torn) {
    if (!bare) { g.fillStyle = cloth(sleeve); for (let x = 32; x < 64; x += 3) g.fillRect(x, 64, 3, 3 + rnd() * 9); }
    g.strokeStyle = 'rgba(60,40,80,.5)'; g.lineWidth = .5;
    for (let i = 0; i < 3; i++) { g.beginPath(); let x = 48 + (rnd() - .5) * 12, y = 76; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - .5) * 3; y += 6; g.lineTo(x, y); } g.stroke(); }
    if (rnd() < .5) stain(g, 40 + rnd() * 18, 82 + rnd() * 14, 2.5, rnd, 1);
  }
  wrapShade(g, 32, 64, 32, 44, 56, .35); shade(g, 32, 64, 32, 44, 0, .25);
  // hands: darker, dirt under the nails, blood
  g.fillStyle = skin(.72); g.fillRect(32, 108, 32, 20);
  g.fillStyle = '#1a120a'; for (let x = 33; x < 64; x += 4) g.fillRect(x, 125, 2, 3);
  blotch(g, 32, 108, 32, 20, 4, blood, 1, 3, rnd);

  // ---- legs: thigh (y 64..96) and shin with the feet (y 96..128)
  g.fillStyle = bare ? skin(.85) : cloth(pants); g.fillRect(64, 64, 64, 64);
  if (style === 'pyjamas' && !bare) for (let x = 64; x < 128; x += 5) { g.fillStyle = 'rgba(60,72,110,.45)'; g.fillRect(x, 64, 1.6, 64); }
  if (style === 'gown') { g.fillStyle = skin(.85); g.fillRect(64, 80, 64, 48); g.fillStyle = cloth(top); g.fillRect(64, 64, 64, 18); }
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(64 + rnd() * 64, 64 + rnd() * 20, .8, 10 + rnd() * 30); }
  wrapShade(g, 64, 64, 64, 32, 112, .35); wrapShade(g, 64, 96, 64, 32, 112, .35);
  shade(g, 64, 88, 64, 8, 0, .3);   // behind the knee
  if (rnd() < .5 && !bare) { const x = 70 + rnd() * 40; g.fillStyle = 'rgba(20,16,10,.95)'; g.beginPath(); g.ellipse(x, 90, 6, 4, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = skin(.8); g.beginPath(); g.ellipse(x, 90, 5, 3, 0, 0, Math.PI * 2); g.fill(); }   // a torn knee
  blotch(g, 64, 100, 64, 18, 12, 'rgba(40,30,16,.45)', 1.5, 5, rnd);   // mud
  const barefoot = rnd() < (style === 'gown' || style === 'pyjamas' ? .7 : .2) || bare;
  if (barefoot) { g.fillStyle = skin(.7); g.fillRect(64, 116, 64, 12); g.fillStyle = 'rgba(20,14,10,.6)'; for (let x = 66; x < 128; x += 5) g.fillRect(x, 125, 2, 3); }
  else { g.fillStyle = '#1c1812'; g.fillRect(64, 114, 64, 14); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(64, 116, 64, 1); }
  if (bare) { g.fillStyle = 'rgba(40,36,30,.9)'; g.fillRect(64, 64, 64, 12); }   // rags at the hips

  zombieLayers(g, kind, rnd, skin, blood, rot);
  if (kind === 'brute' || kind === 'screamer' || kind === 'weeper') {
    classLayers(g, kind, rnd, skin, blood);
    // shade what the class painted over, and dirty it
    wrapShade(g, 64, 0, 64, 64, 112, .4); shade(g, 64, 0, 64, 64, 0, .35);
    wrapShade(g, 0, 64, 32, 64, 24, .4); shade(g, 0, 64, 32, 64, 0, .3);
    wrapShade(g, 64, 64, 64, 64, 112, .35);
    blotch(g, 64, 30, 64, 34, 12, 'rgba(40,30,16,.3)', 1.5, 5, rnd);
  }
  if (kind === 'bloater') {
    // a swollen, waxy belly, veins, weeping sores
    soft(g, 112, 40, 20, 22, skin(1.15), skin(1, 0));
    g.strokeStyle = 'rgba(60,80,40,.6)'; g.lineWidth = .6;
    for (let i = 0; i < 5; i++) { g.beginPath(); let x = 100 + rnd() * 24, y = 28; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - .5) * 5; y += 4; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 9; i++) soft(g, 96 + rnd() * 32, 24 + rnd() * 36, 1.6, 1.6, 'rgba(190,180,90,.9)', 'rgba(110,40,20,.4)');
  }
  grain(g, 256, 256, 24, false, rnd);
  return toTex(c, false);
}

// Character atlases are painted in 128-unit coordinates on a 256 px canvas, so detail can go
// down to half a unit.
function atlasCanvas() { const c = mkCanvas(256, 256), g = c.getContext('2d'); g.scale(2, 2); return [c, g]; }
export function characterAtlas(kind, seed, extra = {}) {
  if (kind !== 'soldier') return zombieAtlas(kind, seed, extra);
  const rnd = rng(seed * 7 + 3), [c, g] = atlasCanvas();
  const base = SKIN[kind] || SKIN.walker;
  // the dead are not one colour: waxy pale, grey, bruised, bloated green
  const tint = kind === 'soldier' ? [1, 1, 1] : [[1, 1, 1], [1.12, 1.08, 1.12], [.92, .9, 1.02], [1.05, .95, .86], [.86, .96, .8]][(seed * 3 + 1) % 5];
  const S = base.map((v, i) => v * tint[i]);
  const skin = (k = 1) => rgb(S[0] * k, S[1] * k, S[2] * k);
  const rot = 'rgba(70,84,40,.55)', blood = 'rgba(96,8,5,.8)', dark = '#120c08';
  const zombie = kind !== 'soldier';
  const uni = extra.uniform || [[74, 78, 64], [64, 66, 58], [86, 80, 62], [58, 62, 70]][seed % 4];
  // head
  g.fillStyle = skin(); g.fillRect(0, 0, 64, 64);
  if (zombie) {
    blotch(g, 0, 0, 64, 48, 10, rot, 2, 6, rnd);
    blotch(g, 0, 0, 64, 48, 5, 'rgba(40,30,20,.5)', 1, 4, rnd);
    for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(60,40,70,.5)'; g.beginPath(); g.moveTo(rnd() * 64, rnd() * 48); g.lineTo(rnd() * 64, rnd() * 48); g.stroke(); }
    if (rnd() < .5) { g.fillStyle = '#c8c0a0'; g.beginPath(); g.arc(10 + rnd() * 20, 8 + rnd() * 10, 5, 0, Math.PI * 2); g.fill(); }
  } else {
    blotch(g, 0, 0, 64, 48, 4, 'rgba(150,110,90,.4)', 2, 5, rnd);
  }
  // hair / scalp at the top
  g.fillStyle = zombie ? 'rgba(30,26,20,.75)' : '#3a2a1c'; g.fillRect(0, 0, 64, zombie ? 6 : 12);
  // face centered at x=48 (front of the head tube)
  if (zombie) {
    g.fillStyle = dark; g.fillRect(39, 17, 7, 6); g.fillRect(50, 17, 7, 6);
    // milky, unfocused eyes deep in the sockets
    g.fillStyle = 'rgba(150,156,146,.75)'; g.fillRect(41.5, 19, 2.5, 1.5); g.fillRect(52, 19.5, 2.5, 1.5);
    g.fillStyle = 'rgba(200,206,196,.6)'; g.fillRect(42, 19.2, 1, .8); g.fillRect(53, 19.7, 1, .8);
    g.fillStyle = 'rgba(20,10,6,.7)'; g.fillRect(37, 14, 22, 2);
    g.fillStyle = '#2a1410'; g.fillRect(46, 25, 4, 6);
    g.fillStyle = blood; g.fillRect(41, 23, 1, 10); g.fillRect(55, 24, 1, 8);
    g.fillStyle = '#2a0805'; g.fillRect(40, 38, 16, 10);
    g.fillStyle = '#c8bf98'; for (let x = 41; x < 55; x += 3) g.fillRect(x, 38, 2, 3);
  } else {
    g.fillStyle = '#20160e'; g.fillRect(41, 19, 4, 3); g.fillRect(51, 19, 4, 3);
    g.fillStyle = 'rgba(120,70,50,.6)'; g.fillRect(47, 24, 2, 7); g.fillRect(43, 36, 10, 2);
  }
  // jaw
  g.fillStyle = skin(.9); g.fillRect(0, 48, 64, 16);
  if (zombie) {
    g.fillStyle = '#2a0805'; g.fillRect(38, 48, 20, 5);
    g.fillStyle = '#c8bf98'; for (let x = 40; x < 56; x += 3) g.fillRect(x, 49, 2, 3);
    g.fillStyle = blood; g.fillRect(42, 53, 2, 10); g.fillRect(50, 53, 1, 8);
  }
  // torso
  const bare = kind === 'thin' || kind === 'screamer';
  g.fillStyle = bare ? skin(.95) : rgb(...uni); g.fillRect(64, 0, 64, 64);
  if (bare || kind === 'bloater') {
    // exposed ribs and torn flesh
    const x0 = bare ? 64 : 64 + 20;
    if (kind === 'bloater') { g.fillStyle = skin(); g.fillRect(64 + 22, 24, 30, 40); blotch(g, 86, 26, 30, 36, 14, 'rgba(200,190,90,.8)', 1, 2.5, rnd); blotch(g, 86, 26, 30, 36, 6, rot, 2, 5, rnd); }
    if (bare) {
      g.fillStyle = 'rgba(90,20,14,.85)'; g.fillRect(92, 10, 24, 26);
      g.fillStyle = '#d8d0b0'; for (let y = 12; y < 34; y += 5) g.fillRect(93, y, 22, 2);
      g.fillStyle = '#d8d0b0'; g.fillRect(103, 10, 2, 26);
      blotch(g, 64, 0, 64, 64, 10, rot, 2, 5, rnd);
    }
    void x0;
  } else {
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(96 + 10, 4 + i * 8, 3, 3); }
    g.fillStyle = 'rgba(25,22,16,.95)'; g.fillRect(64, 50, 64, 5);
    g.fillStyle = 'rgba(170,150,90,.9)'; g.fillRect(108, 50, 5, 5);
    g.fillStyle = 'rgba(30,26,18,.5)'; g.fillRect(64 + 30, 0, 2, 50);
    if (zombie) {
      // tears revealing rotten skin and ribs
      for (let i = 0; i < 3; i++) {
        const tx = 70 + rnd() * 50, ty = 6 + rnd() * 36;
        g.fillStyle = skin(.8); g.beginPath(); g.ellipse(tx, ty, 4 + rnd() * 5, 3 + rnd() * 5, rnd() * 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(100,14,8,.8)'; g.fillRect(tx - 2, ty - 1, 4, 3);
      }
      blotch(g, 64, 0, 64, 64, 6, blood, 1, 4, rnd);
      blotch(g, 64, 0, 64, 64, 6, 'rgba(20,18,12,.4)', 2, 6, rnd);
    } else if (extra.patch) {
      g.fillStyle = extra.patch; g.fillRect(64 + 4, 6, 10, 8); g.fillRect(64 + 50, 6, 10, 8);
    }
  }
  // upper arms (sleeves)
  g.fillStyle = bare ? skin(.9) : rgb(...uni); g.fillRect(0, 64, 32, 64);
  if (zombie) blotch(g, 0, 64, 32, 64, 5, bare ? rot : 'rgba(20,18,12,.4)', 1, 4, rnd);
  // forearms: torn sleeve shows skin for most zombies
  const tornSleeve = zombie && (bare || rnd() < .6);
  g.fillStyle = tornSleeve ? skin(.92) : rgb(...uni); g.fillRect(32, 64, 32, 44);
  if (tornSleeve) {
    blotch(g, 32, 64, 32, 44, 6, rot, 1, 4, rnd);
    g.fillStyle = 'rgba(80,10,6,.8)'; g.fillRect(32 + rnd() * 24, 70 + rnd() * 30, 6, 3);
    if (!bare) { g.fillStyle = rgb(...uni); for (let x = 32; x < 64; x += 4) g.fillRect(x, 64, 4, 4 + rnd() * 8); }
  }
  // hands
  g.fillStyle = zombie ? skin(.75) : skin(); g.fillRect(32, 108, 32, 20);
  if (zombie) { g.fillStyle = '#1a120a'; for (let x = 33; x < 64; x += 5) g.fillRect(x, 124, 2, 4); g.fillStyle = blood; g.fillRect(36, 112, 20, 3); }
  // legs: trousers with boots at the bottom
  g.fillStyle = bare ? skin(.85) : extra.pants ? rgb(...extra.pants) : rgb(50, 52, 46); g.fillRect(64, 64, 64, 64);
  g.fillStyle = '#1c1812'; g.fillRect(64, 112, 64, 16);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(64, 110, 64, 2);
  if (zombie) {
    blotch(g, 64, 64, 64, 46, 5, 'rgba(20,18,12,.45)', 2, 6, rnd);
    if (rnd() < .6) { g.fillStyle = skin(.85); g.fillRect(70 + rnd() * 40, 88, 10, 8); g.fillStyle = blood; g.fillRect(74 + rnd() * 40, 92, 4, 6); }
    if (bare) { g.fillStyle = 'rgba(40,36,30,.9)'; g.fillRect(64, 64, 64, 14); }
  }
  if (zombie) zombieLayers(g, kind, rnd, skin, blood, rot);
  if (kind === 'brute' || kind === 'screamer' || kind === 'weeper') classLayers(g, kind, rnd, skin, blood);
  grain(g, 256, 256, 22, false, rnd);
  return toTex(c, false);
}
// The Matron: a nurse's cap, a surgical mask soaked through, milky eyes, and a long stained gown
// with a leather apron that reaches her ankles.
export function stalkerAtlas() {
  const rnd = rng(99), [c, g] = atlasCanvas();
  const blood = 'rgba(90,6,4,.85)', old = 'rgba(60,40,20,.35)';
  // grey, waxy skin
  g.fillStyle = rgb(150, 150, 140); g.fillRect(0, 0, 64, 64);
  blotch(g, 0, 0, 64, 64, 10, 'rgba(90,96,90,.4)', 2, 6, rnd);
  for (let i = 0; i < 8; i++) { g.strokeStyle = 'rgba(70,60,90,.45)'; g.lineWidth = .5; g.beginPath(); g.moveTo(rnd() * 64, rnd() * 40); g.lineTo(rnd() * 64, rnd() * 40); g.stroke(); }
  // white starched cap over the crown, its band across the forehead
  g.fillStyle = rgb(214, 210, 196); g.fillRect(0, 0, 64, 11);
  g.fillStyle = rgb(190, 186, 170); g.fillRect(0, 9, 64, 3);
  g.fillStyle = 'rgba(120,10,8,.9)'; g.fillRect(45, 2, 6, 2); g.fillRect(47, 0, 2, 6);   // a faded red cross
  blotch(g, 0, 0, 64, 11, 5, old, 1, 3, rnd);
  // sunken eyes: dark hollows with a milky glint
  g.fillStyle = '#1a1010'; g.fillRect(39, 17, 7, 5); g.fillRect(50, 17, 7, 5);
  g.fillStyle = rgb(200, 204, 196); g.fillRect(41.5, 18.5, 2, 2); g.fillRect(52.5, 18.5, 2, 2);
  g.fillStyle = 'rgba(40,10,10,.6)'; g.fillRect(40, 22, 1, 7); g.fillRect(55, 22, 1, 6);
  // surgical mask from the nose down, wrapping the jaw, soaked dark at the mouth
  g.fillStyle = rgb(160, 176, 170); g.fillRect(30, 26, 34, 22);
  g.fillStyle = 'rgba(80,96,90,.6)'; for (let y = 29; y < 47; y += 4) g.fillRect(30, y, 34, .7);
  g.fillStyle = 'rgba(70,4,2,.9)'; g.beginPath(); g.ellipse(48, 40, 8, 6, 0, 0, Math.PI * 2); g.fill();
  blotch(g, 40, 36, 16, 12, 6, blood, 1, 3, rnd);
  g.fillStyle = 'rgba(230,230,220,.8)'; g.fillRect(30, 30, 1, 1); g.fillRect(63, 30, 1, 1);   // ties
  g.fillStyle = rgb(150, 166, 160); g.fillRect(0, 48, 64, 16);
  blotch(g, 34, 48, 28, 16, 6, blood, 1, 3, rnd);
  for (let y = 52; y < 64; y += 2) { g.fillStyle = blood; g.fillRect(44 + rnd() * 6, y, 1, 2); }
  // gown: dirty off-white, with the apron down the front (front is centred at x=112)
  g.fillStyle = rgb(176, 172, 156); g.fillRect(64, 0, 64, 64);
  blotch(g, 64, 0, 64, 64, 14, old, 2, 6, rnd);
  g.fillStyle = 'rgba(40,30,20,.35)'; for (let x = 66; x < 128; x += 7) g.fillRect(x, 0, .7, 64);   // folds
  g.fillStyle = rgb(78, 54, 36); g.fillRect(100, 12, 24, 52);
  g.fillStyle = 'rgba(20,14,8,.9)'; g.fillRect(100, 12, 24, 1.5); g.fillRect(98, 30, 28, 1.5);
  blotch(g, 100, 18, 24, 46, 12, blood, 1.5, 5, rnd);
  for (let i = 0; i < 6; i++) { g.fillStyle = blood; g.fillRect(102 + rnd() * 20, 40 + rnd() * 10, .8, 8 + rnd() * 14); }
  // sleeves rolled to the elbow, bare grey forearms, black rubber gloves
  g.fillStyle = rgb(176, 172, 156); g.fillRect(0, 64, 32, 64);
  blotch(g, 0, 64, 32, 64, 6, old, 1, 4, rnd);
  g.fillStyle = rgb(146, 146, 136); g.fillRect(32, 64, 32, 44);
  g.fillStyle = rgb(176, 172, 156); g.fillRect(32, 64, 32, 6);
  blotch(g, 32, 70, 32, 38, 6, 'rgba(70,76,60,.5)', 1, 3, rnd);
  g.fillStyle = '#141414'; g.fillRect(32, 96, 32, 32);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(36, 100, 3, 20);
  blotch(g, 32, 104, 32, 24, 5, blood, 1, 3, rnd);
  // long skirt of the gown (legs and the skirt both map here), the hem dragged through blood
  g.fillStyle = rgb(168, 164, 148); g.fillRect(64, 64, 64, 64);
  g.fillStyle = 'rgba(40,30,20,.35)'; for (let x = 66; x < 128; x += 6) g.fillRect(x, 64, .8, 64);
  blotch(g, 64, 64, 64, 48, 12, old, 2, 6, rnd);
  g.fillStyle = 'rgba(70,6,4,.8)'; g.fillRect(64, 112, 64, 10);
  for (let x = 64; x < 128; x += 2) { g.fillStyle = blood; g.fillRect(x, 104 + rnd() * 8, 1.5, 8); }
  g.fillStyle = '#100c08'; g.fillRect(64, 122, 64, 6);
  grain(g, 256, 256, 20, false, rnd);
  return toTex(c, false);
}
export function itemTex(kind) {
  const c = mkCanvas(32, 32), g = c.getContext('2d');
  if (kind === 'medkit') { g.fillStyle = '#d8d4c8'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#a01810'; g.fillRect(12, 5, 8, 22); g.fillRect(5, 12, 22, 8); }
  else if (kind === 'ammo') { g.fillStyle = '#4a5228'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#d8c890'; g.fillRect(4, 12, 24, 7); g.fillStyle = '#2a2a18'; g.font = 'bold 7px monospace'; g.fillText('AMMO', 7, 18); }
  else if (kind === 'note') { g.fillStyle = '#cfc6a8'; g.fillRect(0, 0, 32, 32); g.fillStyle = 'rgba(40,30,20,.75)'; for (let y = 5; y < 29; y += 3) g.fillRect(4, y, 18 + (Math.random() * 8 | 0), 1); g.fillStyle = 'rgba(90,10,6,.5)'; g.fillRect(20, 20, 6, 5); }
  else if (kind === 'locker') { g.fillStyle = '#4a5048'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#141614'; for (let y = 3; y < 11; y += 2) g.fillRect(6, y, 20, 1); g.fillStyle = 'rgba(90,60,30,.6)'; for (let i = 0; i < 6; i++) g.fillRect(Math.random() * 30 | 0, Math.random() * 32 | 0, 3, 2); g.fillStyle = '#2a2c28'; g.fillRect(24, 15, 3, 5); }
  else if (kind === 'fuel') { g.fillStyle = '#6a1a12'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#3a0c08'; g.fillRect(4, 4, 24, 2); g.fillRect(4, 26, 24, 2); g.beginPath(); g.moveTo(6, 8); g.lineTo(26, 24); g.lineTo(26, 26); g.lineTo(6, 10); g.fill(); }
  else if (kind === 'fuse') { g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#b07030'; g.fillRect(0, 0, 32, 6); g.fillRect(0, 26, 32, 6); g.fillStyle = '#403028'; g.fillRect(8, 12, 16, 8); }
  else { g.fillStyle = '#383838'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#c0a040'; g.fillRect(0, 0, 32, 6); }
  grain(g, 32, 32, 14);
  return toTex(c, false);
}
export function dogAtlas() {
  const c = mkCanvas(64, 64), g = c.getContext('2d'), e = mkCanvas(64, 64), ge = e.getContext('2d');
  g.fillStyle = '#1e1612'; g.fillRect(0, 0, 64, 64);
  blotch(g, 0, 0, 64, 64, 20, 'rgba(60,30,18,.6)', 1, 4);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 16; i++) {
    let x = R(0, 64), y = R(0, 64);
    for (const ctx of [g, ge]) { ctx.strokeStyle = ctx === g ? '#ff7a20' : '#ff6a10'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); }
    for (let k = 0; k < 6; k++) { x += R(-4, 4); y += R(-4, 4); g.lineTo(x, y); ge.lineTo(x, y); }
    g.stroke(); ge.stroke();
  }
  grain(g, 64, 64, 20);
  return { map: toTex(c, false), emissive: toTex(e, false) };
}

export function makeTextures() {
  return {
    rug: simple(32, rgb(90, 24, 22), 18, g => { g.strokeStyle = 'rgba(200,160,80,.5)'; g.strokeRect(3, 3, 26, 26); g.strokeRect(7, 7, 18, 18); blotch(g, 0, 0, 32, 32, 3, 'rgba(20,10,6,.4)', 2, 5); }),
    rock: rock(), gravel: gravel(), brick: brick(), plaster: plaster(), tiles: tiles(), concrete: concrete(), stone: stone(), wallpaper: wallpaper(), books: books(), paint: paint(),
    floor: planks(1), ceil: planks(.45), ground: ground(0), grass: ground(1), board: board(), crate: crate(), sheet: sheet(),
    metal: simple(32, rgb(54, 56, 60), 18, g => { g.fillStyle = 'rgba(140,140,150,.35)'; for (let i = 0; i < 5; i++) g.fillRect(R(0, 32) | 0, R(0, 32) | 0, R(3, 10) | 0, 1); }),
    metalDark: simple(32, rgb(30, 31, 34), 14, g => { g.fillStyle = '#0b0b0c'; for (let y = 3; y < 32; y += 6) for (let x = 3; x < 32; x += 7) g.fillRect(x, y, 3, 3); }),
    rust: simple(32, rgb(84, 54, 36), 30, g => blotch(g, 0, 0, 32, 32, 8, 'rgba(40,30,20,.6)', 1, 5)),
    gwood: simple(32, rgb(98, 56, 30), 18, g => { for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(50,24,10,.5)'; g.fillRect(0, R(0, 32) | 0, 32, 1); } }),
    grip: simple(32, rgb(60, 36, 22), 22, g => { g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < 32; y += 3) g.fillRect(0, y, 32, 1); }),
    trapPanel: panelTex('trap'), powerPanel: panelTex('power'),
    items: { medkit: itemTex('medkit'), ammo: itemTex('ammo'), fuse: itemTex('fuse'), battery: itemTex('battery'), note: itemTex('note'), locker: itemTex('locker'), fuel: itemTex('fuel') },
    blood: [1, 2, 3, 4].map(i => bloodTex(i + 10)),
    moon: moon(), flash: flash(), glow: glowTex(140, 255, 110), glowWhite: glowTex(255, 240, 210), glowEye: glowTex(255, 170, 40), glowBlue: glowTex(120, 200, 255), glowPurple: glowTex(200, 110, 255),
    smoke: smoke(),
    bark: simple(32, rgb(40, 34, 28), 30, g => { for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(10,8,6,.6)'; g.fillRect(R(0, 32) | 0, 0, 1, 32); } }),
    sandbag: simple(32, rgb(104, 94, 66), 26, g => { g.fillStyle = 'rgba(40,34,20,.6)'; g.fillRect(0, 15, 32, 2); }),
    pu: { ammo: powerup('ammo'), insta: powerup('insta'), double: powerup('double'), nuke: powerup('nuke'), carpenter: powerup('carpenter') }
  };
}
