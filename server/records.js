// Hall of survivors: the fastest escapes per map and difficulty, kept in a small JSON file.
import fs from 'node:fs';
import path from 'node:path';

const KEEP = 10;

export class Records {
  constructor(dir) {
    this.file = path.join(dir, 'records.json');
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    try { this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.data = {}; }
  }
  add(map, diff, names, secs, notes) {
    const k = map + ':' + diff, list = this.data[k] || (this.data[k] = []);
    list.push({ names: names.slice(0, 4).map(n => String(n).slice(0, 16)), time: Math.round(secs), notes, date: new Date().toISOString().slice(0, 10) });
    list.sort((a, b) => a.time - b.time);
    list.length = Math.min(list.length, KEEP);
    this.save();
  }
  save() {
    const tmp = this.file + '.tmp';
    try { fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1)); fs.renameSync(tmp, this.file); }
    catch (e) { console.error('Could not save records:', e.message); }
  }
  all() { return this.data; }
}
