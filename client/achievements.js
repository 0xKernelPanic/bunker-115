// Local achievements, checked when a night ends and at a few moments during play.
export const ACH = [
  { id: 'escape_s', name: 'Out of the Hollow', desc: 'Escape Wolf Hollow Sanatorium.' },
  { id: 'escape_b', name: 'First Light', desc: 'Hold the bunker until dawn and get out.' },
  { id: 'escape_e', name: 'The Long Drive', desc: 'Get the doctor\'s car running and drive away from the estate.' },
  { id: 'escape_m', name: 'Daylight', desc: 'Blast your way out of Hollow Pit Mine.' },
  { id: 'quiet', name: 'Quiet as the Grave', desc: 'Escape after firing fewer than 25 shots.' },
  { id: 'archive', name: 'Archivist', desc: 'Find every document on a map before you escape.' },
  { id: 'nightmare', name: "Nightmare's End", desc: 'Escape on Nightmare.' },
  { id: 'unbroken', name: 'Unbroken', desc: 'Escape without ever going down.' },
  { id: 'breath', name: 'Hold Your Breath', desc: 'Stay hidden while the Matron opens a locker right next to yours.' },
  { id: 'floor', name: 'Back to the Floor', desc: 'Knock the Matron down five times in one night.' },
  { id: 'team', name: 'No One Left Behind', desc: 'Escape with every player of a co-op game.' },
  { id: 'safecracker', name: 'Safecracker', desc: 'Open a safe or a lock with the right combination.' },
  { id: 'hidden', name: 'Hidden Things', desc: 'Open every hidden stash on a map in one night.' },
  { id: 'lastrounds', name: 'Last Rounds', desc: 'Put the Matron down for good.' },
  { id: 'closed', name: 'Wolf Hollow, Closed', desc: 'Drain the serum and walk out of the waterworks.' },
  { id: 'wholetruth', name: 'The Whole Truth', desc: 'Read every document of every night, then finish the last one.' }
];

function read() { try { return JSON.parse(localStorage.getItem('b115-ach') || '{}'); } catch (e) { return {}; } }
export function unlocked() { return read(); }
// true when this is the first time
export function unlock(id) {
  const all = read();
  if (all[id]) return false;
  all[id] = new Date().toISOString().slice(0, 10);
  try { localStorage.setItem('b115-ach', JSON.stringify(all)); } catch (e) {}
  return true;
}

// What a finished night earned. notesTotal: how many documents the map has.
export function endOfNight(mapId, W, players, me, notesTotal) {
  const got = [];
  if (!me || me.st !== 'e') return got;
  got.push({ sanatorium: 'escape_s', bunkier: 'escape_b', estate: 'escape_e', mine: 'escape_m', waterworks: 'closed' }[mapId]);
  if (me.shots < 25) got.push('quiet');
  if (W.notes.length >= notesTotal) got.push('archive');
  if (W.diff === 'nightmare' && !W.retries) got.push('nightmare');
  if (me.downs === 0 && !W.retries) got.push('unbroken');
  if (players.length > 1 && players.every(p => p.st === 'e')) got.push('team');
  return got;
}
