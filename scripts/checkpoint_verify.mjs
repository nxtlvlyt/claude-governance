#!/usr/bin/env node
// ~/.claude/scripts/checkpoint_verify.mjs
//
// The content-verifying file-checkpoint primitive.
// Root-fix keystone, witness-chain APPROVED (phase-2 quorum 2026-06-01: laguna APPROVE,
// granite/nemotron CONDITIONAL_APPROVE; phase-1 gemma/qwen + Seat-3 synthesis converged).
//
// Closes the gate-gaming clause of the root cause: "ephemeral memory used as load-bearing
// continuity + self-graded, gameable gates." A step is only allowed to advance when an
// AUTOMATED SCRIPT (not the model) confirms its on-disk artifact contains SUBSTANTIVE content
// — not merely that the file exists. Existence-only checks are gameable by syntactically-valid
// placeholders (gemma C1, qwen C1, laguna C1). This is the muezzin's per-step gate.
//
// Usage:
//   node checkpoint_verify.mjs <file> [options]
//     --schema json|jsonl|text     expected structure (default: text)
//     --keys k1,k2,...             (json) require these top-level keys non-empty
//     --min-chars N                min non-whitespace chars (default 200)
//     --require <regex>            content MUST match this (deterministic on-topic probe)
//     --forbid <regex>            content must NOT match (default: dominant-placeholder guard)
//     --json                       emit machine-readable result to stdout
//
// Exit 0 = PASS (advance the chain).  Exit 1 = FAIL (block; do not advance).  Exit 2 = bad invocation.
//
// Deterministic and offline by design: the default "probe" is a regex, NOT a model call, so
// the verifier itself can never become a new gameable model-graded gate. An optional model
// probe belongs to the orchestrator, behind serial-discipline — not here.

import { readFileSync, existsSync, statSync } from 'fs';

const args = process.argv.slice(2);
if (args.length === 0) {
  process.stderr.write('usage: checkpoint_verify.mjs <file> [--schema json|jsonl|text] [--keys a,b] [--min-chars N] [--require RE] [--forbid RE] [--json]\n');
  process.exit(2);
}

const opts = { schema: 'text', keys: [], minChars: 200, require: null, forbid: null, json: false };
const file = args[0];
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === '--schema') opts.schema = args[++i];
  else if (a === '--keys') opts.keys = (args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
  else if (a === '--min-chars') opts.minChars = parseInt(args[++i], 10) || 0;
  else if (a === '--require') opts.require = args[++i];
  else if (a === '--forbid') opts.forbid = args[++i];
  else if (a === '--json') opts.json = true;
  else { process.stderr.write(`unknown option: ${a}\n`); process.exit(2); }
}

const failures = [];
let denseChars = 0;

// 1. exists
if (!existsSync(file)) {
  finish(false, [`missing: file does not exist (${file})`]);
}

// 2. non-empty (bytes)
let raw = '';
try {
  if (statSync(file).size === 0) failures.push('empty: file size is 0 bytes');
  raw = readFileSync(file, 'utf8');
} catch (e) {
  finish(false, [`unreadable: ${e.message}`]);
}

denseChars = raw.replace(/\s+/g, '').length;

// 3. content density — guards against whitespace-only and stub artifacts
if (denseChars < opts.minChars) {
  failures.push(`thin: ${denseChars} non-whitespace chars < required ${opts.minChars} (placeholder/stub suspected)`);
}

// 4. dominant-placeholder guard (default forbid). A drifted instance writes "TODO"/"..." to pass existence.
const placeholderRe = opts.forbid
  ? new RegExp(opts.forbid, 'i')
  : /^\s*(?:TODO|TBD|PLACEHOLDER|FIXME|\.\.\.|N\/?A|coming soon|<[^>]*>)\s*$/im;
// Only flag if placeholder text is a DOMINANT share of content (not an incidental "TODO" in a real doc).
if (opts.forbid) {
  if (placeholderRe.test(raw)) failures.push(`forbidden: content matches --forbid /${opts.forbid}/`);
} else {
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length);
  const placeholderLines = lines.filter(l => placeholderRe.test(l)).length;
  if (lines.length > 0 && placeholderLines / lines.length > 0.5) {
    failures.push(`placeholder: ${placeholderLines}/${lines.length} lines are placeholders (>50% stub content)`);
  }
}

// 5. schema
if (opts.schema === 'json') {
  let parsed = null;
  try { parsed = JSON.parse(raw); }
  catch (e) { failures.push(`schema: not valid JSON (${e.message.split('\n')[0]})`); }
  if (parsed && opts.keys.length) {
    for (const k of opts.keys) {
      const v = parsed?.[k];
      const emptyVal = v == null || v === '' || (Array.isArray(v) && v.length === 0)
        || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
      if (emptyVal) failures.push(`schema: required key '${k}' missing or empty`);
    }
  }
} else if (opts.schema === 'jsonl') {
  const ls = raw.split(/\r?\n/).filter(l => l.trim());
  let bad = 0;
  for (const l of ls) { try { JSON.parse(l); } catch { bad++; } }
  if (ls.length === 0) failures.push('schema: jsonl is empty');
  else if (bad > 0) failures.push(`schema: ${bad}/${ls.length} jsonl lines are not valid JSON`);
}

// 6. deterministic on-topic probe (the cheap, un-gameable witness substitute)
if (opts.require) {
  let re;
  try { re = new RegExp(opts.require, 'i'); }
  catch (e) { finish(false, [`bad --require regex: ${e.message}`]); }
  if (!re.test(raw)) failures.push(`off-topic: content does not match required /${opts.require}/`);
}

finish(failures.length === 0, failures);

function finish(pass, fails) {
  const result = { pass, file, denseChars, checks: { schema: opts.schema, minChars: opts.minChars }, failures: fails };
  if (opts.json) process.stdout.write(JSON.stringify(result) + '\n');
  else process.stdout.write(pass
    ? `PASS  ${file}  (${denseChars} chars)\n`
    : `FAIL  ${file}\n  - ${fails.join('\n  - ')}\n`);
  process.exit(pass ? 0 : 1);
}
