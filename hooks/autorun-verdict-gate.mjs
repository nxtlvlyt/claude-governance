#!/usr/bin/env node
// ~/.claude/hooks/autorun-verdict-gate.mjs
// PreToolUse hook — require real, per-mission diagnostic evidence before any judgment
// annotation (PARKED / FAILED+FIX / SUPERSEDED / RESOLVED / DIAGNOSED) lands in
// missions/AUTORUN.md. Self-scopes to AUTORUN.md the same way surrender-check.mjs and
// pre-tool-use-seat3-phase.mjs share a matcher without a dedicated one.
//
// Built 2026-07-01 after a real, named mistake: a conductor instance wrote PARKED for
// missions/mt-integrate-b13-aria-live.mission.txt based on a shallow diagnosis — it read
// (or recalled) a hit in missions/_logs/self-witness.jsonl, a GLOBAL cross-mission log,
// and treated that as evidence about THIS mission, never opening the mission's own
// missions/<stem>/mission-events.jsonl. A naive "does the stem appear anywhere in a
// read path" check would NOT have caught this — the global log's own path doesn't
// contain the stem, but its CONTENT does, and a looser design (matching on stem
// substring against any read) would have been fooled by adjacent reads too. This hook
// requires a Read whose PATH matches one of the mission's own evidence files
// specifically — global logs never qualify.
//
// conduct-cycle.mjs already generates a DIAGNOSE-${stem} judgment action naming exactly
// which files to read first — but its own path construction has two real drift bugs
// (result.json vs the true .mission.result.json; a fixed .retro.md vs the true
// timestamped retro filename). This hook's evidence-path candidates use the REAL on-disk
// naming, not conduct-cycle.mjs's buggy literal paths, so it doesn't inherit the bug.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import os from 'os';

let inp;
try {
  inp = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}
if (!inp) process.exit(0);

const toolName = inp.tool_name;
if (toolName !== 'Edit' && toolName !== 'Write') process.exit(0);

const filePath = (inp.tool_input?.file_path || '').replace(/\\/g, '/');
if (!/\/missions\/AUTORUN\.md$/i.test(filePath)) process.exit(0);

// Isolate genuinely NEW lines: for Edit, whatever's in new_string that wasn't already
// in old_string; for Write, whatever's in the incoming content that wasn't already on
// disk. This catches a freshly-added judgment line without re-litigating history lines
// that already existed (e.g. an unrelated edit elsewhere in the file).
let oldLines = [];
if (toolName === 'Edit') {
  oldLines = String(inp.tool_input?.old_string || '').split(/\r?\n/);
} else if (existsSync(filePath)) {
  try { oldLines = readFileSync(filePath, 'utf8').split(/\r?\n/); } catch { /* fail-open below */ }
}
const oldSet = new Set(oldLines.map((l) => l.trim()));

const newContent = inp.tool_input?.new_string ?? inp.tool_input?.content ?? '';
if (!newContent) process.exit(0);
const newLines = newContent.split(/\r?\n/).filter((l) => !oldSet.has(l.trim()));
if (newLines.length === 0) process.exit(0);

// Mirror muezzin-daemon.mjs's STATUS_RE and missionPath() stripping (copied, not
// imported -- hooks in this directory stay dependency-free from app code).
const STATUS_RE = /^(DONE|FAILED|RUNNING|SPLIT|PARKED)\b/;
function statusOf(line) { const m = String(line).trim().match(STATUS_RE); return m ? m[1] : null; }
function missionPath(line) {
  const m = String(line).trim().match(/missions\/[^\s<]+\.mission\.txt/);
  return m ? m[0] : null;
}
// Judgment-marker text in the trailing comment, mirroring conduct-cycle.mjs's own
// annotation vocabulary (FIX: / SUPERSEDED / RESOLVED / DUPLICATE-RETIRED / DIAGNOSED /
// pending engine or batch).
const JUDGMENT_MARKER_RE = /\bFIX:\s*\S|SUPERSEDED\b|RESOLVED\b|DUPLICATE-RETIRED\b|DIAGNOSED\b|pending\s+.*(engine|batch)/i;

const targets = []; // { stem, status, line }
for (const line of newLines) {
  const status = statusOf(line);
  if (!status) continue;
  const mp = missionPath(line);
  if (!mp) continue;
  const isJudgment = status === 'PARKED' || (status === 'FAILED' && JUDGMENT_MARKER_RE.test(line));
  if (!isJudgment) continue;
  const stem = basename(mp).replace(/\.mission\.txt$/i, '');
  targets.push({ stem, status, line });
}
if (targets.length === 0) process.exit(0);

// missions/ dir, relative to AUTORUN.md's own location.
const missionsDir = dirname(filePath); // .../missions
const logsDir = join(missionsDir, '_logs');
const retroDir = join(logsDir, 'retro');

