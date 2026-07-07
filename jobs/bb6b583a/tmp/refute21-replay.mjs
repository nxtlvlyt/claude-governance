// Independent adversarial replay for gap item hunt-21 (UNPARKS visibility in sweep()).
// Read-only w.r.t. live substrate: sweep runs against a SCRATCH base seeded with a
// verbatim copy of the live missions/QUEUE.md. Nothing live is touched.
import { sweep } from 'file:///C:/Users/marka/.claude/muezzin-plugin/conduct-cycle.mjs';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const LIVE_QUEUE = 'C:/Users/marka/.claude/muezzin-plugin/missions/QUEUE.md';
const BASE = 'C:/Users/marka/.claude/jobs/bb6b583a/tmp/refute21-base';
rmSync(BASE, { recursive: true, force: true });
mkdirSync(path.join(BASE, 'missions', '_logs'), { recursive: true });
writeFileSync(path.join(BASE, 'missions', 'AUTORUN.md'), '# q\n');

const stubGit = (repo, argstr) => {
  if (/rev-parse --abbrev-ref/.test(argstr)) return { ok: true, out: 'github/main\n' };
  if (/^rev-list --count/.test(argstr)) return { ok: true, out: '0\n' };
  return { ok: true, out: '' };
};
const opts = {
  sightFn: () => ({ ok: true, results: 10 }),
  cgAgeFn: () => ({ ok: true, minutes: 5 }),
  worktreeReposFn: () => [],
  gitFn: stubGit,
  modelTagsFn: () => ({ ok: false, reason: 'replay fixture — no network' }),
};
const noRoute = path.join(BASE, 'no-route.json'); // never the real route file

let fails = 0;
const ck = (cond, label) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) fails++; };

// (1) counterfactual: no QUEUE.md in the scratch base -> no report line, no crash
const r0 = sweep(BASE, Date.now(), noRoute, opts);
ck(!r0.report.some((l) => l.startsWith('QUEUE.md:')), 'no QUEUE.md -> no report line, sweep does not break');

// (2) verbatim live QUEUE.md -> report line with count matching independent regex count
const liveText = readFileSync(LIVE_QUEUE, 'utf8');
const independentCount = (liveText.match(/\bUNPARKS\b/g) || []).length;
writeFileSync(path.join(BASE, 'missions', 'QUEUE.md'), liveText);
const r1 = sweep(BASE, Date.now(), noRoute, opts);
const line = r1.report.find((l) => l.startsWith('QUEUE.md:'));
console.log('[report line] ' + (line || '(ABSENT)'));
console.log('[independent count] ' + independentCount);
ck(!!line && line.includes(`${independentCount} UNPARKS condition(s) on record`), `live QUEUE.md: count matches independent regex count (${independentCount})`);

// (3) kill-shape presence: the hunt's named invisible obligations are IN the text sweep counted
ck(/UNPARKS when E:\/nxtbeast|UNPARKS when E:\\/.test(liveText) || /Test-Path E:/.test(liveText), 'kill-shape: E:\\ drive UNPARKS obligation present in counted text');
ck(/AIMLAPI key rotation/.test(liveText), 'kill-shape: AIMLAPI key-rotation UNPARKS obligation present in counted text');

// (4) report-only: no required action references UNPARKS/QUEUE.md
ck(!r1.actions.some((a) => /UNPARKS|QUEUE\.md/i.test(JSON.stringify(a))), 'report-only: no action references UNPARKS/QUEUE.md');

rmSync(BASE, { recursive: true, force: true });
console.log(fails === 0 ? 'REPLAY ALL PASS' : `REPLAY FAILURES: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
