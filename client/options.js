// Player settings, best times and which hints were already shown. All kept in localStorage,
// all optional: the game runs with the defaults when storage is unavailable.
const KEY = 'b115-options';
const DEF = { vol: .75, music: 1, bright: 1, fov: 72, sens: 1.2, invert: 0, res: 256, fear: 1, tips: 1, fps: 0, captions: 0, diff: 'normal' };

function read(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

export const opts = Object.assign({}, DEF, read(KEY, {}));
export function saveOpts() { write(KEY, opts); }

// Wire the settings screen inputs to `opts`; onChange runs after every edit.
export function bindSettings(onChange) {
  const map = { setVol: 'vol', setMusic: 'music', setBright: 'bright', setFov: 'fov', sens: 'sens', setInvert: 'invert', setRes: 'res', setFear: 'fear', setTips: 'tips', setFps: 'fps', setCaptions: 'captions' };
  for (const id in map) {
    const el = document.getElementById(id), k = map[id];
    if (!el) continue;
    el.value = opts[k];
    el.addEventListener('input', () => { opts[k] = Number(el.value); saveOpts(); onChange(k); });
  }
}

export const records = {
  get(map, diff) { return read('b115-rec', {})[map + ':' + diff] ?? null; },
  // keeps the fastest escape
  set(map, diff, secs) {
    const all = read('b115-rec', {}), k = map + ':' + diff;
    if (all[k] === undefined || secs < all[k]) { all[k] = Math.round(secs); write('b115-rec', all); return true; }
    return false;
  }
};

export const hints = {
  seen(k) { return !!read('b115-hints', {})[k]; },
  mark(k) { const all = read('b115-hints', {}); all[k] = 1; write('b115-hints', all); }
};

// every document ever read, on any night (for the ending of the last night)
export const docs = {
  add(ids) { const all = read('b115-docs', {}); for (const id of ids) all[id] = 1; write('b115-docs', all); },
  all() { return read('b115-docs', {}); }
};

export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
