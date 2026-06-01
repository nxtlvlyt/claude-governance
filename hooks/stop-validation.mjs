#!/usr/bin/env node
// ~/.claude/hooks/stop-validation.mjs
// Stop hook — structural enforcement of delegation-and-stall-discipline.md.
// Node.js .mjs port of stop-validation.ps1 (Phase A migration, C1 deliberation CONDITIONAL_APPROVE 2026-05-14).
//
// Refuses turn-end when stop-language is detected in the last assistant message
// WITHOUT a foreign-frontier dispatch appearing in the recent tool_use blocks.
//
// Refinements A–D from the PS1 are fully ported:
//   C: At/above ratchet threshold (fire 3+), requires humility check: marker with
//      drift mode + material delta in the same load-bearing dispatch payload.
//   D: Also requires prior verdict quote that appears verbatim in a prior tool_result.
//
// Ratchet state: ~/.claude/state/stop-ratchet-{session_id}.txt
// Threshold: 3. FAIL-CLOSED on corrupt state file.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

const RATCHET_THRESHOLD = 3;

let inp;
try {
  inp = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

if (!inp) process.exit(0);

// Locate transcript
let transcriptPath = null;
if (inp.transcript_path) {
  transcriptPath = inp.transcript_path;
} else if (inp.session_id) {
  const cwd = inp.cwd || process.cwd();
  const sanitized = cwd.replace(/[/\\:]/g, '-');
  transcriptPath = join(os.homedir(), '.claude', 'projects', sanitized, `${inp.session_id}.jsonl`);
}

if (!transcriptPath || !existsSync(transcriptPath)) {
  process.exit(0); // fail-open: cannot validate without transcript
}

// Read last 30 entries
const allLines = readFileSync(transcriptPath, 'utf8').split('\n');
const lines = allLines.slice(-30);

// Walk in reverse to find last assistant entry
let lastAssistantText = '';
const lastTurnToolUses = [];    // names only, for FF check
const lastTurnToolUseBlocks = []; // full blocks, for marker payload grep
let foundAssistant = false;

for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i];
  if (!line.trim()) continue;
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }

  if (entry.type === 'assistant') {
    foundAssistant = true;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === 'text') {
        lastAssistantText = block.text + '\n' + lastAssistantText;
      } else if (block.type === 'tool_use') {
        lastTurnToolUses.push(block.name);
        lastTurnToolUseBlocks.push(block);
      }
    }
  } else if (foundAssistant && entry.type === 'user') {
    break;
  }
}

if (!lastAssistantText) process.exit(0); // no text surface, allow

