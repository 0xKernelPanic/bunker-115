// What a player standing at (p.x, p.z) can press F on. The client uses it for the prompt,
// the simulation uses the same answer to perform the action, so they never disagree.
import { WEAPONS } from './weapons.js';
import { front } from './puzzles.js';
import { zoneAt } from './world.js';

export const ITEM_NAMES = { fuse: 'fuse', key: 'key', battery: 'battery', medkit: 'first aid kit', ammo: 'ammunition', grenade: 'grenade', fuel: 'fuel can', carkey: 'car keys', dynamite: 'dynamite', detonator: 'blasting machine', handwheel: 'valve handwheel' };
export const KEY_NAMES = { morgue: 'Morgue key', study: 'study key', foreman: "foreman's key", lab: 'laboratory key' };

export function objective(map, W) { return map.objectives[W.obj.i] || null; }

export function findInteract(world, W, p) {
  const map = world.map, powered = !map.hasPower || W.power;
  const obj = objective(map, W);
  if (p.hid) return { kind: 'unhide', text: 'F  Leave the locker' };
  let best = null, bd = 1e9;
  const consider = (x, z, r, make) => {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d >= r || d >= bd) return;
    const res = make(); if (!res) return;
    bd = d; best = res;
  };
  for (const it of W.items) {
    consider(it.x, it.z, 1.3, () => {
      if (it.kind === 'weapon') {
        const own = p.w.some(w => w.id === it.w);
        return { kind: 'item', id: it.id, text: own ? `F  Take ammo for the ${WEAPONS[it.w].name}` : `F  Take the ${WEAPONS[it.w].name}` };
      }
      if (it.kind === 'medkit' && p.hp >= p.mhp) return { kind: 'none', text: 'First aid kit (you are not hurt)' };
      if (it.kind === 'note' || it.kind === 'clue' || it.kind === 'secret') return { kind: 'item', id: it.id, text: `F  Read: ${it.title}` };
      if (it.kind === 'key') return { kind: 'item', id: it.id, text: `F  Take the ${KEY_NAMES[it.key] || 'key'}` };
      return { kind: 'item', id: it.id, text: `F  Pick up the ${ITEM_NAMES[it.kind]}` };
    });
  }
  for (const h of map.hides || []) {
    consider(h.x + h.nx * .75, h.z + h.nz * .75, 1.2, () => W.hides[h.id] ? { kind: 'none', text: 'Someone is hiding in there' } : { kind: 'hide', id: h.id, text: 'F  Hide in the locker' });
  }
  for (const id in world.doors) {
    const d = world.doors[id];
    if (W.doors[id] || d.locked) continue;
    consider(d.x, d.z, 2.3, () => {
      if (d.key) return W.keys[d.key] ? { kind: 'door', id, cost: 0, text: `F  Unlock: ${d.label}` } : { kind: 'none', text: `Locked. You need the ${KEY_NAMES[d.key] || 'key'}.` };
      return { kind: 'door', id, cost: d.cost, text: `F  Open: ${d.label} [${d.cost}]` };
    });
  }
  (map.wallBuys || []).forEach((wb, i) => {
    consider(wb.x + wb.nx * .6, wb.z + wb.nz * .6, 1.5, () => {
      const own = p.w.find(w => w.id === wb.w), name = WEAPONS[wb.w].name;
      const cost = own ? Math.round(wb.cost / 2) : wb.cost;
      return { kind: 'wall', id: i, cost, text: own ? `F  Ammo: ${name} [${cost}]` : `F  Buy ${name} [${cost}]` };
    });
  });
  if (map.fusebox && !W.power) consider(map.fusebox.x + map.fusebox.nx * .7, map.fusebox.z + map.fusebox.nz * .7, 1.6, () => {
    if (W.fuses >= 3) return { kind: 'fusebox', text: 'F  Insert the fuses and restore power' };
    return { kind: 'none', text: `Fuse box. ${W.fuses}/3 fuses found.` };
  });
  if (map.radio) consider(map.radio.x + map.radio.nx * .8, map.radio.z + map.radio.nz * .8, 1.6, () => {
    if (obj && obj.id === 'radio') return { kind: 'radio', text: 'F  Use the radio' };
    if (!powered) return { kind: 'none', text: 'The radio is dead. No power.' };
    return null;
  });
  // map-specific places an objective asks you to use (the car in the garage)
  if (obj && obj.id === 'use') {
    const sp = (map.spots || []).find(q => q.id === obj.spot);
    if (sp) consider(sp.x, sp.z, sp.r || 1.8, () => ({ kind: 'useSpot', text: `F  ${obj.prompt}` }));
  }
  // safes, lockers and the switches that open hidden stashes
  for (const pz of map.puzzles || []) {
    const st = W.puzzles && W.puzzles[pz.id]; if (!st || st.open) continue;
    if (pz.type === 'code') {
      const f = front(pz.stash);
      consider(f.x, f.z, 1.3, () => st.cd > 0 ? { kind: 'none', text: 'The handle will not turn. Wait.' } : { kind: 'code', id: pz.id, text: `F  Try a combination on the ${pz.stash.kind === 'safe' ? 'safe' : 'lock'}` });
    } else {
      const f = front(pz.stash);
      consider(f.x, f.z, 1.2, () => ({ kind: 'none', text: pz.stash.kind === 'shelf' ? 'A heavy bookcase. Something behind it?' : 'Locked tight. There is no keyhole.' }));
      pz.switches.forEach((sw, i) => {
        const g = front(sw, .6);
        consider(g.x, g.z, .8, () => ({ kind: 'switch', id: pz.id, i, text: sw.model === 'book' ? `F  Pull the ${sw.label}` : `F  Turn the ${sw.label}` }));
      });
    }
  }
  (map.traps || []).forEach(tr => {
    consider(tr.sx + tr.snx * .6, tr.sz + tr.snz * .6, 1.5, () => {
      const ts = W.traps[tr.id] || { a: 0, cd: 0 };
      if (!powered) return { kind: 'none', text: 'Electric trap. No power.' };
      if (ts.a > 0) return null;
      if (ts.cd > 0) return { kind: 'none', text: 'The trap is recharging' };
      return { kind: 'trap', id: tr.id, cost: tr.cost, text: `F  Electric trap [${tr.cost}]` };
    });
  });
  return best;
}

