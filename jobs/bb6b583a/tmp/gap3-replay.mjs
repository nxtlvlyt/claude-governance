// GAP #3 e2e replay — exercises the diagnosed groundedness false-flag mechanics
// against the exported functions (mock dispatch, NO live model, read-only).
import { checkGroundedness, buildGuardianPrompt, parseGuardianVerdict } from 'file://C:/Users/marka/.claude/muezzin-plugin/guardian_guard.mjs';

let pass = 0, fail = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

// --- KILL-SHAPE 1: category error (plan-mode-mobile step 3 shape) ---
// Context = old fuel-warning strings; response = ORDERED NEW plain-language rewrite.
// Guardian (mocked with the exact live bare-tag emission) says no. The diagnosis's claim:
// this yields a FLAG value, and the orchestrate caller (read-verified line 1301-1308)
// only emits an event — grounded:false must never throw or signal a block.
const liveBareTag = '<score> no </score>';   // exact live shape: NO named claim line
const r1 = await checkGroundedness(
  'WARNING: fuel level critical. Operation of vehicle not advised.',
  'Heads up — you are almost out of fuel. Fill up before driving further.',
  { dispatch: async () => liveBareTag }
);
ck(r1.grounded === false && r1.ran === true, 'kill-shape: authored-new rewrite + bare <score>no</score> -> {grounded:false, ran:true} (flag value only, no throw)');

// --- Diagnosis PLUS-claim: bare tag parses with NO named claim (unadjudicable receipt) ---
const p1 = parseGuardianVerdict(liveBareTag);
ck(p1.grounded === false && p1.raw.replace(/<score>\s*no\s*<\/score>/i, '').trim() === '', 'bare-tag: verdict extracted but zero claim text survives — the unadjudicable-receipt shape is real');

// --- MECHANIC 1: truncation. Diagnosis said maxCtx=8000; raised to 24000 on 2026-07-04. ---
const bigCtx = 'A'.repeat(30000) + ' THE-GROUNDING-FACT';
const prompt = buildGuardianPrompt(bigCtx, 'claim about THE-GROUNDING-FACT');
ck(!prompt.includes('THE-GROUNDING-FACT\n\nRESPONSE') && prompt.indexOf('RESPONSE:') > 0 && prompt.length < 24100 + 100,
   'mechanic-1: fact past the ctx cap is truncated out of the guardian prompt (cap now 24000, was 8000 at diagnosis)');
// The orchestrate CALLER still pre-slices to 8000 (orchestrate.mjs:1302) — replicate that path:
const callerSliced = bigCtx.slice(0, 8000);
ck(!callerSliced.includes('THE-GROUNDING-FACT'), 'mechanic-1 caller-path: orchestrate:1302 .slice(0,8000) still drops facts past 8KB before the guardian ever sees them');

// --- MECHANIC 2: silent partial context (readMaybe shape). Replicate orchestrate:1302 pipeline. ---
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
const readMaybe = (cwd, rel) => (rel && existsSync(path.join(cwd, rel))) ? readFileSync(path.join(cwd, rel), 'utf8') : '';
const deps = ['nonexistent-context-file-xyz.md'];
const ctxText = deps.map(d => readMaybe('C:/Users/marka/.claude/jobs/bb6b583a/tmp', d)).filter(Boolean).join('\n\n').slice(0, 8000);
ck(ctxText === '', 'mechanic-2: absent context dep silently drops to empty string — no error, no surfaced note (as diagnosed)');

// --- FAIL-SOFT (first fact's substrate): transport death never blocks ---
const r2 = await checkGroundedness('ctx', 'resp', { dispatch: async () => { throw new Error('ECONNREFUSED'); } });
ck(r2.grounded === null && r2.ran === false, 'fail-soft: dispatch throw -> {grounded:null, ran:false} — gate cannot block even when dead');

console.log(`\n${fail ? fail + ' FAIL' : 'ALL PASS'}`);
process.exit(fail ? 1 : 0);