// Stop-language patterns (same as PS1 — case-insensitive)
const stopLanguagePatterns = [
  /want me to\b/i,
  /\byour call\b/i,
  /\bshould I (?:proceed|continue|do|wire|ship|fire|run|pull|build|start|go)/i,
  /\boperator decision\b/i,
  /stopping (?:here|for now)/i,
  /ready (?:when you are|to (?:proceed|continue|ship))/i,
  /\bstanding by\b/i,
  /let me know if you/i,
  // Defer-to-operator-TIMING family (added 2026-05-30, laguna witness APPROVE). The false-negative that
  // slipped through: a soft punt ("whenever you're ready, the next move is X") handing the operator the
  // next-action decision. Distinct from "ready when you are" (wrong word order missed it). Fires regardless
  // of tool-use, which closes the structural-clause hole (that clause only fires on tool-LESS turns, so a
  // deferral wrapped in a productive tool-bearing turn evaded it). Additive; false-positives acceptable-by-design.
  /whenever you(?:'re| are) ready/i,
  /when you(?:'re| are) ready\b/i,
  /\bready whenever\b/i,
  /when(?:ever)? you want\b/i,
  /\bup to you\b/i,
];

let matchedPattern = null;
for (const pat of stopLanguagePatterns) {
  const m = lastAssistantText.match(pat);
  if (m) { matchedPattern = m[0]; break; }
}

// --- FM-12 check: runs regardless of stop-language ---
// Camel Rule: block stop if active background tasks exist without ScheduleWakeup set.
{
  const fm12SId = inp.session_id;
  if (fm12SId) {
    const fm12StateFile = join(os.homedir(), '.claude', 'state', `active-tasks-${fm12SId}.json`);
    if (existsSync(fm12StateFile)) {
      try {
        const fm12State = JSON.parse(readFileSync(fm12StateFile, 'utf8'));
        if ((fm12State.active_count || 0) > 0 && !fm12State.wakeup_set) {
          process.stdout.write(JSON.stringify({
            decision: 'block',
            reason: `FM-12 VIOLATION (Camel Rule) — ${fm12State.active_count} active task(s) without ScheduleWakeup.\n\nPer ~/.claude/practice/core.md FM-12: before stopping with pending background tasks,\nScheduleWakeup must be set with a reason naming what is monitored and what the stall signal is.\n\n${fm12State.active_count} TaskCreate(s) recorded this session without corresponding completion,\nand no ScheduleWakeup was set.\n\nTie the camel: call ScheduleWakeup before ending this session.`
          }));
          process.exit(0);
        }
      } catch { /* fail-open on missing/corrupt FM-12 state */ }
    }
  }
}

// Fix 1 (2026-05-29, chain-approved + laguna-reviewed): action-triggered ship-verification gate.
// If this turn shipped a deliverable (SendUserFile, or a Bash/PowerShell write into the outgoing
// webroot), require a Read of the shipped file in the SAME turn (substrate-coupled by basename).
// Action-triggered, NOT language. Fail-open on any parse trouble. (Catches the upside-down-clip case.)
try {
  const shipped = new Set();
  for (const b of lastTurnToolUseBlocks) {
    if (b.name === 'SendUserFile') for (const f of (b.input?.files || [])) shipped.add(String(f).split(/[\\/]/).pop());
    else if (b.name === 'Bash' || b.name === 'PowerShell') {
      const c = String(b.input?.command || '');
      if (/apps[\\/]+outgoing/i.test(c)) for (const m of (c.match(/[\w.\-]+\.(?:mp4|mov|png|jpg|jpeg|webp|pdf|zip|gif|mp3|wav)/gi) || [])) shipped.add(m.split(/[\\/]/).pop());
    }
  }
  if (shipped.size > 0) {
    const reads = lastTurnToolUseBlocks.filter(b => b.name === 'Read').map(b => String(b.input?.file_path || '').split(/[\\/]/).pop());
    const ok = [...shipped].some(n => reads.includes(n) || reads.some(r => r && (n.replace(/\.[^.]+$/, '') === r.replace(/\.[^.]+$/, ''))));
    if (!ok) {
      process.stdout.write(JSON.stringify({ decision: 'block', reason: `SHIP VERIFICATION GATE (Fix 1) — shipped [${[...shipped].join(', ')}] without reading/looking at it this turn. Open the output (extract a frame, Read it) and verify content — not just exit-code/HTTP-200 — then ship.` }));
      process.exit(0);
    }
  }
} catch { /* fail-open */ }

// Fix 2 (2026-06-01, chain-ratified 6/6 + Seat-3 + laguna code-witness REVISE-incorporated): narration-without-execution gate.
// Catches the conductor asserting an imminent TOOL action then ending the turn with ZERO tool_use this turn ("Launching now" with nothing launched).
// SEPARATE early-return block (NOT routed through stop-language/FF machinery — the fix is "emit the tool call", not a dispatch).
// EXEMPT: niyyah-in-prior-turn (the niyyah-gate REQUIRES declaring intent this turn to act next) + authorizedWait. Imminent-only (NOT past-tense; past may reference a real prior-turn tool call).
// Backtick/code spans stripped so meta-discussion of the phrase does not trip it. Strand-guard: ratchet-based FAIL-OPEN after 3 consecutive (loud log). Fail-open on any parse trouble.
try {
  const nweNoTool = lastTurnToolUses.length === 0;
  const nweClean = lastAssistantText.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');
  const nweNiyyah = /\bniyyah\s*:/i.test(lastAssistantText);
  const nweAuthWait = /operator[- ]authorized\s+wait|operator authorized waiting/i.test(lastAssistantText);
  const nweImminent =
    /\b(?:launch|run|execut|dispatch|writ|fir|kick|creat|build|edit|deploy|start)\w*\b[^.?!\n]{0,40}\b(?:now|next)\b/i.test(nweClean)
    || /\b(?:i'?ll|i will|let me|i'?m going to|about to|time to)\s+(?:now\s+|just\s+)?(?:launch|run|execut\w*|dispatch|writ\w*|fir\w*|creat\w*|build|edit|deploy|kick\s*off|start)\b/i.test(nweClean);
  const nweTrigger = nweNoTool && nweImminent && !nweNiyyah && !nweAuthWait;
  const nweFile = inp.session_id ? join(os.homedir(), '.claude', 'state', `narration-ratchet-${inp.session_id}.txt`) : null;
  if (nweTrigger) {
    let nweCount = 0;
    if (nweFile && existsSync(nweFile)) { try { nweCount = parseInt(readFileSync(nweFile, 'utf8').trim(), 10) || 0; } catch { nweCount = 0; } }
    if (nweCount >= 3) {
      process.stderr.write(`stop-validation: narration-gate FAIL-OPEN after ${nweCount} consecutive blocks (strand guard)\n`);
      if (nweFile) { try { writeFileSync(nweFile, '0'); } catch { /* ok */ } }
    } else {
      if (nweFile) { try { writeFileSync(nweFile, String(nweCount + 1)); } catch { /* ok */ } }
      process.stdout.write(JSON.stringify({ decision: 'block', reason: `NARRATION-WITHOUT-EXECUTION GATE (~/.claude/hooks/stop-validation.mjs, Fix 2).

This turn asserts an IMMINENT action (imminent + tool-verb language) but contains ZERO tool calls — the words are standing in for the act ("launching now" with nothing launched).

Emit the tool call you described, OR remove the claim and state the true state plainly. If this legitimately defers to next turn, carry a "niyyah:" marker (that is the exemption).` }));
      process.exit(0);
    }
  } else if (nweFile && existsSync(nweFile)) {
    try { writeFileSync(nweFile, '0'); } catch { /* ok */ } // reset consecutive counter on any clean/exempt turn
  }
} catch { /* fail-open */ }

// Structural deferral-shape OR-clause (chain-approved 2026-05-29, 6/6 deliberation; granite C1/C3 blocking; laguna witness APPROVE).
// Model-agnostic: catches the SHAPE of a stall the fixed word list misses (the false-negative that dominates across models).
// ADDITIVE — fires MORE, never narrows the word list; NO quote/code normalizer (that is the documented bypass, drift-and-ratchet.md).
// Downstream FF-dispatch + ratchet logic is unchanged and now also engages on this structural match.
if (!matchedPattern) {
  const noToolThisTurn = lastTurnToolUses.length === 0;
  const txt = lastAssistantText.trim();
  const operatorDirectedQuestion = /\?\s*$/.test(txt) || /\b(let me know|do you want|would you like|want me to|should i)\b/i.test(txt);
  // Operator-directed DEFERRAL shape (added 2026-05-30, laguna witness APPROVE): the next action handed to the
  // operator's FUTURE. Fires REGARDLESS of tool-use — closes the hole where a deferral rode in on a tool-bearing
  // turn with non-interrogative phrasing ("the next step when you come back to it") and slipped both the word list
  // and the tool-less-question clause. Additive; false-positives accepted by design (canon: fire more, never narrow).
  const operatorDirectedDeferral =
    /\b(?:whenever|when|once|after)\s+you(?:'re|\s+are)?\b[^.?!]{0,40}\b(?:ready|want|wanna|come back|get\s+(?:a\s+chance|to\s+it|around)|return|free|back|next)\b/i.test(txt)
    || /\bcome back to (?:it|this|that)\b/i.test(txt)
    || /\bnext (?:step|move|thing|fix|action)\b[^.?!]{0,40}\byou\b/i.test(txt)
    || /\bwhen you(?:'re|\s+are)?\s+(?:back|free|around|ready)\b/i.test(txt);
  const authorizedWait = /operator[- ]authorized\s+wait|operator authorized waiting/i.test(txt);
  if (!authorizedWait && ((noToolThisTurn && operatorDirectedQuestion) || operatorDirectedDeferral)) {
    matchedPattern = 'structural-deferral-shape (operator-directed next-action deferral / stall)';
  }
}

if (!matchedPattern) process.exit(0); // no stop-language, allow

// Check for foreign-frontier dispatch in last turn
const isFF = (name) => /^mcp__(gemini|gpt|grok|glm|ollama)/i.test(name) ||
  name === 'WebSearch' || name === 'WebFetch';

// WITNESS-INTEGRITY (root-fix; witness-chain APPROVED 2026-06-01; laguna change-shape + code audit APPROVE).
// A witness dispatch satisfies this gate ONLY IF its paired tool_result (matched by tool_use_id) is
// SUBSTANTIVE (>= WITNESS_MIN_CHARS non-whitespace). Applied UNIFORMLY to every FF transport
// (frontier + local ollama + WebSearch/WebFetch). Closes the empirically-confirmed hole where an
// EMPTY mcp__ollama no-op satisfied the gate (witness theater). D13: the quorum's literal "remove
// mcp__ollama" would strand the no-frontier workflow (local ollama is the only permitted witness);
// verifying substance preserves it. Reuses allLines (already read at top) — no second read, no read-
// error bypass. FOUND-but-empty fails closed (the hole); NOT-FOUND fails open (id-edge / never strand).
const WITNESS_MIN_CHARS = 40;
function witnessResultText(toolUseId) {
  if (!toolUseId) return null;
  for (const line of allLines) {
    if (!line.trim()) continue;
    let entry; try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type !== 'user') continue;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === 'tool_result' && block.tool_use_id === toolUseId) {
        if (typeof block.content === 'string') return block.content;
        if (Array.isArray(block.content)) return block.content.filter(b => b?.type === 'text').map(b => b.text || '').join(' ');
        return '';
      }
    }
  }
  return null;
}

const foreignFrontierFired = (() => {
  const ffBlocks = lastTurnToolUseBlocks.filter(b => isFF(b.name || ''));
  for (const b of ffBlocks) {
    const res = witnessResultText(b.id);
    if (res === null) return true;                                       // not found (edge) → fail-open, never strand
    if (res.replace(/\s+/g, '').length >= WITNESS_MIN_CHARS) return true; // substantive witness
    // found but empty/thin → does NOT satisfy (the confirmed hole)
  }
  return false;
})();

// Read ratchet state — FAIL-CLOSED on corrupt file
const sessionId = inp.session_id;
let priorCount = 0;
let readDegraded = false;
let stateFile = null;

if (sessionId) {
  const stateDir = join(os.homedir(), '.claude', 'state');
  try { mkdirSync(stateDir, { recursive: true }); } catch { /* ok */ }
  stateFile = join(stateDir, `stop-ratchet-${sessionId}.txt`);
  if (existsSync(stateFile)) {
    try {
      const raw = readFileSync(stateFile, 'utf8').trim();
      const parsed = parseInt(raw, 10);
      if (Number.isInteger(parsed)) {
        priorCount = parsed;
      } else {
        throw new Error('non-integer contents');
      }
    } catch (e) {
      readDegraded = true;
      process.stderr.write(`stop-validation: state-file read FAILED on '${stateFile}' (${e.message}); defaulting to failure-CLOSED (RatchetCount forced to ${RATCHET_THRESHOLD})\n`);
      priorCount = RATCHET_THRESHOLD;
    }
  }
}

// At/above threshold: priorCount + 1 >= RATCHET_THRESHOLD
const atThreshold = (priorCount + 1) >= RATCHET_THRESHOLD;

// Helper: recursively collect all string leaf values from a nested object/array
function getAllStringLeaves(value) {
  if (value == null) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(getAllStringLeaves);
  if (typeof value === 'object') return Object.values(value).flatMap(getAllStringLeaves);
  return [];
}

// Helper: collapse whitespace
const normalizeWS = (s) => s == null ? '' : s.replace(/\s+/g, ' ').trim();

// Helper: check if normalized payload contains both drift+delta values
function testMarkerInDispatch(payload, drift, delta) {
  if (!payload || !drift || !delta) return false;
  const p = payload.toLowerCase();
  return p.includes(drift.toLowerCase()) && p.includes(delta.toLowerCase());
}

// Helper: collect all tool_result content text from transcript
function getToolResultTexts(transcriptLines) {
  const out = [];
  for (const line of transcriptLines) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type !== 'user') continue;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type !== 'tool_result') continue;
      if (typeof block.content === 'string') {
        out.push(block.content);
      } else if (Array.isArray(block.content)) {
        for (const cb of block.content) {
          if (cb.type === 'text' && cb.text) out.push(cb.text);
        }
      }
    }
  }
  return out;
}