// Downed teammate within reach, for the hold-F revive.
export function findRevive(players, p) {
  let best = null, bd = 1.7;
  for (const o of players) {
    if (o.id === p.id || o.st !== 'd') continue;
    const d = Math.hypot(o.x - p.x, o.z - p.z);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// Damaged barricade within reach, for the hold-F repair.
export function findRepair(world, W, p) {
  let best = null, bd = 1.9;
  for (const w of world.windows) {
    if ((W.boards[w.id] ?? 6) >= 6) continue;
    const d = Math.hypot(w.inX - p.x, w.inZ - p.z);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

// Things the objectives ask for. They glint more strongly than ordinary supplies.
export const QUEST_KINDS = new Set(['fuse', 'fuel', 'carkey', 'key', 'dynamite', 'detonator', 'handwheel']);
const zoneName = (map, x, z) => { const id = zoneAt(map, x, z), zn = map.zones.find(q => q.id === id); return zn ? zn.name : null; };
const uniq = a => [...new Set(a.filter(Boolean))];
const DEFAULT_HINTS = {
  fuses: 'Search the rooms. Fuses catch the light of your torch.',
  fusebox: 'Put the fuses in the fuse box.',
  radio: 'Find the radio and call for help.',
  collect: 'Search the rooms. What you need catches the light of your torch.',
  use: 'Go there and press F.',
  hold: 'Stay alive. Hold F at a broken window to board it up, and keep moving.',
  exit: 'Get out. Now.'
};
// What to do next, where to look, and what is in the way. target: a fixed place to head for.
export function objectiveGuide(world, W, p) {
  const map = world.map, o = objective(map, W);
  if (!o) return null;
  const g = { hint: o.hint || DEFAULT_HINTS[o.id] || '', where: [], need: '', target: null };
  const kind = o.id === 'fuses' ? 'fuse' : o.id === 'collect' ? o.item : null;
  if (kind) {
    const left = W.items.filter(i => i.kind === kind);
    g.where = uniq(left.map(i => zoneName(map, i.x, i.z)));
    // something you need is behind a door that wants a key you do not have
    for (const it of left) {
      const zid = zoneAt(map, it.x, it.z);
      for (const id in world.doors) {
        const d = world.doors[id];
        if (d.key && !W.doors[id] && !W.keys[d.key] && d.zones.includes(zid) && !(map.zones.find(z => z.id === zid) || {}).start) {
          const key = W.items.find(i => i.kind === 'key' && i.key === d.key);
          g.need = `The ${d.label} is locked. Find the ${KEY_NAMES[d.key] || 'key'}` + (key ? ` (somewhere in the ${zoneName(map, key.x, key.z)})` : '') + '.';
        }
      }
    }
  }
  const at = (o2, label) => o2 && { x: o2.x, z: o2.z, label: label || zoneName(map, o2.x, o2.z) };
  if (o.id === 'fusebox') g.target = at(map.fusebox);
  else if (o.id === 'radio') g.target = at(map.radio);
  else if (o.id === 'use') {
    const sp = (map.spots || []).find(q => q.id === o.spot);
    g.target = at(sp);
    // the place is behind a door that wants a key you do not have
    const zid = sp && zoneAt(map, sp.x, sp.z);
    for (const id in world.doors) {
      const d = world.doors[id];
      if (sp && d.key && !W.doors[id] && !W.keys[d.key] && d.zones.includes(zid)) {
        const key = W.items.find(i => i.kind === 'key' && i.key === d.key);
        g.need = `The ${d.label} is locked. Find the ${KEY_NAMES[d.key] || 'key'}` + (key ? ` (somewhere in the ${zoneName(map, key.x, key.z)})` : '') + '.';
      }
    }
  }
  else if (o.id === 'exit' && map.exit) { const [x0, z0, x1, z1] = map.exit; g.target = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, label: 'the way out' }; }
  void p;
  return g;
}

export function objectiveText(map, W) {
  const o = objective(map, W);
  if (!o) return '';
  const t = Math.max(0, Math.ceil(W.obj.t || 0));
  const n = o.id === 'collect' ? (W.got[o.item] || 0) : o.id === 'kill' ? (W.matronDowns || 0) : W.fuses;
  return o.text.replace('{n}', n).replace('{t}', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
}
