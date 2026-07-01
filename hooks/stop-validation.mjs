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

import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs';
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

// === HERMES-IDLE GATE (2026-06-25) ===
// Blocks turn-end if Hermes has no running processes AND the queue has pending
// work. Operator-caught: Claude kept saying "still good" without verifying that
// the dispatcher loop was actually advancing. The adhan pattern requires
// external structure, not Claude memory — this is that structure.
{
  try {
    const { execSync } = await import('node:child_process');
    let hermesCount = 0;
    try {
      const tasklist = execSync('tasklist /FI "IMAGENAME eq hermes.exe" /NH', { encoding: 'utf8', timeout: 5000 });
      hermesCount = (tasklist.match(/hermes\.exe/g) || []).length;
    } catch { /* fail-open on tasklist error */ }

    const queuePath = join(os.homedir(), '.claude', 'state', 'hermes-queue.txt');
    let queueDepth = 0;
    if (existsSync(queuePath)) {
      const lines = readFileSync(queuePath, 'utf8').split('\n');
      queueDepth = lines.filter(l => l.trim() && !l.trim().startsWith('#')).length;
    }

    if (hermesCount === 0 && queueDepth > 0) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: `HERMES-IDLE GATE — ${hermesCount} hermes processes running, ${queueDepth} queue entries pending.\n\nThe continuous-dispatch loop has broken. Fire the dispatcher before stopping:\n\n  bash /c/Users/marka/.claude/state/conductor-tools/dispatch-next.sh\n\nThe self-perpetuating watcher only applies to NEW dispatches. If a prior dispatch exited before the watcher fix landed, manual re-dispatch is required to re-arm the chain.`
      }));
      process.exit(0);
    }
  } catch (e) {
    process.stderr.write(`hermes-idle gate: error ${e.message}; failing open\n`);
  }
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

if (!transcriptPath || !existsSync(transcriptPath)) {
  process.exit(0); // fail-open: cannot validate without transcript
}