// Marker extraction (humility check: slice)
const subFieldDelim = String.raw`(?=\r?\n\s*(?:material\s*delta|drift\s*mode|humility\s*check|prior\s*verdict\s*quote)\s*:|\r?\n\s*\r?\n|$)`;

let markerPresent = false;
let driftValueRaw = null;
let deltaValueRaw = null;
let quoteValueRaw = null;

const markerMatch = lastAssistantText.match(/humility\s*check\s*:\s*(.+)$/is);
if (markerMatch) {
  const markerSlice = markerMatch[1];
  markerPresent = true;

  const driftM = markerSlice.match(new RegExp(String.raw`drift\s*mode\s*:\s*(.+?)` + subFieldDelim, 'is'));
  if (driftM) driftValueRaw = driftM[1];

  const deltaM = markerSlice.match(new RegExp(String.raw`material\s*delta\s*:\s*(.+?)` + subFieldDelim, 'is'));
  if (deltaM) deltaValueRaw = deltaM[1];

  const quoteM = markerSlice.match(new RegExp(String.raw`prior\s*verdict\s*quote\s*:\s*(.+?)` + subFieldDelim, 'is'));
  if (quoteM) quoteValueRaw = quoteM[1];
}

const driftValueNorm  = normalizeWS(driftValueRaw);
const deltaValueNorm  = normalizeWS(deltaValueRaw);
const quoteValueNorm  = normalizeWS(quoteValueRaw);

