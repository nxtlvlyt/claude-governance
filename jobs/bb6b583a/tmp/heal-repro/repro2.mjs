import { heal, sweep } from './conduct-cycle.mjs';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const tmp = path.join(process.cwd(), '_repro-tmp2');
mkdirSync(path.join(tmp, 'missions'), { recursive: true });
mkdirSync(path.join(tmp, 'missions', '_logs'), { recursive: true });
const now = Date.now();
const logs = path.join(tmp, 'missions', '_logs');

writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: process.pid, state: 'running', lanes: [], queued: 0, ts: new Date(now).toISOString() }));
writeFileSync(path.join(logs, 'daemon.pid'), String(process.pid));

writeFileSync(path.join(tmp, 'missions', 'producer.mission.txt'), 'Maqsad: data.\nON-DONE: missions/follow-on.mission.txt\nDone means: data exists.');
writeFileSync(path.join(tmp, 'missions', 'follow-on.mission.txt'), 'Maqsad: integrate the data. Done means: integrated.');
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nDONE missions/producer.mission.txt  <!-- t -->\n');

const noRoute = () => ({ ok: true, out: '' });
const sightOk = { sightFn: () => ({ ok: true }), worktreeReposFn: () => [] };
const r = sweep(tmp, now, noRoute, sightOk);
console.log('chain actions:', r.actions.filter(a => a.id?.startsWith('CHAIN-')).map(a=>a.id));

try {
  const h = heal(tmp, now, { exec: () => { throw new Error('no restart expected'); } });
  console.log('heal OK', h.performed);
} catch (e) {
  console.log('heal THREW:', e.message);
  console.log('at crash time: missions dir exists?', existsSync(path.join(tmp, 'missions')));
  console.log('at crash time: AUTORUN exists?', existsSync(path.join(tmp, 'missions', 'AUTORUN.md')));
}
