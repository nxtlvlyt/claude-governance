// Full-sequence repro: replays selftest() fixtures 1, 1a, 1b, ROTTEN-PARK, 1c
// (REQUEUE-ON-FIX-LANDED), 1c-missing, then 1c2 (CHAIN-ON-DONE) on ONE shared tmp
// dir, exactly as conduct-cycle.mjs's real selftest() does at lines 1592-1932.
// Instruments existsSync(missions) / existsSync(AUTORUN.md) and dumps AUTORUN.md
// content before/after every heal() call.
import { heal, sweep, recordFix } from './scratch/conduct-cycle.mjs';
import { writeFileSync, existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import path from 'path';

const tmp = path.join(process.cwd(), '_repro-tmp3');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(path.join(tmp, 'missions', '_logs'), { recursive: true });
const logs = path.join(tmp, 'missions', '_logs');
const now = Date.now();

function checkpoint(label) {
  const md = existsSync(path.join(tmp, 'missions'));
  const au = existsSync(path.join(tmp, 'missions', 'AUTORUN.md'));
  console.error(`[CHECKPOINT ${label}] missions dir exists=${md} AUTORUN.md exists=${au}`);
  if (au) {
    console.error(`[CHECKPOINT ${label}] AUTORUN.md content:\n${readFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), 'utf8')}`);
  }
}

function safeHeal(label, opts) {
  checkpoint(`${label} BEFORE heal()`);
  try {
    const h = heal(tmp, now, opts);
    checkpoint(`${label} AFTER heal() (no throw)`);
    console.error(`[${label}] heal() performed:`, JSON.stringify(h.performed));
    return h;
  } catch (e) {
    checkpoint(`${label} AFTER heal() (THREW)`);
    console.error(`[${label}] heal() THREW: ${e.stack}`);
    throw e;
  }
}

// ---- fixture 1: dead daemon (stale status, dead pid) + one FAILED mission ----
writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: 999999999, state: 'running', lanes: ['missions/x.mission.txt'], queued: 0, ts: new Date(now - 10 * 60000).toISOString() }));
writeFileSync(path.join(logs, 'daemon.pid'), '999999999');
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/broken.mission.txt  <!-- t -->\nmissions/next.mission.txt\n');
writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), `${new Date(now - 2 * 60000).toISOString()} attempt-start provider=claude-opus (claude tier for kimi-k2.6)\n`);
const noRoute = path.join(tmp, 'no-route.json');
const stubGit = (repo, argstr) => {
  if (/rev-parse --abbrev-ref/.test(argstr)) return { ok: true, out: 'github/main\n' };
  if (/^rev-list --count/.test(argstr)) return { ok: true, out: '0\n' };
  if (/log -p/.test(argstr) || /patch-id/.test(argstr)) return { ok: true, out: '' };
  return { ok: true, out: '' };
};
const sightOk = { sightFn: () => ({ ok: true, results: 10 }), cgAgeFn: () => ({ ok: true, minutes: 5 }), worktreeReposFn: () => [], gitFn: stubGit, modelTagsFn: () => ({ ok: false, reason: 'selftest fixture — no network' }) };
let r = sweep(tmp, now, noRoute, sightOk);
console.error('fixture1 sweep OK, actions:', r.actions.length);

// ---- fixture 1a: DIAGNOSE read_first ----
mkdirSync(path.join(logs, 'retro'), { recursive: true });
writeFileSync(path.join(tmp, 'missions', 'broken.mission.result.json'), '{"ok":false}');
writeFileSync(path.join(logs, 'retro', 'broken-2026-07-01T00-00-00-000Z.md'), '# retro');
r = sweep(tmp, now, noRoute, sightOk);
rmSync(path.join(tmp, 'missions', 'broken.mission.result.json'), { force: true });
rmSync(path.join(logs, 'retro', 'broken-2026-07-01T00-00-00-000Z.md'), { force: true });
console.error('fixture1a sweep OK');