const twoFieldsPresent    = !!(driftValueNorm && deltaValueNorm);
const quotePresent        = !!quoteValueNorm;
const markerValuesPresent = twoFieldsPresent && quotePresent;

// Per-dispatch load-bearing check (marker values in same dispatch payload)
let loadBearingFound = false;
let anyDriftHit = false;
let anyDeltaHit = false;

if (twoFieldsPresent) {
  for (const block of lastTurnToolUseBlocks) {
    if (!isFF(block.name || '')) continue;
    const leaves = getAllStringLeaves(block.input);
    const payload = normalizeWS(leaves.join(' '));
    const hasDrift = payload.toLowerCase().includes(driftValueNorm.toLowerCase());
    const hasDelta = payload.toLowerCase().includes(deltaValueNorm.toLowerCase());
    if (hasDrift) anyDriftHit = true;
    if (hasDelta) anyDeltaHit = true;
    if (hasDrift && hasDelta) { loadBearingFound = true; break; }
  }
}

// Block helpers
const blockOutput = (reason) => {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
};

const writeRatchet = (count) => {
  if (stateFile && !readDegraded) {
    try { writeFileSync(stateFile, String(count)); } catch (e) {
      process.stderr.write(`stop-validation: state-file write failure on '${stateFile}' (${e.message}); proceeding with in-memory counter ${count}\n`);
    }
  }
};

