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
//   node checkpoint_verify.mjs --ruling-consistency <outputDir> [--json]
//     Item 8b — the deterministic conductor-ruling audit. Recomputes (model-free) that the
//     conductor's conductor-ruling.json HONORS the chain's verifier filter_verdicts and any
//     phase-2 seat BLOCK — no silent override. See SCHEMA + ALLOWED-disposition map below.
//
// Exit 0 = PASS (advance the chain).  Exit 1 = FAIL (block; do not advance).  Exit 2 = bad invocation.
//
// Deterministic and offline by design: the default "probe" is a regex, NOT a model call, so
// the verifier itself can never become a new gameable model-graded gate. An optional model
// probe belongs to the orchestrator, behind serial-discipline — not here.

import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
if (args.length === 0) {
  process.stderr.write('usage: checkpoint_verify.mjs <file> [--schema json|jsonl|text] [--keys a,b] [--min-chars N] [--require RE] [--forbid RE] [--json]\n');
  process.stderr.write('   or: checkpoint_verify.mjs --ruling-consistency <outputDir> [--json]\n');
  process.exit(2);
}

// ── Item 8b: deterministic conductor-ruling audit (model-free cross-check) ───────────────────
// Dispatched at the very END of the file, after checkRulingConsistency + its const tables are
// defined (avoids the const TDZ that a top-of-file call would hit).
if (args[0] === '--ruling-consistency') {
  // handled by runRulingConsistencyCli() at the bottom of this module
} else {

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

} // end else (default <file> mode)

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Item 8b — checkRulingConsistency(outputDir)
//
// Deterministic, MODEL-FREE audit that the conductor's ruling HONORS the chain's verifier
// verdicts (no silent override). Recomputes from data already on disk — ZERO model dispatch,
// no serial-inference cost, terminates instantly (no loops/timeouts).
//
// SCHEMA — conductor-ruling.json (emitted by the conductor every cycle, alongside the prose):
//   {
//     "cycle": "<string id, e.g. editor_scenic_qc>",
//     "concerns": {
//       "<concern_key>": { "disposition": <ENUM>, "rationale": "<string>" },
//       ...
//     }
//   }
//   <ENUM> ∈ { HONORED, WEAKENED, DEFERRED, DROPPED, OVERRIDDEN }
//   rationale is REQUIRED (non-empty) for OVERRIDDEN and DROPPED; optional otherwise — EXCEPT that
//   any concern that was PHASE-2 BLOCKING (a seat verdict BLOCK or a blocking-severity concern)
//   requires a non-empty rationale for EVERY disposition value (Issue-1 fix: honoring a BLOCK is an
//   accountable claim, never a free label).
//   <concern_key> is the composite "<seat>:<id>" (verifiers namespace concern ids per-seat,
//     e.g. "laguna-xs.2:q4_K_M:C1"). A bare "<id>" is also accepted as a fallback match.
//
// ARTIFACT FAMILIES loaded from outputDir (up to 5 files):
//   conductor-ruling.json   — the dispositions (REQUIRED when enforcing; missing => FAIL-CLOSED)
//   phase-2-report.json     — seat verdicts: all_outputs[].{verdict, _agent, concerns[].{id,severity}}
//   verifier-<seat>.json    — the Sonnet filter_verdicts: { seat, filter_verdict, per_concern[].id }
//
// ALLOWED-disposition map (per verifier filter_verdict):
//   PASS    → { HONORED }
//   WEAKEN  → { WEAKENED, DEFERRED, HONORED, OVERRIDDEN }  (Issue-2 fix: OVERRIDDEN admitted so a
//                                                 concern that is BOTH a WEAKEN and a phase-2 BLOCK
//                                                 has a legal override path; OVERRIDDEN already
//                                                 requires a rationale)
//   DISMISS → { DROPPED, HONORED }
//   plus: any phase-2 seat BLOCK (or blocking-severity concern) → its disposition MUST carry a
//         non-empty rationale, WHATEVER the disposition value (Issue-1 fix), and an outright
//         OVERRIDDEN remains valid; an invalid enum value still FAILs.
//
// FAIL-CLOSED contract:
//   - verifier-*.json AND phase-2-report.json both ABSENT  → SKIP gracefully (pass:true, note).
//   - any verifier/phase-2 artifact present but conductor-ruling.json missing/malformed → FAIL.
//   - a verifier filter_verdict (or BLOCK concern) with NO corresponding disposition → FAIL.
//   - a disposition outside the ALLOWED set for its verdict → FAIL.
// ─────────────────────────────────────────────────────────────────────────────────────────────