// ---- fixture 1b: SELF-HEAL named-fix / parked / bare ----
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'),
  '# q\nFAILED missions/fixable.mission.txt  <!-- diagnosed: too big. FIX: split into Half A + Half B then requeue -->\n' +
  'FAILED missions/parked.mission.txt  <!-- blocked pending engine batch 0.3 -->\n' +
  'FAILED missions/bare.mission.txt  <!-- t -->\n' +
  'FAILED missions/done-elsewhere.mission.txt  <!-- FIX: none needed — SUPERSEDED by conductor survey -->\n');
r = sweep(tmp, now, noRoute, sightOk);
console.error('fixture1b sweep OK, actions:', r.actions.map(a => a.id));

// ---- fixture ROTTEN-PARK sweep wiring ----
{
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nPARKED missions/rp-prose.mission.txt  <!-- 2026-07-11 parked pending engine batch -->\n');
  const rRp = sweep(tmp, now, noRoute, sightOk);
  console.error('ROTTEN-PARK sweep OK, report includes:', rRp.report.filter(l => l.includes('ROTTEN PARK')));
}

// ---- fixture 1c: REQUEUE-ON-FIX-LANDED ----
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'),
  '# q\nFAILED missions/healed.mission.txt  <!-- pending engine batch -->\nFAILED missions/other.mission.txt  <!-- t -->\n');
writeFileSync(path.join(tmp, 'missions', 'healed.mission.txt'), 'MISSION-CLASS: test\n');
writeFileSync(path.join(tmp, 'missions', 'other.mission.txt'), 'MISSION-CLASS: test\n');
recordFix(tmp, { cls: 'fabricated-citation', fix: 'citation_guard gate', requeue: ['healed'] }, now);
r = sweep(tmp, now, noRoute, sightOk);
console.error('fixture1c sweep OK, REQUEUE actions:', r.actions.filter(a => String(a.id).startsWith('REQUEUE')).map(a => a.id));
// reset daemon to healthy before heal() (mirrors selftest exactly)
writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: process.pid, state: 'running', lanes: [], queued: 0, ts: new Date(now).toISOString() }));
writeFileSync(path.join(logs, 'daemon.pid'), String(process.pid));
safeHeal('fixture1c', { exec: () => { throw new Error('must not restart a healthy daemon'); } });
r = sweep(tmp, now, noRoute, sightOk);
console.error('fixture1c once-only sweep OK, REQUEUE actions now:', r.actions.filter(a => String(a.id).startsWith('REQUEUE')).map(a => a.id));

// ---- fixture 1c-missing: ghost mission.txt requeue must skip, never crash ----
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/ghost.mission.txt  <!-- t -->\n');
recordFix(tmp, { cls: 'test-class', fix: 'test fix', requeue: ['ghost'] }, now);
r = sweep(tmp, now, noRoute, sightOk);
console.error('fixture1c-missing sweep OK, REQUEUE-ghost present?', r.actions.some(a => a.id === 'REQUEUE-ghost'));

// ---- fixture 1c2: CHAIN-ON-DONE, on the now-polluted tmp dir ----
writeFileSync(path.join(tmp, 'missions', 'producer.mission.txt'), 'Maqsad: data.\nON-DONE: missions/follow-on.mission.txt\nDone means: data exists.');
writeFileSync(path.join(tmp, 'missions', 'follow-on.mission.txt'), 'Maqsad: integrate the data. Done means: integrated.');
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nDONE missions/producer.mission.txt  <!-- t -->\n');
r = sweep(tmp, now, noRoute, sightOk);
console.error('fixture1c2 sweep OK, CHAIN actions:', r.actions.filter(a => String(a.id).startsWith('CHAIN')).map(a => a.id));
safeHeal('fixture1c2', { exec: () => { throw new Error('no restart expected'); } });

console.error('=== FULL SEQUENCE COMPLETED WITHOUT CRASH ===');