// --- Decision tree ---

if (foreignFrontierFired) {
  if (!atThreshold) {
    // Below threshold: dispatch present, allow stop. Non-qualifying fire: no ratchet increment.
    process.exit(0);
  }

  // At/above threshold: full marker check (Refinements C + D)
  let markerBlockReason = null;

  if (!markerPresent || !twoFieldsPresent) {
    markerBlockReason = `RATCHET DETECTED — humility-check marker required at fire 3+.

Format: \`humility check:\` followed by three sub-fields:
  drift mode: <specific value>
  material delta: <specific value>
  prior verdict quote: <exact quote from a prior tool_result>

The marker must be present in surface text AND both drift/delta values must appear in the same foreign-frontier dispatch input payload. The prior verdict quote must match text in a prior transcript tool_result.

Per ~/.claude/practice/extended/drift-and-ratchet.md: at the threshold the dispatch alone is no longer enough. Name the specific drift mode, the specific material delta, and quote the actual prior audit verdict — not a paraphrase.`;

  } else if (!quotePresent) {
    markerBlockReason = `RATCHET DETECTED — prior verdict quote sub-field required at fire 3+ (Refinement D).

The humility check: marker requires three sub-fields at fire 3+:
  drift mode: <specific value>        ✓ present
  material delta: <specific value>    ✓ present
  prior verdict quote: <exact quote>  ✗ MISSING

The quote must be verbatim text from a prior tool_result in this session's transcript. This closes the cited-but-not-applied rationalization named in drift-and-ratchet.md: "I cited the prior dispatch and continued." Citing is not engaging. The quote forces substrate-coupling with what the prior audit actually said.`;

  } else if (!loadBearingFound) {
    if (anyDriftHit && anyDeltaHit) {
      markerBlockReason = `RATCHET DETECTED — marker fields appear in different dispatches.

Both \`drift mode\` and \`material delta\` must be in the SAME load-bearing dispatch payload. Splitting the audit framing across two dispatches breaks the coupling the gate is enforcing — the foreign-frontier read must see the COMPLETE framing it is auditing.

Re-dispatch a single foreign-frontier validator whose input contains both fields together.`;
    } else {
      markerBlockReason = `RATCHET DETECTED — humility-check marker present in surface text but not propagated into the foreign-frontier dispatch payload.

Per the audit pattern: passing the marker into the dispatch enables external review of the audit framing. A marker on surface text alone is cosmetic; the dispatch payload must carry the same drift-mode and material-delta values so the foreign frontier can audit the framing being claimed.

Re-dispatch with the marker values in the prompt/task input.`;
    }

  } else {
    // Load-bearing dispatch found — verify prior verdict quote in transcript tool_results (Refinement D)
    let quoteFoundInTranscript = false;
    try {
      const fullLines = readFileSync(transcriptPath, 'utf8').split('\n');
      const toolResultTexts = getToolResultTexts(fullLines);
      for (const txt of toolResultTexts) {
        if (normalizeWS(txt).toLowerCase().includes(quoteValueNorm.toLowerCase())) {
          quoteFoundInTranscript = true;
          break;
        }
      }
    } catch (e) {
      // Fail-open on transcript read error for quote check only — dispatch + payload checks passed
      process.stderr.write(`stop-validation: transcript read for quote-verification FAILED (${e.message}); skipping quote check (fail-open for D-only failure)\n`);
      quoteFoundInTranscript = true;
    }

    if (quoteFoundInTranscript) {
      // All checks pass — dispatch + marker + payload + quote. Allow stop.
      process.exit(0);
    }

    markerBlockReason = `RATCHET DETECTED — prior verdict quote not found in transcript tool_results.

The \`prior verdict quote: <value>\` sub-field must contain text that appears verbatim in some prior tool_result block in this session's transcript. The hook searched all tool_result entries and the normalized quote was not found.

This closes the cited-but-not-applied pattern: writing a plausible-sounding quote that does not actually appear in any tool_result. The quote must be verbatim text from an actual prior result — copy it directly rather than paraphrasing.`;
  }

  // Marker check failed — block. Do NOT increment ratchet (dispatch was present; marker-shape failure).
  blockOutput(`${markerBlockReason}


---

DELEGATION CANON ENFORCEMENT (~/.claude/canon/delegation-and-stall-discipline.md).

Stop-language detected in this turn ('${matchedPattern}') with foreign-frontier dispatch present BUT failing the threshold-level humility-marker verification.

The stop is blocked. Correct the marker and re-dispatch with the full framing.`);
}