// ISSUE 2 FIX: WEAKEN's ALLOWED set now includes OVERRIDDEN. A concern that is BOTH a verifier
// WEAKEN AND a phase-2 BLOCK had no legal disposition when the conductor legitimately overrode it
// (the phase-2 path demands OVERRIDDEN, the verifier path rejected it) — a permanent FAIL that
// pressured the conductor toward the Issue-1 fail-open. OVERRIDDEN already requires a rationale
// (RATIONALE_REQUIRED), so admitting it here keeps every override accountable. PASS stays strict
// ({HONORED} only): a PASS verdict means the verifier found the concern fully grounded, so there is
// no legitimate path to silently drop/weaken it — if the conductor disputes a PASS concern that is
// itself a real contradiction to surface, not one to paper over with a free disposition.
const ALLOWED = {
  PASS:    ['HONORED'],
  WEAKEN:  ['WEAKENED', 'DEFERRED', 'HONORED', 'OVERRIDDEN'],
  DISMISS: ['DROPPED', 'HONORED'],
};
const VALID_DISPOSITIONS = ['HONORED', 'WEAKENED', 'DEFERRED', 'DROPPED', 'OVERRIDDEN'];
const RATIONALE_REQUIRED = ['OVERRIDDEN', 'DROPPED'];
const KNOWN_SEATS = ['laguna', 'granite', 'nemotron']; // the 3 Sonnet filter seats

function readJson(path) {
  // returns { ok, data, err }. Never throws.
  if (!existsSync(path)) return { ok: false, absent: true };
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch (e) { return { ok: false, err: `unreadable: ${e.message}` }; }
  try { return { ok: true, data: JSON.parse(raw) }; }
  catch (e) { return { ok: false, err: `not valid JSON: ${e.message.split('\n')[0]}` }; }
}