function evidenceCandidatesFor(stem) {
  const candidates = [
    join(missionsDir, stem, 'mission-events.jsonl'),
    join(missionsDir, `${stem}.mission.result.json`), // the REAL name, not conduct-cycle.mjs's buggy `${stem}.result.json`
  ];
  // retro files carry a timestamp suffix (`${name}-${stamp}.md`), not a fixed `.retro.md`
  try {
    for (const f of readdirSync(retroDir)) {
      if (f.startsWith(`${stem}-`)) candidates.push(join(retroDir, f));
    }
  } catch { /* retro dir may not exist yet -- fine */ }
  return candidates.map((p) => p.replace(/\\/g, '/')).filter((p) => existsSync(p.replace(/\//g, '\\')) || existsSync(p));
}

// Locate transcript
let transcriptPath = null;
if (inp.transcript_path) {
  transcriptPath = inp.transcript_path;
} else if (inp.session_id) {
  const cwd = inp.cwd || process.cwd();
  const sanitized = cwd.replace(/[/\\:]/g, '-');
  transcriptPath = join(os.homedir(), '.claude', 'projects', sanitized, `${inp.session_id}.jsonl`);
}
if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0); // fail-open: cannot validate

const lines = readFileSync(transcriptPath, 'utf8').split('\n');
const readPaths = [];
const userTexts = [];
for (const line of lines) {
  if (!line.trim()) continue;
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }
  if (entry.type === 'system' && entry.subtype === 'compact_boundary') {
    readPaths.length = 0; userTexts.length = 0; continue;
  }
  if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
    for (const block of entry.message.content) {
      if (block.type === 'tool_use' && block.name === 'Read' && block.input?.file_path) {
        readPaths.push(String(block.input.file_path).replace(/\\/g, '/'));
      }
    }
  }
  // genuine user turns only (not tool_result echoes, which also arrive as type:'user')
  if (entry.type === 'user' && Array.isArray(entry.message?.content)) {
    for (const block of entry.message.content) {
      if (block.type === 'text' && typeof block.text === 'string') userTexts.push(block.text);
    }
  } else if (entry.type === 'user' && typeof entry.message?.content === 'string') {
    userTexts.push(entry.message.content);
  }
}

function pathMatches(readPath, candidate) {
  // containment match on the normalized path, not a bare basename/substring match --
  // a global log whose CONTENT mentions the stem must never satisfy this.
  return readPath.toLowerCase().endsWith(candidate.toLowerCase()) || readPath.toLowerCase() === candidate.toLowerCase();
}

const blocked = [];
for (const t of targets) {
  const candidates = evidenceCandidatesFor(t.stem);
  if (candidates.length === 0) continue; // nothing exists to read -- fail-open, can't demand the impossible
  const wasRead = readPaths.some((rp) => candidates.some((c) => pathMatches(rp, c)));
  if (!wasRead) blocked.push({ ...t, candidates });
}

if (blocked.length > 0) {
  const detail = blocked.map((b) =>
    `  ${b.stem}: needed one of\n${b.candidates.map((c) => `    - ${c}`).join('\n')}`
  ).join('\n');
  const reason = `AUTORUN VERDICT GATE (~/.claude/hooks/autorun-verdict-gate.mjs).

Writing a judgment annotation (PARKED/FAILED+FIX/SUPERSEDED/RESOLVED/DIAGNOSED) for a
mission without evidence that ITS OWN diagnostic files were read this session:

${detail}

A hit in a GLOBAL log (self-witness.jsonl, daemon-events.log, MISSION-LEDGER.md) does
NOT satisfy this -- that is exactly the mistake this gate exists to catch. Per
conduct-cycle.mjs's DIAGNOSE-<stem> action: naming a mission as broken is not the same
as having read why.

Required action: Read one of the files listed above for each mission named, THEN retry
this edit.`;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
  process.exit(2);
}

// Soft warn (advisory, never blocks): PARKED specifically, with evidence read, but no
// operator signal in-transcript -- log it durably rather than rely on the model noticing
// an allow-with-reason field.
const parkedTargets = targets.filter((t) => t.status === 'PARKED');
if (parkedTargets.length > 0) {
  const hasOperatorSignal = userTexts.some((t) => /\bpark(ed|ing)?\b/i.test(t));
  if (!hasOperatorSignal) {
    try {
      const fs = await import('fs');
      const logLine = parkedTargets.map((t) =>
        JSON.stringify({ ts: new Date().toISOString(), stem: t.stem, session_id: inp.session_id || null,
          note: 'PARKED used without an operator signal in-transcript; PARKED is documented operator-only/permanent (muezzin-daemon.mjs) -- consider FAILED + FIX: <performable fix> as the conductor-authored default' })
      ).join('\n') + '\n';
      fs.appendFileSync(join(logsDir, 'parked-annotation-warnings.log'), logLine);
    } catch { /* logging must never block the edit */ }
  }
}

process.exit(0);
