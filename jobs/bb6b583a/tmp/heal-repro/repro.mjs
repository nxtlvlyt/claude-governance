import { heal, sweep } from './conduct-cycle.mjs';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const tmp = path.join(process.cwd(), '_repro-tmp');
mkdirSync(path.join(tmp, 'missions'), { recursive: true });
mkdirSync(path.join(tmp, 'missions', '_logs'), { recursive: true });
const now = Date.now();

writeFileSync(path.join(tmp, 'missions', 'producer.mission.txt'), 'Maqsad: data.\nON-DONE: missions/follow-on.mission.txt\nDone means: data exists.');
writeFileSync(path.join(tmp, 'missions', 'follow-on.mission.txt'), 'Maqsad: integrate the data. Done means: integrated.');
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nDONE missions/producer.mission.txt  <!-- t -->\n');

console.log('before sweep: missions dir exists?', existsSync(path.join(tmp, 'missions')));
const noRoute = () => ({ ok: true, out: '' });
const sightOk = { sightFn: () => ({ ok: true }), worktreeReposFn: () => [] };
const r = sweep(tmp, now, noRoute, sightOk);
console.log('after outer sweep: missions dir exists?', existsSync(path.join(tmp, 'missions')));
console.log('chain actions:', r.actions.filter(a => a.id?.startsWith('CHAIN-')));

try {
  const h = heal(tmp, now, { exec: () => { throw new Error('no restart expected'); } });
  console.log('heal OK', h.performed);
} catch (e) {
  console.log('heal THREW:', e.message);
  console.log('at crash time: missions dir exists?', existsSync(path.join(tmp, 'missions')));
}
