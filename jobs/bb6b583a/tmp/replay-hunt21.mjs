// E2E replay of hunt-item #21: sweep must report open UNPARKS condition counts from QUEUE.md.
// Read-only on the engine repo: imports the live module, operates on a scratch fixture only.
import { sweep } from 'file:///C:/Users/marka/.claude/muezzin-plugin/conduct-cycle.mjs';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const tmp = 'C:/Users/marka/.claude/jobs/bb6b583a/tmp/fixture-hunt21';
rmSync(tmp, { recursive: true, force: true });
mkdirSync(path.join(tmp, 'missions', '_logs'), { recursive: true });
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nDONE missions/good.mission.txt  <!-- t -->\n');

const now = Date.now();
const noRoute = path.join(tmp, 'no-route.json'); // never read the real route file
const stubGit = () => ({ ok: true, out: '' });
const stubs = {
  sightFn: () => ({ ok: true, results: 10 }),
  cgAgeFn: () => ({ ok: true, minutes: 5 }),
  worktreeReposFn: () => [],
  gitFn: stubGit,
  modelTagsFn: () => ({ ok: false, reason: 'replay fixture — no network' }),
};

let fails = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

// Case 1: no QUEUE.md present -> no QUEUE.md line, no crash (the original code path pre-fix was total blindness; absence must stay silent, not error)
const r1 = sweep(tmp, now, noRoute, stubs);
ck(!r1.report.some((l) => l.startsWith('QUEUE.md:')), 'no QUEUE.md -> no QUEUE.md report line, no error');

// Case 2 (the kill-shape): the LIVE QUEUE.md — real deferred prose obligations the sweep was blind to
const live = readFileSync('C:/Users/marka/.claude/muezzin-plugin/missions/QUEUE.md', 'utf8');
const expected = (live.match(/\bUNPARKS\b/g) || []).length;
mkdirSync(path.join(tmp, 'missions'), { recursive: true });
writeFileSync(path.join(tmp, 'missions', 'QUEUE.md'), live);
const r2 = sweep(tmp, now, noRoute, stubs);
const line = r2.report.find((l) => l.startsWith('QUEUE.md:'));
console.log(`  live QUEUE.md UNPARKS count (independent): ${expected}`);
console.log(`  sweep report line: ${line || '(none)'}`);
ck(!!line && line.includes(`${expected} UNPARKS condition(s) on record`), `live QUEUE.md -> sweep reports ${expected} UNPARKS condition(s)`);
ck(!r2.actions.some((a) => /UNPARKS|QUEUE\.md/i.test(JSON.stringify(a))), 'report-only: no blocking action manufactured from UNPARKS presence');

// Case 3: the selftest's own 2-condition fixture shape, verbatim
writeFileSync(path.join(tmp, 'missions', 'QUEUE.md'), '- some parked item. UNPARKS when the drive returns.\n- another one. UNPARKS on key rotation.\n');
const r3 = sweep(tmp, now, noRoute, stubs);
ck(r3.report.some((l) => l === 'QUEUE.md: 2 UNPARKS condition(s) on record — review missions/QUEUE.md for whether any have actually fired (not auto-checked here; conductor judgment)'), '2-condition fixture -> exact selftest-expected report line');

rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS');
process.exit(fails ? 1 : 0);