function checkRulingConsistency(outputDir) {
  const failures = [];

  // 1. Discover the optional artifact families.
  const verifierFiles = [];
  for (const s of KNOWN_SEATS) {
    const p = join(outputDir, `verifier-${s}.json`);
    if (existsSync(p)) verifierFiles.push({ seat: s, path: p });
  }
  const phase2Path = join(outputDir, 'phase-2-report.json');
  const phase2Present = existsSync(phase2Path);

  // 2. ROBUST SKIP: if there is nothing to enforce against, do not block a non-verifier cycle.
  if (verifierFiles.length === 0 && !phase2Present) {
    return { pass: true, dir: outputDir, note: 'no verifier artifacts to check (no verifier-*.json or phase-2-report.json present) — skipped' };
  }

  // 3. The conductor-ruling.json is now REQUIRED. Missing/malformed → FAIL-CLOSED.
  const rulingPath = join(outputDir, 'conductor-ruling.json');
  const ruling = readJson(rulingPath);
  if (!ruling.ok) {
    return { pass: false, dir: outputDir,
      failures: [`conductor-ruling.json ${ruling.absent ? 'MISSING' : 'malformed'} but enforcement artifacts exist (FAIL-CLOSED): ${ruling.err || rulingPath}`] };
  }
  const concerns = ruling.data && ruling.data.concerns;
  if (!concerns || typeof concerns !== 'object' || Array.isArray(concerns)) {
    return { pass: false, dir: outputDir,
      failures: ['conductor-ruling.json malformed: top-level "concerns" object missing (FAIL-CLOSED)'] };
  }

  // 4. Validate every disposition value + rationale-required rule (schema enforcement).
  for (const [key, entry] of Object.entries(concerns)) {
    if (!entry || typeof entry !== 'object') { failures.push(`concern '${key}': entry is not an object`); continue; }
    const d = entry.disposition;
    if (!VALID_DISPOSITIONS.includes(d)) {
      failures.push(`concern '${key}': invalid disposition '${d}' (must be one of ${VALID_DISPOSITIONS.join('|')})`);
      continue;
    }
    if (RATIONALE_REQUIRED.includes(d) && (!entry.rationale || !String(entry.rationale).trim())) {
      failures.push(`concern '${key}': disposition '${d}' requires a non-empty rationale`);
    }
  }

  // Helper: look up a disposition by composite "<seat>:<id>", else by bare "<id>".
  const lookup = (seat, id) => {
    if (concerns[`${seat}:${id}`] !== undefined) return { key: `${seat}:${id}`, entry: concerns[`${seat}:${id}`] };
    if (concerns[id] !== undefined) return { key: id, entry: concerns[id] };
    return null;
  };

  // 5. VERIFIER cross-check: each filter_verdict's disposition must be in the ALLOWED set.
  for (const vf of verifierFiles) {
    const v = readJson(vf.path);
    if (!v.ok) { failures.push(`verifier-${vf.seat}.json ${v.absent ? 'absent' : 'malformed'}: ${v.err || ''}`); continue; }
    const seat = v.data.seat || vf.seat;
    const fv = v.data.filter_verdict;
    if (!fv || !ALLOWED[fv]) {
      failures.push(`verifier-${vf.seat}.json: unrecognized filter_verdict '${fv}' (expected PASS|WEAKEN|DISMISS)`);
      continue;
    }
    // Per-concern granularity if present; otherwise treat the seat verdict as covering the seat.
    const hasPerConcern = Array.isArray(v.data.per_concern) &&
      v.data.per_concern.map(c => c.id).filter(Boolean).length > 0;
    const ids = hasPerConcern
      ? v.data.per_concern.map(c => c.id).filter(Boolean)
      : [null]; // seat-level: match by seat key alone
    // ISSUE 3 FIX: when a verifier verdict is NOT PASS but carries no usable per_concern, the old
    // seat-level branch silently fell back to lookup(seat,'C1') — quietly un-enforcing every other
    // concern of that seat (a fail-OPEN narrowing). A non-PASS seat with no per-concern breakdown
    // MUST have an explicit seat-level disposition; we no longer guess 'C1'. PASS with no
    // per_concern stays lenient (a fully-grounded seat needs no per-concern enforcement).
    for (const id of ids) {
      let found;
      if (id) {
        found = lookup(seat, id);
      } else if (concerns[seat] !== undefined) {
        found = { key: seat, entry: concerns[seat] };
      } else if (fv === 'PASS') {
        // PASS seat-level with no explicit disposition: fall back to the seat's C1 if present.
        found = lookup(seat, 'C1');
      } else {
        // FAIL-CLOSED: non-PASS verdict, no per_concern, no seat-level disposition.
        found = null;
      }
      const label = id ? `${seat}:${id}` : seat;
      if (!found) {
        failures.push(`verifier ${label}: filter_verdict=${fv} but NO corresponding disposition in conductor-ruling.json (FAIL-CLOSED${!id && fv !== 'PASS' ? '; non-PASS seat with no per_concern requires an explicit seat-level disposition, not a narrowed C1 guess' : ''})`);
        continue;
      }
      const disp = found.entry && found.entry.disposition;
      if (!ALLOWED[fv].includes(disp)) {
        failures.push(`verifier ${label}: filter_verdict=${fv} but ruling disposition='${disp}' not in ALLOWED{${ALLOWED[fv].join(',')}}`);
      }
    }
  }

  // 6. PHASE-2 BLOCK cross-check: a seat verdict BLOCK (or a blocking concern) shipped as
  //    ruling-APPROVE must be OVERRIDDEN + rationale. (verdict==='BLOCK' or concern.severity blocking.)
  if (phase2Present) {
    const p2 = readJson(phase2Path);
    if (!p2.ok) {
      failures.push(`phase-2-report.json malformed (artifact present): ${p2.err || ''}`);
    } else if (Array.isArray(p2.data.all_outputs)) {
      for (const o of p2.data.all_outputs) {
        const agent = o._agent || o.seat || o.model || 'unknown';
        const seatKey = String(agent).split(':')[0]; // e.g. "granite4.1" → still composite-matchable below
        // A blocking concern (or an outright BLOCK verdict) is the override trigger.
        const blockingConcerns = (o.concerns || []).filter(c =>
          c.severity === 'blocking' || c.blocking === true);
        const seatBlocks = o.verdict === 'BLOCK';
        const triggers = seatBlocks
          ? (o.concerns && o.concerns.length ? o.concerns.map(c => c.id) : [null])
          : blockingConcerns.map(c => c.id);
        for (const id of triggers) {
          // match disposition by "<agent>:<id>" / "<seatKey>:<id>" / bare id
          let found = null;
          if (id) {
            for (const k of [`${agent}:${id}`, `${seatKey}:${id}`, id]) {
              if (concerns[k] !== undefined) { found = { key: k, entry: concerns[k] }; break; }
            }
          } else if (concerns[agent] !== undefined) { found = { key: agent, entry: concerns[agent] }; }
          const label = `${agent}:${id || 'verdict'}`;
          if (!found) {
            failures.push(`phase-2 BLOCK ${label}: blocking seat/concern but NO disposition in conductor-ruling.json (FAIL-CLOSED)`);
            continue;
          }
          const disp = found.entry && found.entry.disposition;
          // ISSUE 1 FIX (close the fail-open hole): a concern that was PHASE-2 BLOCKING requires a
          // non-empty rationale REGARDLESS of its disposition value. Previously only OVERRIDDEN
          // carried that burden, so a motivated conductor could ship a blocking concern by simply
          // labelling it HONORED (or WEAKENED/DEFERRED/DROPPED) with NO justification — a free label
          // that the audit accepted. Honoring a BLOCK is now an accountable, auditable CLAIM: every
          // disposition of a blocking concern must be backed by written reasoning.
          if (!['HONORED', 'WEAKENED', 'DEFERRED', 'DROPPED', 'OVERRIDDEN'].includes(disp)) {
            failures.push(`phase-2 BLOCK ${label}: blocking item has invalid disposition '${disp}' — must be one of ${VALID_DISPOSITIONS.join('|')}(+rationale)`);
          } else if (!found.entry.rationale || !String(found.entry.rationale).trim()) {
            failures.push(`phase-2 BLOCK ${label}: disposition '${disp}' on a PHASE-2 BLOCKING concern requires a non-empty rationale (a blocking concern cannot be disposed by a bare label)`);
          }
        }
      }
    }
  }

  if (failures.length) return { pass: false, dir: outputDir, failures };
  const counts = `${verifierFiles.length} verifier file(s)${phase2Present ? ' + phase-2-report' : ''}, ${Object.keys(concerns).length} disposition(s)`;
  return { pass: true, dir: outputDir, note: `ruling honors verifier verdicts (${counts})` };
}

// CLI dispatch for --ruling-consistency (runs after all defs are initialized — no const TDZ).
if (args[0] === '--ruling-consistency') {
  const dir = args[1];
  const jsonOut = args.includes('--json');
  if (!dir) {
    process.stderr.write('usage: checkpoint_verify.mjs --ruling-consistency <outputDir> [--json]\n');
    process.exit(2);
  }
  const r = checkRulingConsistency(dir);
  if (jsonOut) process.stdout.write(JSON.stringify(r) + '\n');
  else if (r.pass) process.stdout.write(`PASS  ruling-consistency  ${dir}${r.note ? '  (' + r.note + ')' : ''}\n`);
  else process.stdout.write(`FAIL  ruling-consistency  ${dir}\n  - ${(r.failures || []).join('\n  - ')}\n`);
  process.exit(r.pass ? 0 : 1);
}