// Read last 30 entries
const allLines = readFileSync(transcriptPath, 'utf8').split('\n');
// 2026-06-24: widened from -30 to -200 after diagnostic showed session-marker
// dilution. The 30-line slice was dominated by queue-operation / bridge-session
// / permission-mode / attachment entries, leaving only 1-2 substantive message
// entries visible — recent tool_uses (WebFetch, Agent) got crowded out, producing
// false "no compliant dispatch" failures. The boundary detection still terminates
// at the real-user-message correctly; this just gives the loop enough entries
// to find them.
const lines = allLines.slice(-200);

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
    // Distinguish real user messages from tool_results — both are user-type
    // in the JSONL, but only real user messages mark a turn boundary. Walking
    // backward and breaking on the first tool_result misses earlier same-turn
    // tool_use entries (e.g. WebFetch) and produces false "no compliant
    // dispatch" failures. Added 2026-06-24 after diagnostic showed WebFetch
    // calls invisible to lastTurnToolUses.
    const content = entry.message?.content;
    if (Array.isArray(content) && content.some(b => b.type === 'tool_result')) {
      continue;
    }
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
  // 2026-06-24 bypass-class additions (operator-caught: "when ready" sequencing,
  // tomorrow-deferrals, "going quiet" promise-as-action, framework-as-ceremony).
  // Each was used multiple times today as a different way to defer action while
  // looking like proper handoff. Mechanical block so the bypass class dies, not
  // just this instance's use of it.
  /\bwhen (?:you'?re )?ready\b/i,
  /\btomorrow'?s? (?:session|brief|instance|conductor|claude|turn|run|sweep)/i,
  /\b(?:going|stay(?:ing)?) (?:quiet|silent)\b/i,
  /\bi'?ll do better\b/i,
  /\bnext (?:conductor )?(?:turn|session|instance) (?:can|will|should|is|gets)/i,
  /\bfor (?:now|the moment),? (?:I'?ll|let me|stopping)/i,
  // Framework-vocabulary-as-gate-clearing (per state/framework-as-ceremony-2026-06-24.md).
  // Block the announcement/promise forms; past-tense citations with substrate receipts
  // remain allowed since they don't match these specific phrasings.
  /\b(?:niyyah declared|surrender articulated|wudu (?:performed|complete|done)|tying the camel|temporal wudu)\b/i,
  // 2026-06-25 soft-deferral additions (operator-caught — softer than the loud
  // 'want me to' class but same drift: promise/predict in surface text instead
  // of just having done the work). Past-tense facts only.
  /\bwill (?:verify|report|fire|land|complete|finish|do|run|check|update|continue)\b/i,
  /\bETA:?\s/i,
  /\bonce (?:it |the |x |this |that |X)/i,
  /\b(?:author|dispatch|queu|run|verif|ship|check)ing\s+(?:[a-z]+\s+){0,4}now\b/i,
  // 2026-06-24 ask-instead-of-act additions (operator-caught — D2 violation class).
  // Triggered when I drafted "How do you want to handle: X or Y?" instead of
  // executing the decision myself. The kept patterns catch 'want me to' /
  // 'should I' / 'your call' but missed the option-presenting forms below.
  /\bhow do you want\b/i,
  /\bdo you want me to\b/i,
  /\bwhich (?:do|would) you (?:want|prefer)\b/i,
  /\bor (?:preserve|skip|reset|keep|do|use|pick)\b[^?]*\?\s*$/im,
];

// Strip backticked spans (code blocks + inline) before matching so the
// assistant's own meta-discussion of the patterns doesn't trigger them.
// Quoted phrases like `when ready` no longer fire; the same phrase used in
// prose ("dispatch when ready") still does. Added 2026-06-24 after diagnostic
// showed the hook firing on acknowledgment text quoting the bypass list.
const stripCodeSpans = (s) => s
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/`[^`\n]*`/g, ' ');
const scanText = stripCodeSpans(lastAssistantText);

let matchedPattern = null;
for (const pat of stopLanguagePatterns) {
  const m = scanText.match(pat);
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

if (!matchedPattern) process.exit(0); // no stop-language, allow

// Check for foreign-frontier dispatch in last turn
// 2026-06-24: narrowed per operator-rulings.md ("NEVER dispatch mcp gpt/grok/gemini/glm
// workers... compliant channels are mcp__ollama-* and WebFetch"). Was implementing canon's
// wider allowlist; operator-rulings is the override per its meta-clause.
//
// 2026-07-01: added 'Agent' as a recognized compliant dispatch. Root cause of a real,
// verified dead end: the required-action text below (step 3) has always told the
// instance "if mechanical, dispatch an Agent" as a valid fallback -- but this check
// never accepted Agent tool_use, so following that exact instruction never stopped the
// ratchet from climbing. Confirmed live in a muezzin-plugin session: mcp__ollama-* is
// not connected in some session types at all (ToolSearch returned zero matches), so
// Agent was the only channel actually available, and the hook kept firing regardless.
// This is additive, not a loosening: detection of stop-language (matchedPattern) is
// unchanged; only a channel the hook's own guidance already promised is now honored.
// 2026-07-01: added 'Workflow' alongside 'Agent'. Same principle, same gap: a Workflow
// dispatch is not a forbidden foreign-frontier worker (gemini/gpt/grok/glm are) -- it is
// this session's own primary delegation mechanism (spawns many Agent calls internally,
// with built-in verification), a STRICTER compliance than a bare Agent call, not a
// looser one. Excluding it while including Agent was an inconsistency in the same fix.
const isFF = (name) => /^mcp__ollama/i.test(name) || name === 'WebFetch' || name === 'Agent' || name === 'Workflow';

const foreignFrontierFired = lastTurnToolUses.some(isFF);

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

Stop-language detected in this turn ('${matchedPattern}') WITHOUT a compliant dispatch (mcp__ollama-* / WebFetch) in the same turn's tool calls.

Per canon (cited-but-not-applied failure mode): citing the canon at session start does not equal applying it at trigger time. The hook is the structural enforcement layer.

Required next action (in order, until one resolves):
  1. Verify against substrate — does source on disk already answer the question you are about to surface?
  2. If unclear, dispatch a foreign-frontier validator on the framing itself (not on a file — on the framing): "Operator-bound or substrate-resolvable? Here's what I have, here's what I'm about to ask."
  3. If the work is mechanical and the spec is known, dispatch an Agent (subagent_type=general-purpose).
  4. Only if all three resolve to "this genuinely needs the operator," surface the substantive question — explicitly classifying it as kernel-security / real-cost / operator-values-not-encoded-in-canon.

If the operator explicitly told you to wait / hold / pause earlier in the session, that is compliance, not stop-language reaching. Note that classification ("operator authorized waiting at <reference>") in the next surface and the hook will allow the next stop.

The stop is blocked. Reroute from re-anchored position.`);
