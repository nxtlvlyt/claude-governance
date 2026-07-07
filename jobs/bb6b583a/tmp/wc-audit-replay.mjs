// E2E audit replay — hunt-item #11 (witness-divergence corpus wired into pipeline).
// Replays the DAEMON'S call shape (muezzin-daemon.mjs:1091): orchestrate(mission, cwd, {...})
// with NO witnessCorpusPath passed — the live behavior rides the default derivation
// path.join(path.dirname(cwd), '_logs', 'witness-corpus.jsonl'). The module selftests all
// pass an EXPLICIT corpus path, so this default seam is exactly what this replay exercises.
// All seats mocked (no model dispatch, per audit hard limits); scratch git sandbox only.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';

process.env.MUEZZIN_GUARDIAN = 'off';                                    // never dispatch the live groundedness model
process.env.MUEZZIN_HB_FILE = path.join(os.tmpdir(), 'wc-audit-hb.log'); // never touch the production heartbeat
delete process.env.MUEZZIN_SHADOW_WITNESS_MODEL;                          // default-off shadow path, as live

const { orchestrate } = await import('file:///C:/Users/marka/.claude/muezzin-plugin/orchestrate.mjs');

const scratch = fs.mkdtempSync(path.join('C:/Users/marka/.claude/jobs/bb6b583a/tmp', 'wc-'));
const missionsDir = path.join(scratch, 'missions');
const results = [];
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); results.push(c); };

function mkSandbox(stem) {
  const cwd = path.join(missionsDir, stem);
  fs.mkdirSync(cwd, { recursive: true });
  const git = (c) => execSync(`git ${c}`, { cwd, stdio: 'pipe' });
  git('init -q'); git('config user.email t@t.local'); git('config user.name t');
  fs.writeFileSync(path.join(cwd, 'seed'), 'x'); git('add -A'); git('commit -q --no-verify -m init');
  return cwd;
}
const queueFor = (id) => ({ mission_id: id, steps: [
  { step_index: 1, description: 'write a', action_type: 'edit', target_files: ['a.mjs'], context_dependencies: [], validation_command: 'node -c a.mjs' },
] });
const approvePanel = async () => ({ consensus: 'APPROVE', dispositions: [{ seat: 'validator', verdict: 'APPROVE' }], contracts: [] });

const corpusPath = path.join(missionsDir, '_logs', 'witness-corpus.jsonl');

// --- CASE 1: daemon shape, agreeing witness — line lands at the DEFAULT (live) path.
{
  const cwd = mkSandbox('wc-agree');
  const impl = async (step) => fs.writeFileSync(path.join(cwd, step.target_files[0]), 'export const v = 1;\n');
  const r = await orchestrate('mission text', cwd, {
    maxRepairs: 2,                                    // daemon's value
    deconstructFn: async () => ({ ok: true, queue: queueFor('WCA') }),
    implementFn: impl, verdictFn: approvePanel,
    witnessFn: async () => ({ verdict: 'APPROVE', findings: [], model: 'audit-mock-witness' }),
    // NOTE: witnessCorpusPath deliberately NOT passed — the daemon does not pass it either.
  });
  ck(r.ok === true && r.phase === 'done', 'replay 1: mission completes (panel consensus lands)');
  ck(fs.existsSync(corpusPath), `replay 1: corpus line lands at the DEFAULT daemon-derived path (<missions>/_logs/witness-corpus.jsonl)`);
  if (fs.existsSync(corpusPath)) {
    const line = JSON.parse(fs.readFileSync(corpusPath, 'utf8').trim().split('\n')[0]);
    ck(line.producer_verdict === 'APPROVE' && line.candidate_verdicts['audit-mock-witness'] === 'APPROVE',
      'replay 1: producer=panel consensus, candidate keyed by the witness\'s honest model name');
    ck(typeof line.ts === 'string' && line.ts !== new Date(0).toISOString() && line.ts.startsWith('2026-'),
      `replay 1: real timestamp, not the epoch default (ts=${line.ts})`);
  }
}

// --- CASE 2: the gap's kill-shape — witness DISSENTS (REJECT), repair clears it, panel APPROVEs.
// Before the fix this divergence was never recorded anywhere; the corpus must now capture it.
{
  const cwd = mkSandbox('wc-diverge');
  const impl = async (step) => fs.writeFileSync(path.join(cwd, step.target_files[0]), 'export const v = 2;\n');
  let calls = 0;
  const flagThenClear = async () => (++calls === 1)
    ? { verdict: 'REJECT', findings: [{ id: 'W1', description: 'unsupported claim' }], model: 'audit-mock-witness' }
    : { verdict: 'APPROVE', findings: [], model: 'audit-mock-witness' };
  const r = await orchestrate('mission text', cwd, {
    maxRepairs: 2,
    deconstructFn: async () => ({ ok: true, queue: queueFor('WCD') }),
    implementFn: impl, repairFn: async () => {}, verdictFn: approvePanel,
    witnessFn: flagThenClear,
  });
  ck(r.ok === true, 'replay 2: flagged-then-repaired mission completes');
  const lines = fs.readFileSync(corpusPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const div = lines[lines.length - 1];
  ck(div.producer_verdict === 'APPROVE' && div.candidate_verdicts['audit-mock-witness'] === 'REJECT',
    'replay 2: the witness\'s ORIGINAL dissent is recorded against the panel\'s APPROVE — the divergence signal the gap named as unmeasured');
}

// --- CASE 3: corpus is consumable by the selector (the "built-but-unused" half now has real food).
{
  const { loadWitnessCorpus, selectWitnessByDivergence } = await import('file:///C:/Users/marka/.claude/muezzin-plugin/witness_select.mjs');
  const corpus = loadWitnessCorpus(corpusPath);
  ck(corpus.length === 2, `replay 3: loadWitnessCorpus reads back both live-shape lines (got ${corpus.length})`);
  const sel = selectWitnessByDivergence(['audit-mock-witness'], corpus);
  ck(sel && typeof sel === 'object', `replay 3: selectWitnessByDivergence consumes the pipeline-written corpus without error (${JSON.stringify(sel).slice(0, 120)})`);
}

fs.rmSync(scratch, { recursive: true, force: true });
console.log(results.every(Boolean) ? 'REPLAY ALL PASS' : 'REPLAY FAILURES PRESENT');
process.exit(results.every(Boolean) ? 0 : 1);
