// rijal_score.mjs — per-model relay-attribution scoring for the conductor beat log
// (fork intake 4, 2026-07-08). REPORT-ONLY: reads missions/_logs/conductor-rijal.jsonl,
// writes NOTHING, changes no behavior — a scorer, never a gate.
//
// WHAT IT SCORES: conduct-beat-local.mjs appends one JSONL record per beat (the `rec`
// shape in runBeat, ~line 196): {ts, backend, model, verb, args, why, gate:
// executed|proposed|refused, gateReason, execResult, rawModelText}. This module folds
// that stream into per-(backend,model) seat stats — the "could a local model hold the
// conductor seat" question needs a scoreboard, not anecdotes:
//
//   relay-accuracy = executed / (executed + refused)
//     Of the actions the gate RULED ON as relay picks, how many were right? PROPOSED is
//     deliberately EXCLUDED from this denominator: a proposed action is the model
//     reaching OUTSIDE the allowlist (or inventing a requeue the sweep never ordered) —
//     that is a different failure axis than picking wrongly within the rails, so it gets
//     its own number instead of polluting this one.
//   overreach (proposed-rate) = proposed / beats
//     How often the seat tries to act beyond its allowlist per beat.
//   unparseable = beats where verb is null (the gate could not parse an action at all —
//     raw prose instead of the required JSON). These also land in `refused`, so they are
//     a SUBSET of refused, surfaced separately because "cannot speak the protocol" and
//     "spoke it but picked a forbidden restart" need different fixes.
//
// NOT model_rijal.mjs: that file is the deliberation-chain trust registry (ʿadāla/ḍabṭ
// per verdict seat, canon-seeded). This one scores the CONDUCTOR RELAY seat from beat
// receipts. Same rijal spirit — narrator grading from deeds — different corpus.
//
// CLI: node rijal_score.mjs [path]      (default: missions/_logs/conductor-rijal.jsonl)
//   Missing file -> "no rijal log yet", exit 0 (muezzin-gate bare-run convention: the
//   pre-commit hook bare-runs offline modules and a report-only scorer with nothing to
//   score is a clean pass, not a failure). Malformed JSONL lines are skipped + counted,
//   never fatal — a half-written append from a crashed beat must not kill the report.
// Selftest: node rijal_score.mjs --selftest   (offline; fixture strings, no fs writes)

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RIJAL = path.join(HERE, 'missions', '_logs', 'conductor-rijal.jsonl');

// ---------------------------------------------------------------- parse (pure on text)
// parseRijal(text) — PURE core of readRijal, split out so the selftest scores fixture
// strings without touching the filesystem (report-only holds even under test). A line is
// MALFORMED when JSON.parse throws OR when it parses to a non-object (a bare number or
// string is not a rijal record); blank/whitespace lines (the file's trailing newline)
// are skipped silently and NOT counted — they are file mechanics, not corruption.
export function parseRijal(text) {
  const records = [];
  let malformed = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec && typeof rec === 'object' && !Array.isArray(rec)) records.push(rec);
      else malformed++;
    } catch { malformed++; }
  }
  return { records, malformed };
}

// readRijal(filePath) — read + parse the beat log. Throws only on fs errors (missing
// file etc.); the CLI catches missing-file BEFORE calling this. Malformed lines never
// throw — they are skipped and counted (tolerance is the contract: a scorer that dies
// on one bad line scores nothing).
export function readRijal(filePath) {
  return parseRijal(readFileSync(filePath, 'utf8'));
}

// ---------------------------------------------------------------- score (pure)
// scoreRijal(records) — fold records into per-(backend,model) stats. PURE: no fs, no
// clock, no ordering assumptions (first/last come from the ts values themselves — ISO
// strings compare correctly as strings; records missing a parseable ts are counted in
// beats but skipped for first/last). Unknown gate values count the beat but none of the
// three canonical buckets — the accuracy denominator stays honest.
export function scoreRijal(records) {
  const byKey = new Map();
  for (const rec of records || []) {
    const backend = String(rec.backend ?? '(unknown)');
    const model = String(rec.model ?? '(unknown)');
    const key = JSON.stringify([backend, model]); // printable + collision-proof (never a raw control byte — a raw U+0000 in source flips git to binary-diff mode)
    let s = byKey.get(key);
    if (!s) {
      s = { backend, model, beats: 0, verbs: {}, gates: { executed: 0, proposed: 0, refused: 0 }, parseFailures: 0, firstTs: null, lastTs: null };
      byKey.set(key, s);
    }
    s.beats++;
    const verb = rec.verb == null ? '(null)' : String(rec.verb);
    s.verbs[verb] = (s.verbs[verb] || 0) + 1;
    if (rec.verb == null) s.parseFailures++;
    if (Object.prototype.hasOwnProperty.call(s.gates, rec.gate)) s.gates[rec.gate]++;
    const ts = typeof rec.ts === 'string' && Number.isFinite(Date.parse(rec.ts)) ? rec.ts : null;
    if (ts) {
      if (s.firstTs === null || ts < s.firstTs) s.firstTs = ts;
      if (s.lastTs === null || ts > s.lastTs) s.lastTs = ts;
    }
  }
  const out = [...byKey.values()].map((s) => {
    const ruled = s.gates.executed + s.gates.refused;
    return {
      ...s,
      // null (not 0) when the gate never ruled executed/refused — "no evidence yet" and
      // "always wrong" must not print the same number.
      relayAccuracy: ruled > 0 ? s.gates.executed / ruled : null,
      proposedRate: s.beats > 0 ? s.gates.proposed / s.beats : 0,
    };
  });
  // busiest seats first; stable tie-break on backend/model so the report is deterministic
  out.sort((a, b) => b.beats - a.beats || a.backend.localeCompare(b.backend) || a.model.localeCompare(b.model));
  return out;
}

