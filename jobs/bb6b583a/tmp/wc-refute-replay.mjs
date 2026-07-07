// Adversarial re-verification replay for hunt-11 audit verdict.
// Drives the REAL exported orchestrate() through the daemon's exact call shape
// (muezzin-daemon.mjs:1091 — maxRepairs:2, stepRetries, missionsDir, NO witnessCorpusPath)
// so the DEFAULT corpus-path derivation (path.dirname(cwd)/_logs/witness-corpus.jsonl)
// is what gets exercised. Mocked seats only — no model dispatch. Scratch-only writes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { orchestrate } from 'file:///C:/Users/marka/.claude/muezzin-plugin/orchestrate.mjs';
import { loadWitnessCorpus, selectWitnessByDivergence } from 'file:///C:/Users/marka/.claude/muezzin-plugin/witness_select.mjs';

let fails = 0;
const ck = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + ' ' + msg); if (!cond) fails++; };

// scratch "missions" root mirroring the daemon layout: missions/<sandbox> as cwd
const root = fs.mkdtempSync(path.join('C:/Users/marka/.claude/jobs/bb6b583a/tmp/', 'wcref-'));
const missionsDir = path.join(root, 'missions');
const sandbox = path.join(missionsDir, 'wc-sandbox');
fs.mkdirSync(sandbox, { recursive: true });
execSync('git init -q', { cwd: sandbox, stdio: 'pipe' });
execSync('git config user.email t@t.local', { cwd: sandbox, stdio: 'pipe' });
execSync('git config user.name t', { cwd: sandbox, stdio: 'pipe' });

const expectedCorpus = path.join(missionsDir, '_logs', 'witness-corpus.jsonl');

const q = (id) => ({ mission_id: id, steps: [{ step_index: 1, description: 'w', action_type: 'edit', target_files: [`${id}.mjs`], context_dependencies: [], validation_command: `node -c ${id}.mjs` }] });
const impl = async (step) => fs.writeFileSync(path.join(sandbox, step.target_files[0]), `export const v = 1;\n`);
const approveVerdict = async () => ({ consensus: 'APPROVE', dispositions: [{ seat: 'validator', verdict: 'APPROVE' }], contracts: [] });

// Daemon call shape (muezzin-daemon.mjs:1091): NO witnessCorpusPath passed.
const daemonShape = (extra) => ({
  maxRepairs: 2, needsSearch: false,
  stepRetries: 2,
  missionsDir, parentMissionFile: null, autorunFile: null,
  ...extra,
});

// ---- replay 1: agreeing witness -> corpus line lands at the DEFAULT daemon-derived path
const namedWitness = async () => ({ verdict: 'APPROVE', findings: [], model: 'audit-mock-witness' });
const r1 = await orchestrate('m', sandbox, daemonShape({
  deconstructFn: async () => ({ ok: true, queue: q('wca') }),
  implementFn: impl, verdictFn: approveVerdict, witnessFn: namedWitness,
}));
ck(r1.ok === true && fs.existsSync(expectedCorpus), 'replay 1: corpus line lands at the DEFAULT daemon-derived path (<missions>/_logs/witness-corpus.jsonl)');
const line1 = JSON.parse(fs.readFileSync(expectedCorpus, 'utf8').trim().split('\n')[0]);
ck(line1.producer_verdict === 'APPROVE' && line1.candidate_verdicts['audit-mock-witness'] === 'APPROVE', 'replay 1: producer=panel consensus, candidate keyed by the witness honest model name');
ck(typeof line1.ts === 'string' && line1.ts !== new Date(0).toISOString(), `replay 1: real timestamp, not the epoch default (ts=${line1.ts})`);

// ---- replay 2: the gap's divergence kill-shape — witness REJECT -> repair -> panel APPROVE
let calls = 0;
const flagThenClear = async () => (++calls === 1
  ? { verdict: 'REJECT', findings: [{ id: 'W1', description: 'claim' }], model: 'audit-mock-witness' }
  : { verdict: 'APPROVE', findings: [], model: 'audit-mock-witness' });
const r2 = await orchestrate('m', sandbox, daemonShape({
  deconstructFn: async () => ({ ok: true, queue: q('wcd') }),
  implementFn: impl, repairFn: async () => { }, verdictFn: approveVerdict, witnessFn: flagThenClear,
}));
const lines = fs.readFileSync(expectedCorpus, 'utf8').trim().split('\n').map(JSON.parse);
const line2 = lines[lines.length - 1];
ck(r2.ok === true && lines.length === 2 && line2.producer_verdict === 'APPROVE' && line2.candidate_verdicts['audit-mock-witness'] === 'REJECT', "replay 2: the witness's ORIGINAL dissent is recorded against the panel's APPROVE — the divergence signal the gap named as unmeasured");

// ---- replay 2b: halted-pre-panel writes NO line at the default path (mirrors the live affiliate-cards halt)
const alwaysFlag = async () => ({ verdict: 'REJECT', findings: [{ id: 'W1', description: 'claim' }], model: 'audit-mock-witness' });
const r2b = await orchestrate('m', sandbox, daemonShape({
  deconstructFn: async () => ({ ok: true, queue: q('wcn') }),
  implementFn: impl, maxRepairs: 0, stepRetries: 0, verdictFn: approveVerdict, witnessFn: alwaysFlag,
}));
const linesAfter = fs.readFileSync(expectedCorpus, 'utf8').trim().split('\n');
ck(r2b.ok === false && linesAfter.length === 2, 'replay 2b: a mission halted before the panel appends NO line at the default path (absence, never fabricated agreement)');

// ---- replay 3: the selector consumes the pipeline-written corpus
const corpus = loadWitnessCorpus(expectedCorpus);
const sel = selectWitnessByDivergence(['audit-mock-witness'], corpus);
ck(corpus.length === 2 && sel && sel.id === 'audit-mock-witness' && sel.divergence_rate === 0.5, `replay 3: selectWitnessByDivergence consumes the pipeline-written corpus without error (${JSON.stringify({ id: sel?.id, divergence_rate: sel?.divergence_rate })})`);

console.log(fails === 0 ? 'REPLAY ALL PASS' : `REPLAY FAILURES: ${fails}`);
// cleanup scratch
try { fs.rmSync(root, { recursive: true, force: true }); } catch { }
process.exit(fails === 0 ? 0 : 1);
