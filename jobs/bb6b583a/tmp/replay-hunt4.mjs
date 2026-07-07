// E2E replay of hunt gap #4 kill-shape: heartbeat failure-class vocabulary frozen at two
// 2026-06-10 classes -> newer dispatch failure classes invisible to the mechanical sweep.
// Post-fix (fe46e4a2): HEARTBEAT_FLAG_TABLE classifies + emits per-row. This harness fires
// each class's line-shape at the REAL exported sweep() in an isolated sandbox and observes
// the flags. Read-only on the engine; sandbox lives in this scratch dir.
import path from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { sweep, HEARTBEAT_FLAG_TABLE } from 'file:///C:/Users/marka/.claude/muezzin-plugin/conduct-cycle.mjs';

const tmp = path.join(process.cwd(), '_replay-hunt4-sandbox');
rmSync(tmp, { recursive: true, force: true });
const logs = path.join(tmp, 'missions', '_logs');
mkdirSync(logs, { recursive: true });
const now = Date.now();

let fails = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

// healthy daemon so the sweep's restart logic stays out of the way
writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: process.pid, state: 'running', lanes: [], queued: 0, ts: new Date(now).toISOString() }));
writeFileSync(path.join(logs, 'daemon.pid'), String(process.pid));
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\n');

const noRoute = path.join(tmp, 'no-route.json');
const stubGit = (repo, argstr) => {
  if (/rev-parse --abbrev-ref/.test(argstr)) return { ok: true, out: 'github/main\n' };
  if (/^rev-list --count/.test(argstr)) return { ok: true, out: '0\n' };
  return { ok: true, out: '' };
};
const deps = { sightFn: () => ({ ok: true, results: 10 }), cgAgeFn: () => ({ ok: true, minutes: 5 }), worktreeReposFn: () => [], gitFn: stubGit, modelTagsFn: () => ({ ok: false, reason: 'replay fixture - no network' }) };

const mkLine = (mn, text) => `${new Date(now - mn * 60000).toISOString()} ${text}`;
const hb = path.join(logs, 'dispatch-heartbeat.log');

console.log(`table rows: ${HEARTBEAT_FLAG_TABLE.map((r) => `${r.key}(>=${r.threshold})`).join(', ')}`);

// KILL-SHAPE 1 (the gap itself): local-lane TIMEOUT — pre-fix this class did not exist in the
// vocabulary and produced NO flag. 3 lines at threshold must flag now.
writeFileSync(hb, [
  mkLine(3, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000'),
  mkLine(2, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000'),
  mkLine(1, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000'),
].join('\n') + '\n');
let r = sweep(tmp, now, noRoute, deps);
ck(r.report.some((l) => l.includes('FLAG: 3') && l.includes('local TIMEOUT')), 'kill-shape LOCAL_TIMEOUT (new class): 3 local TIMEOUT attempt-fails now raise a sweep FLAG');

// KILL-SHAPE 2: local-lane NETWORK — same story.
writeFileSync(hb, [
  mkLine(3, 'attempt-fail provider=ollama-local model=qwen3.6 kind=NETWORK ms=100'),
  mkLine(2, 'attempt-fail provider=ollama-local model=qwen3.6 kind=NETWORK ms=100'),
  mkLine(1, 'attempt-fail provider=ollama-local model=qwen3.6 kind=NETWORK ms=100'),
].join('\n') + '\n');
r = sweep(tmp, now, noRoute, deps);
ck(r.report.some((l) => l.includes('FLAG: 3') && l.includes('local NETWORK')), 'kill-shape LOCAL_NETWORK (new class): 3 local NETWORK attempt-fails now raise a sweep FLAG');

// MIGRATION CHECK 1: EMPTY_CONTENT_THINKING still flags byte-identically at threshold.
writeFileSync(hb, [
  mkLine(3, 'attempt-fail provider=ollama-cloud model=kimi-k2.6 EMPTY_CONTENT_THINKING'),
  mkLine(2, 'attempt-fail provider=ollama-cloud model=kimi-k2.6 EMPTY_CONTENT_THINKING'),
  mkLine(1, 'attempt-fail provider=ollama-cloud model=kimi-k2.6 EMPTY_CONTENT_THINKING'),
].join('\n') + '\n');
r = sweep(tmp, now, noRoute, deps);
ck(r.report.includes('FLAG: 3 EMPTY_CONTENT_THINKING failures in window — known quota-burn class (QUEUE: KIMI THINKING-BURN FIX)'), 'migration EMPTY_CONTENT_THINKING: legacy class still flags with the byte-identical line');

// MIGRATION CHECK 2: CUDA still flags at threshold 1 AND still emits its judgment action.
writeFileSync(hb, mkLine(1, 'attempt-fail provider=ollama-cloud model=gemma4:31b CUDA error: illegal memory access') + '\n');
r = sweep(tmp, now, noRoute, deps);
ck(r.report.some((l) => l.startsWith('FLAG: 1 CUDA error(s) in window')), 'migration CUDA: single CUDA error still flags');
ck(r.actions.some((a) => a.id === 'CUDA-CRASH-CLASS'), 'migration CUDA: CUDA-CRASH-CLASS judgment action still emitted');

// SILENCE CHECK: below threshold (2 of 3) stays silent for the new rows.
writeFileSync(hb, [
  mkLine(2, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000'),
  mkLine(1, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000'),
].join('\n') + '\n');
r = sweep(tmp, now, noRoute, deps);
ck(!r.report.some((l) => l.includes('local TIMEOUT')), 'below-threshold LOCAL_TIMEOUT stays silent (no flag spam)');

rmSync(tmp, { recursive: true, force: true });
console.log(fails === 0 ? 'REPLAY RESULT: ALL PASS' : `REPLAY RESULT: ${fails} FAIL(S)`);
process.exit(fails === 0 ? 0 : 1);
