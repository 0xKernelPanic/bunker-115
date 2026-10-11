// DOM heads-up display. Text is only touched when it changes.
import { wdef } from '../shared/weapons.js';
import { R } from '../shared/util.js';

const $ = id => document.getElementById(id);
const cache = {};
function setText(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }
function setHTML(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).innerHTML = v; } }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const HUD = {
  show(on) { $('hud').hidden = !on; },
  reset() { for (const k in cache) delete cache[k]; $('pops').innerHTML = ''; $('notes').innerHTML = ''; },
  points(n) { setText('score', String(n)); },
  pop(n, big) {
    const el = document.createElement('div'); el.className = 'pop' + (big ? ' big' : '');
    el.textContent = (n > 0 ? '+' : '') + n; el.style.right = (R(-10, 30) | 0) + 'px';
    $('pops').appendChild(el); setTimeout(() => el.remove(), 1000);
  },
  ammo(w, mag, res, grenades) {
    if (!w) { setText('mag', '-'); setText('res', '-'); setText('wname', ''); return; }
    const d = wdef(w.id);
    setText('mag', String(mag)); setText('res', String(res)); setText('wname', d.name);
    $('ammo').classList.toggle('low', mag <= Math.ceil(d.mag * .25));
    setText('gren', '●'.repeat(grenades) + '○'.repeat(Math.max(0, 4 - grenades)));
  },
  objective(text, flash) {
    setText('objText', text);
    if (flash) { const o = $('objective'); o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash'); }
  },
  battery(level, on) {
    const bars = Math.ceil(level * 4);
    setHTML('bat', `<span class="${on ? 'on' : ''}">${'▮'.repeat(bars)}<i>${'▮'.repeat(4 - bars)}</i></span>`);
    $('bat').classList.toggle('empty', level <= 0);
  },
  prompt(text, deny) {
    setText('prompt', text || '');
    $('prompt').classList.toggle('deny', !!deny);
  },
  announce(text, cls = '') {
    const a = $('announce'); a.textContent = text; a.className = 'hud ' + cls;
    void a.offsetWidth; a.classList.add('show');
  },
  note(text) {
    const el = document.createElement('div'); el.className = 'note-line'; el.textContent = text;
    $('notes').appendChild(el); setTimeout(() => el.remove(), 5000);
    while ($('notes').children.length > 4) $('notes').firstChild.remove();
  },
  team(players, meId) {
    const html = players.filter(p => p.id !== meId).map(p => {
      const st = p.st === 'd' ? '<span class="st down">down</span>' : p.st === 'x' ? '<span class="st dead">dead</span>' : p.st === 'e' ? '<span class="st out">escaped</span>' : '';
      return `<div class="mate"><i style="background:${p.color}"></i><span class="nm">${esc(p.name)}</span><span class="pt">${p.pts}</span>${st}</div>`;
    }).join('');
    setHTML('team', html);
  },
  powerups(insta, dbl) {
    let h = '';
    if (insta > 0) h += `<div class="pu"><b>☠</b>${Math.ceil(insta)}</div>`;
    if (dbl > 0) h += `<div class="pu"><b>x2</b>${Math.ceil(dbl)}</div>`;
    setHTML('pups', h);
  },
  bar(label, frac) {
    const b = $('bar');
    if (frac === null || frac === undefined) { b.hidden = true; return; }
    b.hidden = false; setText('barLabel', label); $('barFill').style.width = Math.round(frac * 100) + '%';
  },
  down(text) { const d = $('downMsg'); d.hidden = !text; if (text) setText('downMsg', text); },
  crosshair(gap, hide) {
    const c = $('cross'); c.style.opacity = hide ? 0 : 1;
    const [t, b, l, r] = c.children;
    t.style.top = (-gap - 8) + 'px'; b.style.top = gap + 'px'; l.style.left = (-gap - 8) + 'px'; r.style.left = gap + 'px';
  },
  hit(kill) { const h = $('hit'); h.classList.toggle('kill', kill); h.style.opacity = 1; clearTimeout(this._ht); this._ht = setTimeout(() => { h.style.opacity = 0; }, 140); }
};
