// What makes tonight different. The simulation draws two conditions (three on Nightmare) at the
// start; every player sees the same night.
import { pick } from './util.js';

export const CONDITIONS = {
  fog: { text: 'the fog is thick' },
  power: { text: 'the generator is failing', needs: m => m.hasPower },
  storm: { text: 'a storm is coming' },
  early: { text: 'she is already awake', needs: m => !!m.stalker },
  scarce: { text: 'batteries are scarce' },
  restless: { text: 'the dead are restless', needs: m => (m.extraLurkers || []).length > 0 },
  mourners: { text: 'someone is crying in the dark', needs: m => (m.weeperPool || []).length > 0 },
  collapse: { text: 'part of the building has come down', needs: m => (m.collapses || []).length > 0 }
};

export function drawNight(map, count, rnd = Math.random) {
  const pool = Object.keys(CONDITIONS).filter(k => !CONDITIONS[k].needs || CONDITIONS[k].needs(map));
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}

// "Tonight the fog is thick and a storm is coming."
export function nightLine(night) {
  const t = (night || []).map(k => CONDITIONS[k] && CONDITIONS[k].text).filter(Boolean);
  if (!t.length) return '';
  return 'Tonight ' + (t.length === 1 ? t[0] : t.slice(0, -1).join(', ') + ' and ' + t[t.length - 1]) + '.';
}
void pick;