// ---------------------------------------------------------------- render (pure)
const pct = (x) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
const verbsCompact = (verbs) => Object.entries(verbs).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v, n]) => `${v}:${n}`).join(' ');

// renderReport(scored, {logPath, recordCount, malformed}) — PURE string builder (the CLI
// only console.logs it). Compact aligned table + the one-line-per-model summary.
export function renderReport(scored, { logPath = '', recordCount = 0, malformed = 0 } = {}) {
  const lines = [];
  lines.push('rijal score — conductor beat relay attribution (report-only)');
  if (logPath) lines.push(`log: ${logPath}`);
  lines.push(`records: ${recordCount} scored, ${malformed} malformed line${malformed === 1 ? '' : 's'} skipped`);
  lines.push('');
  if (!scored.length) {
    lines.push('no beats recorded.');
    return lines.join('\n');
  }
  const rows = scored.map((s) => [
    s.backend, s.model, String(s.beats),
    String(s.gates.executed), String(s.gates.proposed), String(s.gates.refused),
    pct(s.relayAccuracy), pct(s.proposedRate), String(s.parseFailures),
    s.firstTs || '-', s.lastTs || '-', verbsCompact(s.verbs),
  ]);
  const head = ['BACKEND', 'MODEL', 'BEATS', 'EXEC', 'PROP', 'REFU', 'ACC', 'OVER', 'UNPAR', 'FIRST', 'LAST', 'VERBS'];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join('  ').trimEnd();
  lines.push(fmt(head));
  for (const r of rows) lines.push(fmt(r));
  lines.push('');
  for (const s of scored) {
    lines.push(`${s.model} — ${s.beats} beats, accuracy ${pct(s.relayAccuracy)}, overreach ${pct(s.proposedRate)}, unparseable ${s.parseFailures}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- selftest (offline)
const _self = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));

if (_self && process.argv.includes('--selftest')) {
  let fails = 0;
  const ck = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++; };

  // polarity 1: mixed fixture — executed/proposed/refused/verb-null/malformed lines
  // (both malformed shapes: unparseable text AND valid-JSON-non-object) -> exact counts.
  const FIX = [
    '{"ts":"2026-07-08T00:00:01.000Z","backend":"ollama","model":"m1","verb":"record","args":{"requeue":"s"},"why":"ordered","gate":"executed","gateReason":"sweep-ordered","execResult":"ok","rawModelText":"{}"}',
    '{"ts":"2026-07-08T00:00:02.000Z","backend":"ollama","model":"m1","verb":"fire-mission","args":{},"why":"overreach","gate":"proposed","gateReason":"outside allowlist","execResult":null,"rawModelText":"{}"}',
    '{"ts":"2026-07-08T00:00:03.000Z","backend":"ollama","model":"m1","verb":"restart-daemon","args":{},"why":"stale","gate":"refused","gateReason":"lane running","execResult":null,"rawModelText":"{}"}',
    '{"ts":"2026-07-08T00:00:04.000Z","backend":"ollama","model":"m1","verb":null,"args":null,"why":null,"gate":"refused","gateReason":"unparseable action","execResult":null,"rawModelText":"deploy everything"}',
    'this line is not json {{{',
    '"a json string is not a rijal record"',
    '{"ts":"2026-07-08T00:00:05.000Z","backend":"agy","model":"g1","verb":"report","args":{"line":"clean"},"why":"board clean","gate":"executed","gateReason":"report line","execResult":null,"rawModelText":"{}"}',
    '',
  ].join('\n');
  const p = parseRijal(FIX);
  ck(p.records.length === 5 && p.malformed === 2, `mixed fixture parses: 5 records, 2 malformed skipped (got ${p.records.length}/${p.malformed}); blank line NOT counted malformed`);
  const scored = scoreRijal(p.records);
  const m1 = scored.find((s) => s.model === 'm1');
  const g1 = scored.find((s) => s.model === 'g1');
  ck(scored.length === 2 && scored[0] === m1, 'two (backend,model) seats, busiest first');
  ck(m1.beats === 4 && m1.gates.executed === 1 && m1.gates.proposed === 1 && m1.gates.refused === 2, `m1 gate outcomes exact: 4 beats = 1 executed + 1 proposed + 2 refused (got ${m1.beats}/${m1.gates.executed}/${m1.gates.proposed}/${m1.gates.refused})`);
  ck(Math.abs(m1.relayAccuracy - 1 / 3) < 1e-9 && Math.abs(m1.proposedRate - 0.25) < 1e-9, 'm1 relay-accuracy = 1/(1+2) (proposed EXCLUDED), overreach = 1/4 beats');
  ck(m1.parseFailures === 1 && m1.verbs['(null)'] === 1 && m1.verbs.record === 1 && m1.verbs['fire-mission'] === 1 && m1.verbs['restart-daemon'] === 1, 'm1 parse-failure count = verb-null beats; verb histogram exact');
  ck(m1.firstTs === '2026-07-08T00:00:01.000Z' && m1.lastTs === '2026-07-08T00:00:04.000Z', 'm1 firstTs/lastTs span the seat\'s own beats');
  ck(g1.beats === 1 && g1.relayAccuracy === 1 && g1.proposedRate === 0 && g1.parseFailures === 0, 'g1 (other backend) scored independently: 1 beat, accuracy 100%, overreach 0%, unparseable 0');
  const rep = renderReport(scored, { logPath: 'fixture', recordCount: 5, malformed: 2 });
  ck(rep.includes('m1 — 4 beats, accuracy 33.3%, overreach 25.0%, unparseable 1'), 'summary line matches the contract format exactly');
  ck(rep.includes('g1 — 1 beats, accuracy 100.0%, overreach 0.0%, unparseable 0'), 'second seat summary line present');

  // polarity 2: empty file -> clean empty report (no throw, no phantom seats)
  const pe = parseRijal('');
  const se = scoreRijal(pe.records);
  const re = renderReport(se, { logPath: 'empty', recordCount: 0, malformed: 0 });
  ck(pe.records.length === 0 && pe.malformed === 0 && se.length === 0 && re.includes('no beats recorded.'), 'empty file -> clean empty report');

  // polarity 2b: accuracy denominator zero (only proposed beats) -> n/a, never 0% or NaN
  const sp = scoreRijal([{ ts: '2026-07-08T00:00:06.000Z', backend: 'b', model: 'm', verb: 'x', gate: 'proposed' }]);
  ck(sp[0].relayAccuracy === null && renderReport(sp).includes('accuracy n/a'), 'all-proposed seat: accuracy is n/a (no ruled beats), not a fake 0%');

  // polarity 3: bare-run convention — missing file exits 0 with "no rijal log yet"
  // (real subprocess through the actual CLI branch; a nonexistent explicit path exercises
  // the same missing-file code path the no-args default takes).
  let bare = { status: -1, out: '' };
  try {
    const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), path.join(HERE, '_selftest-definitely-missing.jsonl')], { encoding: 'utf8', timeout: 30000 });
    bare = { status: 0, out };
  } catch (e) { bare = { status: e.status ?? -1, out: String(e.stdout || '') }; }
  ck(bare.status === 0 && bare.out.includes('no rijal log yet'), `missing log file -> "no rijal log yet", exit 0 (got exit ${bare.status})`);
  ck(resolveRijalPath([]) === DEFAULT_RIJAL, 'no-args run resolves to the default rijal path (same missing-file branch when absent)');

  console.log(fails === 0 ? '\nALL PASS — rijal_score report-only scorer sound' : `\n${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}

// ---------------------------------------------------------------- CLI (report-only)
// resolveRijalPath — PURE argv -> path (exported for the selftest fixture).
export function resolveRijalPath(argv) {
  const positional = (argv || []).filter((a) => !a.startsWith('--'));
  return positional[0] ? path.resolve(positional[0]) : DEFAULT_RIJAL;
}

if (_self && !process.argv.includes('--selftest')) {
  const logPath = resolveRijalPath(process.argv.slice(2));
  if (!existsSync(logPath)) {
    // muezzin-gate bare-run convention: nothing to score is a clean report, not an error.
    console.log(`no rijal log yet (${logPath}) — the beat harness has not appended any records`);
    process.exit(0);
  }
  const { records, malformed } = readRijal(logPath);
  console.log(renderReport(scoreRijal(records), { logPath, recordCount: records.length, malformed }));
  process.exit(0);
}
