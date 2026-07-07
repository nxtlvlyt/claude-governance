// refute-hunt4-replay.mjs — independent adversarial re-check of the hunt-4 e2e audit.
// Imports sweep() + HEARTBEAT_FLAG_TABLE from the LIVE engine file and fires the gap's
// receipted kill-shape (local-lane TIMEOUT/NETWORK attempt-fails, invisible pre-fix)
// plus the two migrated legacy classes and a below-threshold silence case.
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const LIVE = 'C:/Users/marka/.claude/muezzin-plugin/conduct-cycle.mjs';
const { sweep, HEARTBEAT_FLAG_TABLE } = await import(pathToFileURL(LIVE).href);

const tmp = 'C:/Users/marka/.claude/jobs/bb6b583a/tmp/hunt4-sandbox';
rmSync(tmp, { recursive: true, force: true });
const logs = path.join(tmp, 'missions', '_logs');
mkdirSync(logs, { recursive: true });
const now = Date.now();

// isolated sandbox scaffolding (same shape as the module's own selftest fixtures)
writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: 999999999, state: 'running', lanes: [], queued: 0, ts: new Date(now).toISOString() }));
writeFileSync(path.join(logs, 'daemon.pid'), '999999999');
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\n');
const noRoute = path.join(tmp, 'no-route.json');
const stubGit = (repo, argstr) => {
  if (/rev-parse --abbrev-ref/.test(argstr)) return { ok: true, out: 'github/main\n' };
  if (/^rev-list --count/.test(argstr)) return { ok: true, out: '0\n' };
  return { ok: true, out: '' };
};
const opts = { sightFn: () => ({ ok: true, results: 10 }), cgAgeFn: () => ({ ok: true, minutes: 5 }), worktreeReposFn: () => [], gitFn: stubGit, modelTagsFn: () => ({ ok: false, reason: 'replay fixture — no network' }) };

let fails = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const mkLine = (mn, text) => `${new Date(now - mn * 60000).toISOString()} ${text}`;
const hb = path.join(logs, 'dispatch-heartbeat.log');

// table sanity: the four rows the audit names, with the thresholds it names
const rows = Object.fromEntries(HEARTBEAT_FLAG_TABLE.map((r) => [r.key, r.threshold]));
ck(rows.EMPTY_CONTENT_THINKING === 3 && rows.CUDA === 1 && rows.LOCAL_TIMEOUT === 3 && rows.LOCAL_NETWORK === 3,
  `table rows+thresholds match audit claim: ${JSON.stringify(rows)}`);

// KILL-SHAPE 1: 3x local TIMEOUT attempt-fails (class invisible pre-fix) -> sweep FLAG
writeFileSync(hb, [1, 2, 3].map((i) => mkLine(i, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000')).join('\n') + '\n');
let r = sweep(tmp, now, noRoute, opts);
ck(r.report.some((l) => /FLAG: 3/.test(l) && /local TIMEOUT/.test(l)), 'kill-shape LOCAL_TIMEOUT: 3 local TIMEOUT attempt-fails raise a sweep FLAG');

// KILL-SHAPE 2: 3x local NETWORK attempt-fails -> sweep FLAG
writeFileSync(hb, [1, 2, 3].map((i) => mkLine(i, 'attempt-fail provider=ollama-local model=qwen3.6 kind=NETWORK ms=100')).join('\n') + '\n');
r = sweep(tmp, now, noRoute, opts);
ck(r.report.some((l) => /FLAG: 3/.test(l) && /local NETWORK/.test(l)), 'kill-shape LOCAL_NETWORK: 3 local NETWORK attempt-fails raise a sweep FLAG');

// MIGRATION 1: EMPTY_CONTENT_THINKING still flags byte-identically at 3
writeFileSync(hb, [1, 2, 3].map((i) => mkLine(i, 'attempt-fail provider=ollama-cloud model=kimi-k2.6 EMPTY_CONTENT_THINKING')).join('\n') + '\n');
r = sweep(tmp, now, noRoute, opts);
ck(r.report.includes('FLAG: 3 EMPTY_CONTENT_THINKING failures in window — known quota-burn class (QUEUE: KIMI THINKING-BURN FIX)'), 'migration EMPTY_CONTENT_THINKING: byte-identical legacy flag line');

// MIGRATION 2: single CUDA error still flags + emits CUDA-CRASH-CLASS action
writeFileSync(hb, mkLine(1, 'attempt-fail provider=ollama-cloud model=gemma4:31b CUDA error: illegal memory access') + '\n');
r = sweep(tmp, now, noRoute, opts);
ck(r.report.some((l) => /FLAG: 1 CUDA error/.test(l)), 'migration CUDA: single CUDA error still flags');
ck(r.actions.some((a) => a.id === 'CUDA-CRASH-CLASS'), 'migration CUDA: CUDA-CRASH-CLASS judgment action still emitted');

// BELOW THRESHOLD: 2 local TIMEOUTs stay silent
writeFileSync(hb, [1, 2].map((i) => mkLine(i, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000')).join('\n') + '\n');
r = sweep(tmp, now, noRoute, opts);
ck(!r.report.some((l) => /local TIMEOUT/.test(l)), 'below-threshold LOCAL_TIMEOUT stays silent');

console.log(fails === 0 ? 'REPLAY RESULT: ALL PASS' : `REPLAY RESULT: ${fails} FAIL(S)`);
process.exit(fails === 0 ? 0 : 1);