// Foreign-frontier NOT fired: qualifying fire path. Increment ratchet.
let ratchetCount = 0;
if (sessionId && stateFile) {
  ratchetCount = readDegraded ? RATCHET_THRESHOLD : priorCount + 1;
  writeRatchet(ratchetCount);
}

let ratchetHeader = '';
if (ratchetCount >= RATCHET_THRESHOLD) {
  const ordinal = ratchetCount === 1 ? '1st' : ratchetCount === 2 ? '2nd' : ratchetCount === 3 ? '3rd' : `${ratchetCount}th`;
  ratchetHeader = `RATCHET DETECTED — this is the ${ordinal} qualifying Stop fire in this session.

Per ~/.claude/practice/extended/drift-and-ratchet.md: when foreign-frontier dispatch starts feeling redundant after a few fires, that feeling IS the drift mode, not principled efficiency. The cost of dispatching is small relative to what gets compounded if it's skipped.

---

`;
}

blockOutput(`${ratchetHeader}DELEGATION CANON ENFORCEMENT (~/.claude/canon/delegation-and-stall-discipline.md).

Stop-language detected in this turn ('${matchedPattern}') WITHOUT a foreign-frontier dispatch (mcp__gemini-worker / mcp__gpt-worker / mcp__grok-worker / mcp__glm-worker / mcp__ollama-* / WebSearch / WebFetch) in the same turn's tool calls.

Per canon (cited-but-not-applied failure mode): citing the canon at session start does not equal applying it at trigger time. The hook is the structural enforcement layer.

Required next action (in order, until one resolves):
  1. Verify against substrate — does source on disk already answer the question you are about to surface?
  2. If unclear, dispatch a foreign-frontier validator on the framing itself (not on a file — on the framing): "Operator-bound or substrate-resolvable? Here's what I have, here's what I'm about to ask."
  3. If the work is mechanical and the spec is known, dispatch an Agent (subagent_type=general-purpose).
  4. Only if all three resolve to "this genuinely needs the operator," surface the substantive question — explicitly classifying it as kernel-security / real-cost / operator-values-not-encoded-in-canon.

If the operator explicitly told you to wait / hold / pause earlier in the session, that is compliance, not stop-language reaching. Note that classification ("operator authorized waiting at <reference>") in the next surface and the hook will allow the next stop.

The stop is blocked. Reroute from re-anchored position.`);
