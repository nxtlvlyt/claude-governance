// muezzin-daemon.mjs — THE standing muezzin (root fix, 2026-06-09).
// The conductor (a turn-based Claude session) cannot be the engine's crankshaft: it
// sleeps between invocations and detached missions never ping it back. This daemon is
// the external caller the adhan-pattern prescribes: it drains missions/AUTORUN.md
// serially, marks outcomes, writes a status surface, and keeps going while everyone
// sleeps. Conductor sessions READ status and do judgment; the queue never waits on a
// conversation.
//
// AUTORUN.md format: one mission-file path per line (relative to plugin root).
//   '#' comments allowed. The daemon rewrites lines in place: 'DONE <line>' or
//   'FAILED <line>' (one retry before FAILED — except a RECURRING-HALT, 2026-07-01: a
//   proven identical-error pattern skips the remaining retry, see shouldHaltMission).
//   Append new lines anytime — the daemon picks them up on its next poll. Conductor/
//   operator curates; daemon executes.
//
//   Terminal statuses: DONE (succeeded), FAILED (failed after retries), SPLIT (Hajj
//   auto-split decomposed it — children carry the work), and PARKED (operator-marked
//   permanently blocked — never re-fired, never auto-promoted, never resurrected).
//   A PARKED line is the conductor's single-mark alternative to FAILED-prefixing every
//   AUTORUN occurrence of a broken mission. Added 2026-06-25 after a 54-line FAILED-spam
//   incident: write `PARKED missions/x.mission.txt  <!-- reason -->` once and the engine
//   will never pick that path again — the file stays on disk for triage / re-queue.
//
// Run: node muezzin-daemon.mjs            (foreground)
//      Start-Process node muezzin-daemon.mjs  (standing)
// Self-test: node muezzin-daemon.mjs --selftest

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync, rmSync, mkdtempSync, readdirSync, statSync } from 'fs';
import { lintMission } from './mission_lint.mjs';
import { parseMissionClass } from './mission_class.mjs';
import { witnessArtifact, buildAfterContext } from './self_witness.mjs';
import { heal as conductCycleHeal, missionLandedState } from './conduct-cycle.mjs';
import { searxngPreflight } from './searxng_preflight.mjs';
import { execSync, execFile } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUTORUN = path.join(HERE, 'missions', 'AUTORUN.md');
const LOGDIR = path.join(HERE, 'missions', '_logs');
const RELOAD_FLAG = path.join(LOGDIR, 'RELOAD-REQUEST');   // graceful self-reload, honored between missions (see mainLoop)
const CANARY_STATE = path.join(LOGDIR, 'live-canary.json');            // LIVE-CANARY (#29): last run + verdict, survives reloads
const CANARY_SCRIPT = 'C:/Users/marka/code/mt-integration-2026-06-22/scripts/verify-popups-e2e.mjs';
let canaryRunning = false;                                             // one canary at a time; never blocks the drain loop
const STATUS = path.join(LOGDIR, 'daemon-status.json');
const EVENTS = path.join(LOGDIR, 'daemon-events.log');
const POLL_MS = 60_000;
const MAX_ATTEMPTS = 2; // one retry, then FAILED — repeated failure needs judgment, not loops
                        // (shouldHaltMission, defined below, can also halt BEFORE this budget is
                        // spent, on a proven recurring-error pattern — see its own doc comment)
const MAX_LANES = Number(process.env.MUEZZIN_MAX_LANES) || 2;    // default 2 (operator-rulings.md "2 parallel lanes max" — a CEILING). ENV-ADJUSTABLE 2026-06-17: a SINGLE-REPO batch (e.g. the 12 muddytires missions all sharing worktree oracle-frontend-swap, many editing index.html/map.html) genuinely COLLIDES at 2 lanes — concurrent edits to the same files trip the clean-worktree preflight + containment-drift guard (real lost-edit hazard, NOT a false positive). Launch with MUEZZIN_MAX_LANES=1 to SERIALIZE such a batch (the deep queue still drains continuously, just collision-free). PROPER fix (engine item): per-REPO lane scheduling — co-schedule only DIFFERENT-repo missions at 2 lanes, serialize same-repo. Until then this env serializes single-repo batches.
                        // (history) operator TEMP ruling 2026-06-12 ~04:00 (his words: "drop down to 1
                        // mission at a time to manage our usage until Tuesday") — restore to 2
                        // on/after Tuesday 2026-06-16, by his word only.
                        // Standing baseline below stays the reference for the restore:
                        // operator STANDING ruling (operator-rulings.md: "2 parallel lanes
                        // max, 2026-06-10, quota discipline") + every beat-cron order since.
                        // That standing file outranks the transient 19:45 raise recorded
                        // below; if he re-raises, change BOTH here and the rulings file.
                        // [historical: 2026-06-10 19:45 briefly raised 2->3 ("under 50% of the
                        // 4h window on BOTH budgets, run more in parallel"). The morning's
                        // 2-lane cut was quota triage for burn bugs (kimi thinking-burn,
                        // tool-loop re-billing) that are FIXED — usage is low BECAUSE of
                        // those fixes. 3 = the original plan value (stated twice 2026-06-09).
                        // If a session-quota 429 wave returns, drop to 2 first, not 1.
                        // ONE daemon owns AUTORUN.md (no file races); each lane has its own
                        // sandbox. Local models stay serial per GR10 — this is cloud-lane
                        // concurrency.

mkdirSync(LOGDIR, { recursive: true });

// ---- searchReadinessGate (M-READINESS-GATE.1) --------------------------------------
// A mission whose text REQUIRES search must NOT burn an attempt firing into a blind
// SearXNG backend (the "SOTA search broken -> every phase-1 failed" class). This gate
// runs BEFORE attempts++ in fire(): no-search-requirement -> fire; backend live -> fire;
// backend blind -> heal once (docker restart searxng) -> re-probe -> fire if live else
// HOLD (line stays pending, NO attempt spent); 3 consecutive holds -> BLOCK with receipt.
// PURE + fully injectable (probe/heal/holds/key) so it unit-tests with zero network and
// zero daemon. It NEVER throws — any internal error resolves to 'hold' (fail-soft: a gate
// bug must never stall the dispatch loop, the exact risk the audit flagged for async fire).
export async function searchReadinessGate(missionText, { probe, heal, holds = new Map(), key = 'default', maxHolds = 3 } = {}) {
  try {
    if (!/REQUIRES?:[^\n]*\bsearch\b/i.test(String(missionText || ''))) return { action: 'fire', reason: 'no search requirement' };
    const usable = (v) => v && v.verdict === 'OK' && (v.results || 0) > 0;
    let v = await probe();
    if (usable(v)) { holds.delete(key); return { action: 'fire', reason: `search live (${v.results} results)` }; }
    // blind: attempt one heal, then re-probe
    if (typeof heal === 'function') { try { await heal(); } catch { /* heal best-effort */ } }
    v = await probe();
    if (usable(v)) { holds.delete(key); return { action: 'fire', reason: `search live after heal (${v.results} results)` }; }
    const n = (holds.get(key) || 0) + 1; holds.set(key, n);
    if (n >= maxHolds) { holds.delete(key); return { action: 'block', reason: `search blind: probed + healed + re-checked ${n}x, backend still down (${v?.reason || 'no verdict'})` }; }
    return { action: 'hold', reason: `search blind (hold ${n}/${maxHolds}): ${v?.reason || 'backend down'}` };
  } catch (e) {
    return { action: 'hold', reason: `readiness-gate internal error (fail-soft to hold): ${e.message}` };
  }
}

const evt = (m) => { const line = `${new Date().toISOString()} ${m}`; try { appendFileSync(EVENTS, line + '\n'); } catch { } console.log(line); try { stormWatch(m); } catch { /* storm-alert must never break logging */ } };

// OPERATOR PUSH (structural fix 2026-06-10: two conductor instances promised chat-beat
// status updates; both beats were skipped because session crons fire only when the
// Claude session is idle — and die with it. Updates must come from the process that
// never sleeps: this daemon). Transport: Discord webhook — URL pasted by the operator
// into the state file below; read PER CALL so no restart is needed when it appears.
// Fail-silent and fire-and-forget: a push must never break or delay dispatch.
const WEBHOOK_FILE = path.join(os.homedir(), '.claude', 'state', 'muezzin-webhook.txt');
function notify(text) {
  try {
    const url = readFileSync(WEBHOOK_FILE, 'utf8').trim();
    if (!url.startsWith('https://')) return;
    const msg = String(text).slice(0, 1900);
    // ntfy (operator's pick 2026-06-10 — no account, app subscribes to a topic):
    // plain-text body POST. Discord webhooks (rejected but kept working): JSON content.
    const isNtfy = /https:\/\/ntfy\.sh\//.test(url) || /\/ntfy\//.test(url);
    fetch(url, isNtfy
      ? { method: 'POST', headers: { 'Title': 'muezzin', 'Tags': 'mosque' }, body: msg }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg }) }
    ).catch(() => { /* push is best-effort */ });
  } catch { /* no webhook configured -> no-op */ }
}

// STORM-ALERT (self-healing audit 2026-07-02: 100% of the audited window's incidents were
// operator-invisible — 66,098 missing-file repeats over 6.6h, 8,201 supervisor spawns over 7h,
// 5,096 kimi-404s over 22 days — each a REPEATING SIGNATURE nothing watched for). Every engine
// event already flows through evt(); this watches that one choke point and pushes ONCE per
// signature at 3 hits, plus once more at 50 as escalation. Hashes/numbers are normalized out of
// the signature so "attempt 2" vs "attempt 9" collapse to one storm. Outcome-only ruling: the
// push IS the outcome ("the engine is storming"); repeats of a known storm are noise — hence
// per-signature one-shot + a global cap of 5 storm pushes per hour.
export function stormSig(m) {
  if (!/FAILED|DISPATCH|ERROR|\berr\b|EMPTY|STUCK|HALT/i.test(String(m))) return null;
  return String(m).replace(/[a-f0-9]{7,40}/gi, 'H').replace(/\d+/g, 'N').slice(0, 120);
}
const stormState = { counts: new Map(), pushes: [] };
// CAUSE-CLASS second signature (2026-07-03, live-receipted blindness: a 45-minute HTTP_503
// storm produced ZERO pushes because each FAILED line named a DIFFERENT mission — per-mission
// signatures rotate while the CAUSE stays constant. This was the audit's named
// "rotating-signature churn" gap firing in production.) Alongside the per-line signature,
// count the bare ERROR-KIND token: constant across a real storm, distinct across unrelated
// failures. Same 3-hit/50-hit/one-shot/hourly-cap discipline.
export function stormCauseSig(m) {
  const c = String(m).match(/HTTP_\d{3}|\bTIMEOUT\b|missing file|EMPTY_CONTENT|MIQAT-REFUSED|RETRO-REPEAT-BLOCKED/i);
  return c ? `CAUSE:${c[0].toUpperCase()}` : null;
}
export function stormWatch(m, S = stormState, notifyFn = notify, now = Date.now()) {
  try {
    const lineSig = stormSig(m); if (!lineSig) return null;
    if (S.counts.size > 500) S.counts.clear();                          // bounded memory across days-long runs
    // The cause-class counter counts only NOVEL line signatures: identical repeats are the
    // line-sig's job (else 50 identical failures would double-push line+cause with the same
    // info — regression caught by the existing one-shot selftest). Rotation = novel lines,
    // constant cause — exactly and only what the cause-class exists to catch.
    const lineIsNovel = !S.counts.has(lineSig);
    let fired = null;
    for (const sig of [lineSig, lineIsNovel ? stormCauseSig(m) : null].filter(Boolean)) {
      const n = (S.counts.get(sig) || 0) + 1; S.counts.set(sig, n);
      if (n !== 3 && n !== 50) continue;                                // one-shot at 3, escalation at 50
      S.pushes = S.pushes.filter((t) => now - t < 3600e3);
      if (S.pushes.length >= 5) continue;                               // hourly cap (outcome-only ruling)
      S.pushes.push(now);
      const capNote = S.pushes.length === 5 ? ' [5th storm push this hour — further storm alerts suppressed]' : '';
      const kind = sig.startsWith('CAUSE:') ? `same failure CAUSE (${sig.slice(6)}) across missions` : 'same failure signature';
      fired = `ENGINE STORM${n === 50 ? ' x50 ESCALATION' : ''}: ${kind} ${n}x this daemon run — ${String(m).slice(0, 180)}${capNote}`;
      notifyFn(fired);
    }
    return fired;
  } catch { return null; /* a storm alert must never break evt */ }
}
const setStatus = (s) => { try { writeFileSync(STATUS, JSON.stringify({ pid: process.pid, ...s, ts: new Date().toISOString() }, null, 2)); renderBoard(s); } catch { } };

// OPERATOR STATUS BOARD (2026-06-10: "I still don't think our updates are happening").
// Conversation-delivered updates can only fire while the REPL is idle — exactly when
// the operator ISN'T watching. This board is independent of any conversation: the
// daemon re-renders it on every status write. Operator opens ONE file, always current:
//   muezzin-plugin/missions/_logs/STATUS-BOARD.md
const BOARD_PATH = path.join(LOGDIR, 'STATUS-BOARD.md');

// Per-lane PHASE from its mission-events.jsonl (operator 2026-06-10: "what phases are
// our current missions on") — plan / step X of Y / verify, derived, never guessed.
function lanePhase(missionLine) {
  try {
    const name = path.basename(missionPath(missionLine)).replace(/\.mission\.txt$/i, '');
    const evPath = path.join(HERE, 'missions', name, 'mission-events.jsonl');
    if (!existsSync(evPath)) return 'starting';
    const lines = readFileSync(evPath, 'utf8').trim().split('\n');
    let stepCount = '?';
    for (let i = lines.length - 1; i >= 0; i--) {
      try { const e = JSON.parse(lines[i]); if (e.event === 'ok' && e.phase === 'plan' && e.step_count) { stepCount = e.step_count; break; } } catch { }
    }
    const last = JSON.parse(lines[lines.length - 1]);
    const age = Math.round((Date.now() - new Date(last.ts).getTime()) / 60000);
    if (last.phase === 'plan') return `PLANNING (${age}m in this phase)`;
    if (last.phase === 'step') return `step ${last.step}/${stepCount} ${last.event} (${age}m ago)`;
    return `${last.phase}/${last.event} (${age}m ago)`;
  } catch { return 'unknown'; }
}

// MISSION RETRO (operator 2026-06-10: "records of before and after missions and things
// we can learn from... how to make a local model successful"). On every terminal
// outcome the daemon writes a machine-extracted retrospective — plan attempts, steps,
// heals, halts, duration, error kinds — to _logs/retro/ and one summary line to the
// cumulative MISSION-LEDGER.md. The learning corpus writes ITSELF; no conductor memory
// involved. This is rijal-for-missions and the local-conductor curriculum.
// MODEL ATTRIBUTION + RETRY-CHAIN — schema additions (2026-06-25, operator-authorized).
// Today's audit found 40/1210 retros named a model and 0/1210 ledger rows had a model
// column: per-mission attribution was invisible, so a Jun 22-24 b13 retry storm (493
// rows, same mission_id) was indistinguishable from real conductor attempts. These two
// helpers are ADDITIVE — they emit values for two NEW trailing ledger columns and two
// NEW retro header lines without changing any existing column or line. The existing
// `| ts | mission_id | status | duration | plan_metrics |` format keeps its 1210
// historical entries intact; only new rows carry the appended `| model | retry_of |`.
//
// PURE: takes the events array (already loaded by writeRetro) and the orchestrate
// result; returns 'unknown' when neither source names a model. Prefers the EXECUTOR
// seat (impl?.model on r.steps[]) over the planner (plan event's model) because the
// executor authored the artifacts being judged — that's the model attribution that
// matters for "which model can complete this mission class". Both sources are scanned
// fail-soft; any non-string value becomes 'unknown'.
function deriveAttemptModel(events, result) {
  try {
    // 1) executor model from orchestrate's step receipts (impl.model carried through
    //    on r.steps[]). First step with a string .model wins — every step the executor
    //    ran typically carries the SAME model name in a given attempt.
    for (const s of (result?.steps || [])) {
      const m = s && typeof s.model === 'string' && s.model.trim();
      if (m) return m;
    }
    // 2) fallback to the plan-phase model emitted on `{phase:'plan', event:'ok', model:...}`
    //    (the deconstructor's seat). This is at least a real seat that ran for this mission.
    for (const e of events) {
      if (e?.phase === 'plan' && e?.event === 'ok' && typeof e?.model === 'string' && e.model.trim()) return e.model.trim();
    }
    // 3) any badal-escalation / seat-escalated-dispatch event also carries .model
    for (const e of events) {
      if (typeof e?.model === 'string' && e.model.trim()) return e.model.trim();
    }
  } catch { /* fail-soft */ }
  return 'unknown';
}

// PURE-ENOUGH: reads the LAST page of MISSION-LEDGER.md (cheap — bounded tail) to find
// the most recent terminal row whose mission_id matches `name`. Returns `<name>@<ts>`
// (ISO trimmed to seconds) or '' when no prior attempt exists in the ledger. The tail
// bound keeps this O(1) regardless of how large the ledger grows. Fail-soft: any read
// or parse error returns '' (a fresh-attempt classification — never a false retry).
//
// WHY THIS SHAPE: the operator's purpose for retry_of is post-hoc audit: "the b13 spam
// loop on Jun 22-24 had 493 retries — those should chain to one another so an audit
// can see the chain, not look like 493 independent conductor decisions". A per-row
// pointer to the immediate prior attempt is the minimum primitive that makes the chain
// reconstructible by walking backwards from any failure row.
function computeRetryOf(name, ledgerPath) {
  try {
    if (!existsSync(ledgerPath)) return '';
    // bounded tail read — last ~64KB is far more than enough for the most recent prior
    // attempt of any given mission_id (a busy day writes ~1KB of ledger).
    const raw = readFileSync(ledgerPath, 'utf8');
    const tail = raw.length > 65536 ? raw.slice(-65536) : raw;
    const lines = tail.split(/\r?\n/);
    // walk lines bottom-up: the FIRST match is the most recent prior attempt.
    for (let i = lines.length - 1; i >= 0; i--) {
      const cells = lines[i].split('|').map((c) => c.trim());
      // expected shape: ['', ts, mission_id, verdict, duration, plan_metrics, model?, retry_of?, '']
      if (cells.length < 6) continue;
      if (cells[2] !== name) continue;
      const ts = cells[1];
      if (!ts || !/^\d{4}-\d{2}-\d{2}T/.test(ts)) continue;
      // truncate ISO timestamp to seconds: '2026-06-24T21:30:00.123Z' -> '2026-06-24T21:30:00Z'
      const tsSec = ts.replace(/\.\d+Z$/, 'Z').replace(/(\d{2}:\d{2}:\d{2})(\.\d+)?Z?$/, '$1Z');
      return `${name}@${tsSec}`;
    }
  } catch { /* fail-soft — return '' (fresh attempt) */ }
  return '';
}

function writeRetro(raw, result, attempt) {
  try {
    const name = path.basename(raw).replace(/\.mission\.txt$/i, '');
    const evPath = path.join(HERE, 'missions', name, 'mission-events.jsonl');
    const evs = existsSync(evPath) ? readFileSync(evPath, 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
    const planTries = evs.filter((e) => e.phase === 'plan' && e.event === 'start').length;
    const committed = evs.filter((e) => e.event === 'committed').length;
    const heals = evs.filter((e) => e.event === 'heal').length;
    const halts = evs.filter((e) => /halt|integrity-block/.test(e.event || ''));
    const t0 = evs.length ? new Date(evs[0].ts).getTime() : Date.now();
    const mins = Math.round((Date.now() - t0) / 60000);
    const verdict = result?.ok ? 'DONE' : `FAILED(${result?.phase || '?'})`;
    const retroDir = path.join(LOGDIR, 'retro'); mkdirSync(retroDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    // Model attribution + retry chain (ADDITIVE schema additions, 2026-06-25): derive
    // model from executor receipts / plan events (falls back to 'unknown'); compute the
    // prior-attempt reference from a bounded tail of the existing ledger. Both helpers
    // are fail-soft — they never throw, so retro emission stays as reliable as it was.
    const ledgerPath = path.join(LOGDIR, 'MISSION-LEDGER.md');
    const model = deriveAttemptModel(evs, result);
    const retryOf = computeRetryOf(name, ledgerPath);
    const body = [
      `# RETRO ${name} — ${verdict} (attempt ${attempt}, ${mins}m total)`,
      `model: ${model}`,
      `retry_of: ${retryOf}`,
      `events: ${evs.length} | plan-phases: ${planTries} | steps-committed: ${committed} | heals: ${heals} | halts: ${halts.length}`,
      ``,
      `## Halts/blocks (verbatim — the learning material)`,
      ...(halts.length ? halts.map((h) => `- step ${h.step}: ${String(h.error || h.violations || '').slice(0, 200)}`) : ['- none']),
      ``,
      `## Local-model readiness signals`,
      `- self-healed without conductor: ${heals > 0 && result?.ok ? 'YES' : heals > 0 ? 'healed but still failed' : 'no heals needed/attempted'}`,
      `- conductor intervention required: ${result?.ok ? 'NO' : 'YES — see halts above; classify into validator-bug / mission-text / capability gap'}`,
    ].join('\n');
    writeFileSync(path.join(retroDir, `${name}-${stamp}.md`), body);
    // Ledger row — APPENDED columns at the END so the 1210 historical entries still
    // parse with the old `| ts | mission_id | status | duration | plan_metrics |` reader.
    // New rows carry `| ... | model | retry_of |` so future audits can attribute and chain.
    appendFileSync(ledgerPath, `| ${new Date().toISOString()} | ${name} | ${verdict} | ${mins}m | plans:${planTries} steps:${committed} heals:${heals} halts:${halts.length} | ${model} | ${retryOf} |\n`);
  } catch { /* retro must never break the daemon */ }
}

function renderBoard(s) {
  try {
    const q = readQueue();
    const ledgerLines = existsSync(AUTORUN) ? readFileSync(AUTORUN, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')) : [];
    const done = ledgerLines.filter((l) => statusOf(l) === 'DONE').length;
    const failed = ledgerLines.filter((l) => statusOf(l) === 'FAILED').length;
    const parked = ledgerLines.filter((l) => statusOf(l) === 'PARKED').length;
    const ev = existsSync(EVENTS) ? readFileSync(EVENTS, 'utf8').trim().split('\n').slice(-8) : [];
    const hbPath = path.join(LOGDIR, 'dispatch-heartbeat.log');
    const hb = existsSync(hbPath) ? readFileSync(hbPath, 'utf8').trim().split('\n').slice(-5) : [];
    const lines = [
      `# MUEZZIN STATUS BOARD  (auto-rendered by daemon PID ${process.pid} — always current)`,
      `Updated: ${new Date().toISOString()}  |  state: ${s.state || '?'}  |  lanes: ${(s.lanes || []).length}/${MAX_LANES}  |  queued: ${q.pending.length}`,
      `TOTALS this queue: ${done} DONE · ${failed} FAILED · ${(s.lanes || []).length} running · ${q.pending.length} pending${parked ? ` · ${parked} PARKED` : ''}   (cumulative history: _logs/MISSION-LEDGER.md)`,
      ``,
      `## Lanes now (with phase)`,
      // lanes are now {path, start_ts} objects (2026-07-01, so detectStuckLanes can compute
      // age) -- extract .path here for legacy string-shaped renderers/callers.
      ...((s.lanes || []).length ? (s.lanes || []).map((l) => { const lp = typeof l === 'string' ? l : l?.path; return `- ${lp} — ${lanePhase(lp)}`; }) : ['- (idle)']),
      ``,
      `## Ledger (AUTORUN)`,
      ...ledgerLines.map((l) => `- ${l}`),
      ``,
      `## Last daemon events`,
      ...ev.map((l) => `- ${l}`),
      ``,
      `## Last dispatch heartbeats (working vs hung — the line age tells you which)`,
      ...(hb.length ? hb.map((l) => `- ${l}`) : ['- (none yet)']),
    ];
    writeFileSync(BOARD_PATH, lines.join('\n'));
  } catch { /* the board must never break the daemon */ }
}

// SINGLETON LOCK (improvement 0a — three daemons raced the queue 2026-06-09, two of
// them spawned BY the commit gate running this file bare). One daemon, ever; the
// pidfile doubles as the instance-registry entry for the dashboard.
const PIDFILE = path.join(LOGDIR, 'daemon.pid');
function pidAlive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
function acquireSingleton(pidfile = PIDFILE) {
  try {
    if (existsSync(pidfile)) {
      const old = parseInt(readFileSync(pidfile, 'utf8').trim(), 10);
      if (Number.isInteger(old) && old > 0 && pidAlive(old)) return { ok: false, holder: old };
    }
  } catch { /* unreadable pidfile -> stale, claim it */ }
  writeFileSync(pidfile, String(process.pid));
  return { ok: true };
}

// PUSH VALUE LAYER (operator 2026-06-11: a push should carry the root of a failure,
// its DISPOSITION, the POINT of the mission, and what's NEXT): one-line purpose from
// the mission's Maqsad/Niyyah + the next pending mission's purpose. Bounded, fail-open.
function missionPoint(missionFile) {
  try {
    const txt = readFileSync(missionFile, 'utf8');
    const m = txt.match(/Maqsad:\s*([^\n]+)/i) || txt.match(/Niyyah:\s*([^\n]+)/i);
    return m ? m[1].trim().slice(0, 130) : '';
  } catch { return ''; }
}
function nextUpLine() {
  try {
    const { pending } = readQueue();
    if (!pending.length) return 'NEXT: queue empty';
    const nraw = pending[0].raw;
    const npoint = missionPoint(path.resolve(HERE, nraw));
    return 'NEXT: ' + path.basename(nraw).replace(/\.mission\.txt$/, '') + (npoint ? ' — ' + npoint : '');
  } catch { return ''; }
}

// scoreboard line for pushes (operator: every push must carry the counts, not just an event)
// BUG 3 (2026-06-25): PARKED is a terminal status — count it as its own class so it doesn't
// inflate the "pending" tally. Pending = total - all terminal/active classes.
function scoreLine() {
  try {
    const lines = readFileSync(AUTORUN, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
    const n = (s) => lines.filter((l) => l.trim().startsWith(s)).length;
    const pending = lines.length - n('DONE') - n('RUNNING') - n('FAILED') - n('SPLIT') - n('PARKED');
    return `${n('DONE')} done · ${n('RUNNING')} running · ${pending} pending · ${n('FAILED')} failed${n('PARKED') ? ` · ${n('PARKED')} parked` : ''}`;
  } catch { return ''; }
}

// A queue line is canonically: [STATUS ]<mission-path>[  <!-- ts -->]. Parse by MISSION
// PATH, never by full-line text — the 2026-06-09 root cause was markLine prepending a
// status onto an already-status+comment line, corrupting it so re-match failed (DONE
// written to the wrong place) AND it still passed the pending filter (re-fired as
// "missing file"). missionPath() is the single source of identity for every operation.
// SPLIT (queue-flow-1, 2026-06-16): a terminal status for a parent mission the Hajj
// auto-split decomposed into sub-missions (orchestrate phase:split). Like DONE/FAILED it
// is a SETTLED outcome — the parent is NOT re-fired (its children carry the work). Added
// to STATUS_RE so a SPLIT line is excluded from pending, strips cleanly in missionPath,
// and reports 'SPLIT' in statusOf (board/scoreboard render it as its own class).
// PARKED (2026-06-25): operator-marked permanent block. Same parser treatment as DONE/
// FAILED/SPLIT — settled, never re-fired, excluded from pending, excluded from auto-
// promotion. The single-mark alternative to FAILED-prefixing every AUTORUN occurrence
// of a broken mission (the 54-line spam fix). The file stays on disk for triage.
const STATUS_RE = /^(DONE|FAILED|RUNNING|SPLIT|PARKED)\b/;
function missionPath(line) {
  let s = String(line).replace(/<!--.*?-->/g, '').trim();
  while (STATUS_RE.test(s)) s = s.replace(STATUS_RE, '').trim(); // strip STACKED statuses (tonight's corruption)
  return s;
}
function statusOf(line) { const m = String(line).trim().match(STATUS_RE); return m ? m[1] : null; }

// PURE: does this result warrant a SELF-WITNESS AFTER pass? (M-ENGINE.CONDUCTOR-SELF-WITNESS.1,
// operator principle 2026-06-16: witness BEFORE *and* AFTER.) ONLY a genuinely COMPLETED
// mission gets its produced RESULT checked against its own "Done means" — i.e. r.ok AND NOT a
// split. A SPLIT (r.split) was decomposed, not executed: it has no produced output to verify.
// A FAILED result (r.ok falsy) likewise produced no Done-satisfying output to witness. Exported
// so the daemon selftest can lock "after fires on DONE only, never on split/failed".
export function shouldWitnessAfter(r) { return !!(r && r.ok && !r.split); }

function readQueue() {
  if (!existsSync(AUTORUN)) return { lines: [], pending: [] };
  const lines = readFileSync(AUTORUN, 'utf8').split(/\r?\n/);
  // QUEUE-DUP GUARD (2026-07-03, operator: "is there nothing stopping the conductor from
  // double-queuing missions?" — receipts: the heal double-requeue DUPLICATE-RETIRED scar +
  // the 06:43 gap-promotion dup, both hand-caught). The same path on two actionable lines
  // means the second copy refires after the first concludes (setMark marks only the FIRST
  // match) — a stealth attempt-counter reset. Mechanics: only the FIRST bare line per path
  // is pending; later bare copies are skipped + surfaced as QUEUE-DUP events. A bare line
  // whose path carries a STATUS on any other line is likewise never fired (the legitimate
  // requeue pattern re-bares the EXISTING line; an appended second line beside a FAILED
  // mark is exactly the anti-pattern the scar names).
  const statusPaths = new Set(lines.filter((l) => !l.trim().startsWith('#') && statusOf(l)).map((l) => missionPath(l)).filter(Boolean));
  const seen = new Set();
  const pending = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('#') || statusOf(line)) continue;
    const raw = missionPath(line);
    if (!raw) continue;
    if (seen.has(raw) || statusPaths.has(raw)) {
      try { evt(`QUEUE-DUP skipped: line ${i + 1} duplicates ${raw} (${seen.has(raw) ? 'an earlier pending line' : 'a status line elsewhere'}) — not fired; conductor should DUPLICATE-RETIRE the extra line`); } catch { /* event log is best-effort */ }
      continue;
    }
    seen.add(raw);
    pending.push({ raw, i });
  }
  return { lines, pending };
}

// Crash recovery: stale RUNNING lines (a dead daemon's in-flight lanes) revert to bare pending.
function reclaimStaleRunning() {
  if (!existsSync(AUTORUN)) return;
  const lines = readFileSync(AUTORUN, 'utf8').split(/\r?\n/);
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (statusOf(lines[i]) === 'RUNNING') { lines[i] = missionPath(lines[i]); changed = true; }
  }
  if (changed) writeFileSync(AUTORUN, lines.join('\n'));
}

// Set a mission's line to a canonical state, matched by mission PATH. status '' = revert
// to bare (pending). One status, never stacked; comment is replaced, not appended.
function setMark(raw, status) {
  const lines = readFileSync(AUTORUN, 'utf8').split(/\r?\n/);
  const idx = lines.findIndex((l) => !l.trim().startsWith('#') && missionPath(l) === raw);
  if (idx < 0) return false;
  lines[idx] = status ? `${status} ${raw}  <!-- ${new Date().toISOString()} -->` : raw;
  writeFileSync(AUTORUN, lines.join('\n'));
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-QUEUE FROM SUBSTRATE (queue-flow-1, 2026-06-16 — Half B). The operator's
// recurring "when does X get queued?": a CONSTRUCTED mission file sits on disk doing
// nothing until a conductor MANUALLY appends it to AUTORUN. This promotes the next
// ready constructed mission into the queue automatically when a lane frees — WITHOUT
// replacing manual append (it only FILLS GAPS) and NEVER promoting a triaged mission.
//
// THE SAFETY INVARIANT (the design's whole spine): a mission whose path appears
// ANYWHERE in AUTORUN.md — as a live pending line, a DONE/FAILED/RUNNING/SPLIT status
// line, OR a `# HELD`/`# BLOCKED`/comment line — has ALREADY been triaged by a
// conductor and is OFF-LIMITS to auto-promotion. Only a mission FILE that is mentioned
// NOWHERE in AUTORUN is "constructed but never queued" — exactly the operator's gap.
// This single rule is why auto-promotion can never resurrect the ~100 superseded/
// FAILED/HELD lines in the queue: they are all already mentioned.
//
// PURE helpers (no daemon globals) so the whole path is offline-testable.

// TERMINAL-MISSION GUARD (spam-loop root fix, 2026-06-16): a mission that has already
// reached a SETTLED outcome — FAILED (x MAX_ATTEMPTS), DONE, or SPLIT — must NEVER be
// auto-promoted again. The old guard (mentionedInQueue) relied SOLELY on a path token
// still being present in AUTORUN.md text; it could be defeated two ways that both fired
// the muddytires-d1-healthcheck-1 phone-spam loop:
//   (1) DAEMON RESTART — the in-memory `attempts` Map resets, and a mission caught mid-
//       cycle as a bare line is re-fired from attempt 1, looping across restarts.
//   (2) PATH-TOKEN DRIFT — a FAILED line written with one slash style vs the on-disk
//       file's promotion rel ('missions/<f>') with another could miss the token match,
//       letting auto-promote append the SAME file as a fresh bare line -> re-fire.
// The durable fix reads terminal outcomes from TWO sources of truth that survive a
// restart: the AUTORUN status lines (DONE/FAILED/SPLIT) AND the persistent
// MISSION-LEDGER.md (writeRetro appends `| ts | <name> | DONE|FAILED(..)|... |` on every
// terminal outcome). A mission whose basename appears terminal in EITHER is excluded from
// auto-promotion — a dead mission can no longer be resurrected into a loop.
//
// PURE: takes the two texts + a reader is unnecessary (no file reads here). Returns a Set
// of terminal mission identifiers. BUG 2 FIX (2026-06-25, full-path exclusion): IDs are
// stored as full mission-file paths (e.g. 'missions/b13-...S2.mission.txt'), not as bare
// stems. A base mission (`b13-sitemap-prune-cf-limits`) and its split children
// (`b13-sitemap-prune-cf-limits.S2`) are SEPARATE paths and require SEPARATE terminal
// entries — marking the base FAILED no longer over-blocks the splits, AND a FAILED split
// no longer silently re-promotes via the daemon-restart / path-drift edge case. The bare
// basename (without `.mission.txt`) is ALSO recorded so callers comparing by stem still
// match — the path layer is the source of truth, the stem is a back-compat alias.
// BUG 3: PARKED counts the same as DONE/FAILED/SPLIT.
function terminalMissionIds(autorunText, ledgerText) {
  const ids = new Set();
  const addPath = (rel) => {
    if (!rel) return;
    // Normalize slashes so 'missions/x.mission.txt' and 'missions\\x.mission.txt' collide
    // to the same key. Trim and ensure the .mission.txt suffix-form is canonical.
    const normalized = String(rel).replace(/\\/g, '/').trim();
    if (!normalized) return;
    ids.add(normalized);
    // also record the basename WITHOUT suffix (back-compat alias for stem-based callers).
    const base = normalized.split('/').pop().replace(/\.mission\.txt$/i, '').trim();
    if (base) ids.add(base);
  };
  // (1) AUTORUN status lines: any line whose status is a SETTLED outcome
  //     (DONE, FAILED, SPLIT, or PARKED — operator-marked permanent block, 2026-06-25).
  for (const line of String(autorunText || '').split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith('#')) continue;
    const st = statusOf(t);
    if (st === 'DONE' || st === 'FAILED' || st === 'SPLIT' || st === 'PARKED') addPath(missionPath(t));
  }
  // (2) MISSION-LEDGER.md rows: `| <ts> | <name> | DONE|FAILED(...)|... | ... |`.
  // The verdict column is DONE or FAILED(<phase>); a SPLIT is recorded as DONE-shaped but
  // either way the row's presence with a settled verdict makes the mission terminal.
  // The ledger stores BASENAME (stem) not full path, so emit a missions/<name>.mission.txt
  // shape AND the bare stem so both lookups hit. PARKED is included for completeness even
  // though parkings are usually authored only in AUTORUN.
  for (const line of String(ledgerText || '').split(/\r?\n/)) {
    const cells = line.split('|').map((c) => c.trim());
    // cells: ['', ts, name, verdict, ...] — verdict starts with DONE, FAILED, SPLIT, or PARKED.
    if (cells.length >= 4 && /^(DONE|FAILED|SPLIT|PARKED)\b/.test(cells[3] || '')) {
      const name = cells[2];
      if (name) addPath(`missions/${name}.mission.txt`);
    }
  }
  return ids;
}

// Is this mission's path mentioned ANYWHERE in the AUTORUN text? Matches the bare path
// as a whole token so 'missions/x.mission.txt' is found in a live line, a status line,
// or a '# HELD missions/x.mission.txt' comment alike. The basename is also checked so a
// path written with either slash style still registers as "already triaged".
function mentionedInQueue(autorunText, rel) {
  if (!rel) return true;                    // a missing rel is treated as mentioned (never promote nothing)
  const base = rel.split(/[\\/]/).pop();    // basename, slash-agnostic
  // WHOLE-TOKEN match (not a loose substring): 'ready.mission.txt' must NOT register as
  // mentioned just because 'already.mission.txt' contains it as a tail substring. Bound
  // the basename on the left by a non-name char (start / whitespace / slash) so only a
  // genuine path token counts. The '.' in '.mission.txt' is escaped.
  const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tokenRe = new RegExp(`(^|[\\s/\\\\])${esc}\\b`, 'm');
  return tokenRe.test(String(autorunText));
}

// A mission is GATED (must NOT auto-promote) when its own text marks it held/blocked OR
// it carries an UNSATISFIED mechanical dependency. The only mechanically-checkable
// mission-to-mission dependency is the autosplit's tartib form authored by
// mission_split.buildSubMissionText: "REQUIRES: predecessor <ID> DONE (tartib ...)".
// A child Sn is held until its predecessor S(n-1) is marked DONE in AUTORUN. Prose
// REQUIRES (search / code-repo / credentials / FRESH-instance) are NOT mechanically
// evaluable here — but such missions are virtually always already conductor-placed in
// AUTORUN (so mentionedInQueue already excludes them); a never-queued file carrying a
// prose precondition is held out of caution and surfaced for the conductor, not fired.
// RECURRING-HALT DECISION (early-exit design, 2026-07-01): PURE and exported to selftest —
// closes the gap the original design named ("this decision lives only inside fire()'s
// outcome-switch closure, invisible to any test"). A mission's attempt budget is spent
// (n >= maxAttempts, the prior-only behavior) OR the failed step already carries
// recurringError:true — a signal orchestrate.mjs computes from mission-events.jsonl
// (STEP-SCOPED per the red-team review fix; persists across daemon replans/requeues within
// the same mission cwd) meaning this exact step has now hit the IDENTICAL error 3+ times.
// Red-team-required scope: this is Part B only (reuses the existing priorOccurrences>=2 bar
// unchanged). Part A (skipping the seat-escalation ladder inside orchestrate.mjs on a lower
// bar) was explicitly DROPPED by the review — its precondition (a different seat already
// reproduced this exact error on THIS step) does not hold for the witness-flag/witness
// reasons, which is exactly the cross-step conflation the step-scoping fix above closes.
function shouldHaltMission(n, maxAttempts, failedStep) {
  return n >= maxAttempts || !!failedStep?.recurringError;
}

// FIRE-TIME TARTIB GATE (2026-07-02, operator ruling "close structure that bites before
// running the queue"): QUEUED missions used to fire in file order with NO dependency check
// — an S2 fired when its S1 had FAILED (three receipted incidents: crown-legal.S2 and
// d1-migrations.S2 hollow-DONE'd before their S1s ever landed; b13-aria.S2 queued behind a
// FAILED S1). With 33 of 54 queued missions being S1/S2 pairs, that hole corrupts the whole
// serial run. This gate holds a queued mission until each dependency is DONE **with a PASS
// receipt** (result.json ok:true) or conductor-RESOLVED in AUTORUN — a receipt existing is
// NOT satisfaction; only a passing one is. PURE + exported for selftest.
// Dependencies recognized:
//   (a) explicit: "REQUIRES: missions/a.mission.txt, missions/b.mission.txt"
//   (b) tartib child: "REQUIRES: predecessor <ID> DONE"
//   (c) implicit pair: <stem>.S{n} requires <stem>.S{n-1} (n>=2), even if REQUIRES is absent
// Satisfier: AUTORUN has "DONE <path>" AND <stem>.mission.result.json ok===true, OR an
// AUTORUN comment line containing both "RESOLVED" and the dependency path (the conductor's
// landed judgment). "REQUIRES: none" and prose preconditions (search/credentials) pass.
// GAP-PRIORITY-HOLD classifier (operator ruling 2026-07-03). PURE + exported: which pending
// lines does the hold defer? PRODUCT-class = mt-* website missions. Engine/gap/damm/qc-of-
// engine missions keep firing — holding THOSE would defeat the ruling's purpose.
// WIDENED 2026-07-04 (hunt-item #17): the mt- test only covers ONE product namespace; a
// disk inventory of missions/*.mission.txt found other product-class prefixes the same
// bug applies to (historical b13-* PARKED entries in STATUS-BOARD.md, and live
// muddytires-*.mission.txt files -- the literal word "muddytires", not the mt- abbreviation,
// slipped through entirely: muddytires-community-1-social-platform,
// muddytires-migrate-1-static-map). Widened to the prefixes the hunt-item named PLUS this
// found gap, conservatively -- prefixes with genuinely ambiguous product-vs-engine mission
// history (qc-*, sota-*, auth-*, render-*, get-*, portal-*, retro-*, sources-*, agy-*,
// hyperframes-*, laptop-*) are deliberately NOT included here; misclassifying one of those
// as product would wrongly hold real engine/tooling work, which defeats the ruling's purpose
// just as badly as under-holding does. Left for a future pass with more evidence, not guessed.
const GAP_HOLD_PRODUCT_PREFIXES = ['mt-', 'muddytires-', 'b13-', 'card-', 'cgsports-', 'quirky-'];
const gapHoldLogged = new Set();
export function gapHoldSkips(raw) {
  const stem = path.basename(String(raw)).replace(/\.mission\.txt$/i, '');
  return GAP_HOLD_PRODUCT_PREFIXES.some((p) => stem.toLowerCase().startsWith(p));
}

// LIVE-CANARY transition (blind-spot #29, built 2026-07-03 under the GAP-FIRST ruling after
// aurora shipped hollow-live and the OPERATOR was the detector — third instance of that
// class). The canary runs the real e2e verifier against the LIVE site on an interval; this
// pure function decides when a push is owed. Outcome-only ruling: push on FIRST failure and
// on RECOVERY — never on repeats (the sweep/board carries standing state; storm-watch has
// the repeat beat).
export function canaryTransition(prevVerdict, currVerdict) {
  if (currVerdict === 'FAIL' && prevVerdict !== 'FAIL') return { push: true, text: '🔴 LIVE CANARY FAIL: muddytires.ca e2e regressed between deploys — the class the operator kept catching by hand now alerts itself' };
  if (currVerdict === 'PASS' && prevVerdict === 'FAIL') return { push: true, text: '🟢 LIVE CANARY recovered: muddytires.ca e2e passing again' };
  return { push: false, text: '' };
}
export function canaryDue(lastRunMs, now = Date.now(), intervalMs = 6 * 3600e3) {
  return !Number.isFinite(lastRunMs) || now - lastRunMs >= intervalMs;
}

// RETRO-REPEAT GATE decision (blind-spot hunt #24). PURE + exported to selftest: reads the
// retro corpus for THIS stem via injectable fs hooks. Filename contract (set by the retro
// writer below): `<stem>-<ISO ts with dashes>.md`, outcome in the header line ("# RETRO
// <stem> — FAILED(plan) ..."). Blocked ⇔ >=minFails FAILED retros inside windowMs AND the
// mission file's mtime is OLDER than the newest of them (nothing changed since it last
// failed). Child stems never match a parent's filter: `${stem}.S1-...` does not start with
// `${stem}-2`, so parents and children gate independently.
// CHAIN-STREAK BREAKER (operator 2026-07-03 ~13:1x: "our self healing is failing too because
// I shouldn't have had to ask" — 8 consecutive FAILED runs never alarmed anyone because every
// failure had a DIFFERENT cause and stormWatch is cause-novelty-gated BY DESIGN; a streak of
// distinct failures is invisible to it. This counts REAL run conclusions across missions,
// cause-blind: DONE resets, terminal-FAILED increments; at `alertAt` (then every `every`
// afterward) the daemon itself escalates — an outcome-dense push + a CHAIN-STREAK event the
// conductor sweep surfaces. PURE + injectable for selftest.)
export function chainStreak(outcome, statePath, { alertAt = 4, every = 3, readFile = readFileSync, writeFile = writeFileSync } = {}) {
  let s = { count: 0, lastAlertAt: 0 };
  try { s = JSON.parse(readFile(statePath, 'utf8')); } catch { /* fresh state */ }
  if (outcome === 'DONE') { s = { count: 0, lastAlertAt: 0 }; }
  else if (outcome === 'FAILED') { s.count = (s.count || 0) + 1; }
  let alert = false;
  if (s.count >= alertAt && s.count - (s.lastAlertAt || 0) >= (s.lastAlertAt ? every : 0) && s.count !== s.lastAlertAt) {
    if (!s.lastAlertAt || s.count >= s.lastAlertAt + every) { alert = true; s.lastAlertAt = s.count; }
  }
  try { writeFile(statePath, JSON.stringify(s)); } catch { /* state write is best-effort */ }
  return { count: s.count, alert };
}

export function retroRepeatBlocked(stem, retroDir, missionMtimeMs,
  { now = Date.now(), minFails = 3, windowMs = 24 * 3600e3, preflightAfter = 5, preflightMtimeMs = null, readdir = readdirSync, readHead = (p) => readFileSync(p, 'utf8').slice(0, 200) } = {}) {
  let files = [];
  try { files = readdir(retroDir); } catch { return { blocked: false, count: 0 }; }
  const fails = [];
  for (const f of files) {
    if (!f.startsWith(`${stem}-2`) || !f.endsWith('.md')) continue;   // '-2' pins the timestamp year; excludes .S-children
    const tsRaw = f.slice(stem.length + 1, -3);                        // 2026-07-01T00-00-00-000Z
    const ms = Date.parse(tsRaw.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z'));
    if (!Number.isFinite(ms) || now - ms > windowMs) continue;
    try { if (/FAILED/i.test(readHead(path.join(retroDir, f)))) fails.push(ms); } catch { /* unreadable retro = no evidence */ }
  }
  if (fails.length < minFails) return { blocked: false, count: fails.length };
  const newestMs = Math.max(...fails);
  const amended = Number.isFinite(missionMtimeMs) && missionMtimeMs > newestMs;
  // PREFLIGHT-RECEIPT ESCALATION (operator demand 2026-07-03 ~13:1x after an 8-FAILED-run
  // burn: "a change in the conductor to be better, not hopes and dreams"): past
  // preflightAfter failures, an amendment (mtime bump) alone NO LONGER opens the gate —
  // the conductor must have DRY-RUN the killing step class and written the receipt to
  // missions/_logs/preflight/<stem>.md (its mtime must be newer than the newest retro).
  // Mechanizes the PRE-FLIGHT RULE: no dry-run evidence, no refire, regardless of how the
  // mission text was touched.
  if (fails.length >= preflightAfter) {
    const preflightFresh = Number.isFinite(preflightMtimeMs) && preflightMtimeMs > newestMs;
    if (amended && preflightFresh) return { blocked: false, count: fails.length, amended: true, preflighted: true };
    return { blocked: true, count: fails.length, newest: new Date(newestMs).toISOString(), needsPreflight: true };
  }
  if (amended) return { blocked: false, count: fails.length, amended: true };
  return { blocked: true, count: fails.length, newest: new Date(newestMs).toISOString() };
}

export function queuedDepsHold(missionText, missionPath, autorunText, resultOkFn, gitFn = (repo, argstr) => { try { return { ok: true, out: execSync(`git -C "${repo}" ${argstr}`, { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).toString() }; } catch { return { ok: false, out: '' }; } }) {
  const txt = String(missionText || '');
  // SELF-RESOLVED CHECK (2026-07-02, d1-migrations resurrection loop): a conductor-RESOLVED
  // mission must never refire — but graceful reloads interrupt in-flight attempts, and the
  // boot-time RUNNING->pending revert resurrected a mission whose PENDING line was already
  // resolved. If AUTORUN carries a RESOLVED comment naming THIS mission, it is retired.
  const selfEsc = String(missionPath || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // mt-c1-boundary: \b guards against 'UNRESOLVED' substring-matching 'RESOLVED' (the
  // exact inversion bug conduct-cycle.mjs's closed() was \b-fixed for on 2026-07-02 —
  // this daemon's twin regex was left out of that fix).
  if (new RegExp(`^#.*\\bRESOLVED\\b.*${selfEsc}`, 'm').test(autorunText)) {
    // mt-c2a-queueddeps (GAP-HUNT-2026-07-03: "RESOLVED-LANDED stamp is a pure-trust input
    // ... zero validation"): a stamp claiming this mission landed is verified against the
    // repo via missionLandedState BEFORE it retires the mission. A GENUINE verdict (no
    // ALLOW-FILE present at HEAD) disputes the stamp — the mission stays live, never
    // retired. A null verdict (mission text isn't code-repo class / lacks REPO-ROOT or
    // ALLOW-FILES — undeterminable) fails OPEN, honoring the stamp exactly as before.
    let landed = null;
    try { landed = missionLandedState(txt, gitFn); } catch { landed = null; }
    if (landed && landed.verdict === 'GENUINE') {
      evt(`STAMP-DISPUTED: ${missionPath} carries a RESOLVED stamp but missionLandedState verdict is GENUINE (no ALLOW-FILES present at HEAD) — refusing to retire, mission stays live`);
    } else {
      return { hold: true, resolvedSelf: true, dep: missionPath, why: 'mission itself is conductor-RESOLVED in AUTORUN — retired from firing (work landed)' };
    }
  }
  const deps = new Set();
  // (a) explicit mission-file list
  const reqLine = (txt.match(/^REQUIRES:\s*(.+)$/im) || [])[1] || '';
  for (const m of reqLine.matchAll(/missions\/\S+?\.mission\.txt/g)) deps.add(m[0]);
  // (b) tartib child form — resolve the predecessor ID to a path if a file matches
  const pred = (reqLine.match(/predecessor\s+(\S+)\s+DONE/i) || [])[1];
  if (pred) deps.add(`missions/${pred.replace(/^missions\//, '').replace(/\.mission\.txt$/, '')}.mission.txt`);
  // (b2) BARE-STEM form (2026-07-03 minimal-pair receipt: same event batch held S1.S2 via
  // the implicit rule but FIRED mt-e2e-reachability.S1, whose "REQUIRES:
  // mt-mobile-qc-hardening.S1.S2 (tartib — ...)" is a bare stem none of (a)/(b)/(c) parse —
  // so "REQUIRES X" meant "X isn't FAILED", not "X is DONE"). A token from the REQUIRES
  // head (before any parenthetical) is a dep IFF AUTORUN actually queues it as
  // missions/<token>.mission.txt — purity kept (resolved against autorunText, no fs), and
  // prose words self-exclude because no matching queue line exists for them.
  const reqHead = reqLine.split('(')[0];
  for (const tok of reqHead.matchAll(/[\w][\w.-]{3,}/g)) {
    const cand = `missions/${tok[0].replace(/^missions\//, '').replace(/\.mission\.txt$/, '')}.mission.txt`;
    if (autorunText.includes(cand)) deps.add(cand);
  }
  // (c) implicit .Sn -> .S(n-1)
  const sn = String(missionPath || '').match(/^(.*\.S)(\d+)\.mission\.txt$/);
  if (sn && parseInt(sn[2], 10) >= 2) deps.add(`${sn[1]}${parseInt(sn[2], 10) - 1}.mission.txt`);
  for (const dep of deps) {
    if (dep === missionPath) continue;
    const doneRe = new RegExp(`^DONE\\s+${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
    // sibling of mt-c1-boundary: same \b guard for the dependency-satisfier check.
    const resolvedRe = new RegExp(`^#.*\\bRESOLVED\\b.*${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
    if (resolvedRe.test(autorunText)) continue;                                  // conductor-landed
    if (doneRe.test(autorunText) && resultOkFn(dep) === true) continue;          // DONE + PASS receipt
    return { hold: true, dep, why: doneRe.test(autorunText) ? `dependency ${dep} is DONE but its result.json is not ok:true (hollow receipt)` : `dependency ${dep} not DONE/RESOLVED` };
  }
  return { hold: false };
}

function promotionHold(missionText, doneIds) {
  const txt = String(missionText || '');
  if (/^\s*#?\s*(HELD|BLOCKED|GATED)\b/im.test(txt)) return { hold: true, why: 'mission text marks HELD/BLOCKED/GATED' };
  // tartib predecessor dependency (the autosplit child form) — the one mechanical dep.
  const m = txt.match(/REQUIRES:\s*predecessor\s+(\S+)\s+DONE/i);
  if (m) {
    const predId = m[1];
    if (!doneIds.has(predId)) return { hold: true, why: `tartib predecessor ${predId} not yet DONE` };
    return { hold: false };
  }
  // a non-tartib prose REQUIRES on a NEVER-QUEUED file: hold (conductor curates these).
  // (search/code-repo/credential/FRESH preconditions can't be auto-cleared here.)
  if (/^REQUIRES:/im.test(txt) && !/REQUIRES:\s*(none|n\/a)\b/i.test(txt)) {
    return { hold: true, why: 'carries a non-tartib prose REQUIRES precondition (conductor-curated)' };
  }
  return { hold: false };
}

// Collect the set of mission-IDs already DONE in AUTORUN, so a tartib child can see its
// predecessor cleared. A DONE line's mission file basename AND its MISSION-ID both count
// as satisfiers (the tartib REQUIRES cites the MISSION-ID; the DONE line carries the path).
function doneMissionIds(autorunText, missionsDir, readText) {
  const ids = new Set();
  for (const line of String(autorunText).split(/\r?\n/)) {
    if (!/^DONE\b/.test(line.trim())) continue;
    const rel = missionPath(line);
    if (!rel) continue;
    const base = rel.split(/[\\/]/).pop().replace(/\.mission\.txt$/i, '');
    ids.add(base);
    // also resolve the MISSION-ID from the file if it still exists (tartib cites the ID).
    try {
      const full = path.isAbsolute(rel) ? rel : path.join(path.dirname(missionsDir), rel);
      const id = (readText(full).match(/MISSION-ID:\s*([^\r\n]+)/i) || [])[1];
      if (id) ids.add(id.trim());
    } catch { /* file gone (e.g. a split parent) — basename satisfier still stands */ }
  }
  return ids;
}

// THE PROMOTION DECISION (pure): given the AUTORUN text, the list of *.mission.txt files
// on disk, and a reader, return the ONE next mission rel to append — or null. A candidate
// must be (a) NOT mentioned anywhere in AUTORUN (never triaged) and (b) NOT on a promotion
// hold. Ordering: files are considered in the order given (the caller sorts them — by the
// OPERATOR PRIORITY ORDER when it can, else lexical), and the FIRST ready one wins. Minimal
// + safe: one promotion per call, so the daemon re-reads truth before the next.
function pickPromotion(autorunText, missionFiles, missionsDir, readText, ledgerText = '', gitFn = (repo, argstr) => { try { return { ok: true, out: execSync(`git -C "${repo}" ${argstr}`, { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).toString() }; } catch { return { ok: false, out: '' }; } }) {
  const doneIds = doneMissionIds(autorunText, missionsDir, readText);
  // TERMINAL GUARD (spam-loop root fix): a FAILED-x2 / DONE / SPLIT mission — recorded in
  // AUTORUN status lines OR the persistent MISSION-LEDGER.md — is DEAD and must never be
  // resurrected, even if a path token in AUTORUN drifted or the daemon restarted (which
  // clears the in-memory attempts Map). This is the durable backstop the bare
  // mentionedInQueue text-match could not provide.
  const terminalIds = terminalMissionIds(autorunText, ledgerText);
  for (const f of missionFiles) {
    const rel = `missions/${f}`;
    if (mentionedInQueue(autorunText, rel)) continue;          // already triaged — OFF LIMITS
    // BUG 2 FIX (2026-06-25): match terminal exclusion by FULL PATH first, with stem as a
    // back-compat fallback. A base mission and its split children (`.S1`, `.S2`, ...) are
    // DIFFERENT paths and EACH needs its own terminal entry to be excluded — so a FAILED
    // base no longer over-blocks the splits, but a FAILED split is robustly excluded even
    // if mentionedInQueue's basename regex misses an unusual line format. BUG 3: PARKED
    // is counted in terminalIds (terminalMissionIds includes PARKED), so a PARKED path is
    // excluded here too without further logic.
    const base = f.replace(/\.mission\.txt$/i, '');
    if (terminalIds.has(rel) || terminalIds.has(base)) continue;   // terminal (FAILED x2 / DONE / SPLIT / PARKED) — DEAD, never re-promote
    let txt = '';
    // BUG 1 GUARD (2026-06-25): on Windows, path.join(prefix, absolutePath) doubles instead
    // of replacing — the b13 mkdir failure pattern. `f` is normally a basename from
    // readdirSync but harden the join here too so any caller passing an absolute path is
    // honored, not corrupted.
    try { txt = readText(path.isAbsolute(f) ? f : path.join(missionsDir, f)); } catch { continue; }
    const gate = promotionHold(txt, doneIds);
    if (gate.hold) continue;                                    // held/blocked/unsatisfied-deps — SKIP
    // mt-c2b-pickpromotion: verify any landed-state claim in this candidate's own text
    // against the repo (reuses missionLandedState, already imported for queuedDepsHold)
    // before promoting it. A disputed verdict (GENUINE — the claim doesn't match HEAD)
    // excludes this mission from promotion; a null verdict (undeterminable) fails OPEN,
    // unchanged from prior behavior.
    let landed = null;
    try { landed = missionLandedState(txt, gitFn); } catch { landed = null; }
    if (landed && landed.verdict === 'GENUINE') {
      evt(`STAMP-DISPUTED: ${rel} — missionLandedState verdict GENUINE (claim disputed against HEAD) — excluding from promotion`);
      continue;
    }
    return { rel, file: f };
  }
  return null;
}

// ORDER candidate mission files by the OPERATOR PRIORITY ORDER when names appear in that
// block, else lexically. The priority block is prose (P1/P2 narrative), so this is a
// best-effort: a file whose basename (or a distinctive token of it) is named earlier in
// the block sorts earlier. Files named nowhere in the block sort after, lexically. This
// keeps "minimal + safe" (the spec's floor is "promote a ready mission"); the ordering is
// the bonus when the block gives a signal.
function orderByPriority(files, autorunText) {
  const block = (String(autorunText).match(/OPERATOR PRIORITY ORDER[\s\S]*$/i) || [''])[0].toLowerCase();
  const rank = (f) => {
    const name = f.replace(/\.mission\.txt$/i, '').toLowerCase();
    // try the full stem, then progressively shorter dash-delimited prefixes, for a hit.
    const parts = name.split('-');
    for (let n = parts.length; n >= 1; n--) {
      const probe = parts.slice(0, n).join('-');
      if (probe.length >= 4) { const i = block.indexOf(probe); if (i >= 0) return i; }
    }
    return Number.MAX_SAFE_INTEGER;
  };
  return [...files].sort((a, b) => (rank(a) - rank(b)) || (a < b ? -1 : a > b ? 1 : 0));
}

// DAEMON-STATE wrapper: scan the real missions dir, order by priority, pick ONE ready
// promotion, append it to AUTORUN (the SAME append a manual conductor would do — a bare
// path line). Returns the promoted rel or null. Fail-soft: a scan/read/write error never
// breaks the loop. Guarded by the caller so it only runs when a lane is free AND no ready
// pending line already exists (auto-promotion FILLS gaps, never races manual append).
function autoPromoteFromSubstrate() {
  try {
    const missionsDir = path.join(HERE, 'missions');
    const autorunText = existsSync(AUTORUN) ? readFileSync(AUTORUN, 'utf8') : '';
    // ALL mission files, INCLUDING split children (*.S<n>.mission.txt): a child carries a
    // tartib REQUIRES, so promotionHold holds it until its predecessor is DONE — it is not
    // excluded here, it is correctly gated below. (The autosplit already appends children
    // to AUTORUN at emit time, so they are normally already mentioned; this is belt-and-
    // suspenders for a child file that somehow never reached the queue.)
    const files = readdirSync(missionsDir).filter((f) => /\.mission\.txt$/i.test(f));
    const ordered = orderByPriority(files, autorunText);
    // Persistent terminal ledger (survives daemon restarts — the path the in-memory
    // attempts Map cannot). Fail-soft: a missing/unreadable ledger just means no extra
    // terminal ids beyond the AUTORUN status lines.
    const ledgerPath = path.join(LOGDIR, 'MISSION-LEDGER.md');
    const ledgerText = existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '';
    const pick = pickPromotion(autorunText, ordered, missionsDir, (p) => readFileSync(p, 'utf8'), ledgerText);
    if (!pick) return null;
    appendFileSync(AUTORUN, `\n${pick.rel}`);
    evt(`AUTO-PROMOTED from substrate (lane free, no ready pending line): ${pick.rel}`);
    return pick.rel;
  } catch (e) { evt(`auto-promote skipped (non-fatal): ${e.message}`); return null; }
}

async function runMission(missionFile) {
  const { orchestrate } = await import('./orchestrate.mjs');
  const mission = readFileSync(missionFile, 'utf8');
  const cwd = path.join(HERE, 'missions', path.basename(missionFile).replace(/\.mission\.txt$/i, '').replace(/\.[^.]+$/, ''));
  mkdirSync(cwd, { recursive: true });
  // REQUIRES: search now WIRES the blind-backend preflight (2026-06-11: the operator's
  // "if SOTA search was broken, every phase 1 failed" audit found searxngPreflight
  // existed but was NEVER invoked — needsSearch defaulted false for every mission, so
  // the REQUIRES: search marker was decorative. A search mission on a blind backend
  // must REFUSE to start, not run confidently sightless.)
  const needsSearch = /REQUIRES?:[^\n]*\bsearch\b/i.test(mission);
  // maxRepairs 2 (get-upgrade receipt 2026-06-11 20:03: witness named THREE specific
  // PowerShell bugs, the repair seat got them verbatim and fixed in ONE round what one
  // round could fix — the recheck still flagged. One round is too thin for multi-bug
  // code files; two converts the near-miss class. Operator ruling: quality over speed.)
  // HAJJ AUTO-SPLIT WIRING (queue-flow-1, 2026-06-16 — activating the BUILT split,
  // commit 5ccd6e1). orchestrate's PHASE 1.5 splits an over-ceiling mission into tartib
  // sub-missions, but it can only APPEND the children to the fire queue when the daemon
  // tells it WHERE the real missions dir + AUTORUN file are (the gap the autosplit agent
  // deferred to this mission). missionsDir/parentMissionFile/autorunFile point the
  // children at the live queue; sizeCeiling defaults (MISSION_SIZE_CEILING / env). On a
  // split, orchestrate returns { ok:true, phase:'split', split:true } having ALREADY
  // written the S-files + manifest and appended them to AUTORUN — the parent is marked
  // SPLIT by the caller (fire), never re-run.
  // REPLAN ISOLATION (M-ENGINE.REPLAN-ISOLATION.1, 2026-06-16): stepRetries activates the
  // engine's SAME-STEP transient retry — a flaky empty emission / network blip re-dispatches
  // THE FAILING STEP (with rollback state-cleanup), bounded, instead of failing the mission so
  // the daemon's attempt-2 re-runs the whole thing from step 1 (the KB churn). 2 same-step
  // retries before the step fails-with-receipt; completed steps are checkpointed + resumed on a
  // clean-pass re-run regardless. This is ADDITIVE — the daemon's own attempt loop (MAX_ATTEMPTS),
  // MIQAT, witness, seats, and ceilings are unchanged. Env MUEZZIN_STEP_RETRIES overrides.
  // FRONTIER-SEAT ESCALATION ARMING (R3, HOLE 2 wiring, 2026-06-17): the escalation ladder in
  // orchestrate (local->sonnet->opus) is DEAD CODE unless MUEZZIN_SEAT_ESCALATION='on' is set.
  // The daemon ARMS it per-mission, and ONLY for SUBSTANTIAL-AUTHORING missions — the code /
  // code-repo classes that author real files via edit steps (exactly what the gate is scoped to:
  // step.action_type==='edit'). research/sandbox missions stay default-OFF (byte-for-byte prior
  // behavior). The arming is the deliberate budget spend the two-budget ruling sanctions for
  // substantial missions, not a silent default every mission pays. Explicit + conservative: only
  // an EXPLICIT MISSION-CLASS of code / code-repo arms; a bare/research mission never does. An
  // env-pinned MUEZZIN_SEAT_ESCALATION (operator override) is respected and left untouched.
  let klass = 'research';
  try { klass = parseMissionClass(mission).class; } catch { /* malformed header -> research default, no arm */ }
  const armEscalation = (klass === 'code' || klass === 'code-repo');
  const escAlreadyPinned = 'MUEZZIN_SEAT_ESCALATION' in process.env;   // operator/global override wins; never clobber it
  const prevEsc = process.env.MUEZZIN_SEAT_ESCALATION;
  if (armEscalation && !escAlreadyPinned) {
    process.env.MUEZZIN_SEAT_ESCALATION = 'on';
    evt(`SEAT-ESCALATION armed (class=${klass}): ${path.basename(missionFile)}`);
  }
  let r;
  try {
    r = await orchestrate(mission, cwd, {
      maxRepairs: 2, needsSearch,
      stepRetries: Number(process.env.MUEZZIN_STEP_RETRIES ?? 2),
      missionsDir: path.join(HERE, 'missions'),
      parentMissionFile: missionFile,
      autorunFile: AUTORUN,
    });
  } finally {
    // RESTORE so the per-mission arm never leaks to a parallel lane or the next mission (env is
    // process-global; lanes share it). If we never set it, leave the env exactly as found.
    if (armEscalation && !escAlreadyPinned) {
      if (prevEsc === undefined) delete process.env.MUEZZIN_SEAT_ESCALATION;
      else process.env.MUEZZIN_SEAT_ESCALATION = prevEsc;
    }
  }
  writeFileSync(missionFile.replace(/\.[^.]+$/, '') + '.result.json', JSON.stringify(r, null, 2));
  return r;
}

async function mainLoop() {
  const tartibHoldLogged = new Set();   // one TARTIB-HOLD event per (mission,dep) state, not per 5s poll
  const lock = acquireSingleton();
  // EXIT 3 = SINGLETON-BLOCKED (2026-07-02): another daemon owns the substrate — this spawn is
  // redundant, not dead. MUST be distinct from 0/1: daemon-supervisor.ps1 restarts on normal exits,
  // which with exit 0 produced a permanent 3s spawn→blocked→respawn loop for every EXTRA supervisor
  // (live receipt: supervisor.log 10:09-10:12 local, ~45 iterations; seats/sessions spawn extra
  // supervisors and each looped forever). The supervisor treats 3 as "do not restart — exit quietly."
  if (!lock.ok) { console.log(`daemon already running (PID ${lock.holder}) — exiting per singleton lock (code 3 = supervisor must NOT restart)`); process.exit(3); }
  reclaimStaleRunning();
  evt(`daemon UP (PID ${process.pid}, singleton) — draining missions/AUTORUN.md, up to ${MAX_LANES} parallel lanes`);
  // NO push on daemon UP (operator 2026-06-10: lifecycle pushes are noise — restarts
  // spammed his phone with zero information). Pushes are OUTCOME-ONLY: DONE/FAILED.
  const attempts = new Map();
  const searchHolds = new Map(); // raw line -> consecutive readiness-gate hold count (M-READINESS-GATE.1)
  const lanes = new Map(); // raw line -> promise
  // AUTO-HEAL CADENCE (2026-07-01 receipt): conduct-cycle.mjs's heal() -- STUCK-TASK kill,
  // REQUEUE-ON-FIX-LANDED, CHAIN-ON-DONE, RESTART-DAEMON -- was fully correct but only ever
  // ran when a conductor invoked `node conduct-cycle.mjs --heal` by hand. Every action heal()
  // actually executes is already `class: 'mechanical', approved_by_faith: true` in sweep()'s
  // own action list (judgment-class actions like DIAGNOSE-* are report-only, heal() never
  // touches those) -- so this is completing already-approved automation, not a new judgment
  // call. 5-minute cadence matches TASK_STUCK_MS (a lane isn't even eligible to be flagged
  // stuck before 5 minutes elapse, so checking more often than that buys nothing).
  const HEAL_INTERVAL_MS = 5 * 60 * 1000;
  let lastHealTs = 0;
  // 2026-07-01 receipt: conduct-cycle.mjs's detectStuckLanes() has been dead code since it
  // was written -- it needs a lane shape of {path, start_ts} to compute how long a lane has
  // been running, but this daemon has only ever written bare-string lanes (lanes.keys()) to
  // daemon-status.json. For a bare string, ageMs is NaN and `stuck` is unconditionally false
  // -- the stuck-task safety net could never fire for ANY mission, ever, regardless of how
  // long it ran. Fixed by tracking start time alongside each lane and writing the richer
  // shape the detector was always designed to consume.
  const laneStartTs = new Map(); // raw line -> ISO start timestamp

  const fire = async (raw) => {
    const missionFile = path.resolve(HERE, raw);
    if (!existsSync(missionFile)) { evt(`FAILED (missing file): ${raw}`); setMark(raw, 'FAILED'); return; }
    // GAP-PRIORITY-HOLD (operator ruling 2026-07-03: "gap issues is always priority" —
    // mechanized, because a prose priority loses to an autonomous queue every time): while
    // the conductor holds this flag open (bite-class gaps in progress), PRODUCT-class fires
    // are skipped — engine/gap/damm missions still fire. The flag is a file so it survives
    // reloads and is visible to every instance; the conductor clears it when the gap closes.
    if (existsSync(path.join(LOGDIR, 'GAP-PRIORITY-HOLD')) && gapHoldSkips(raw)) {
      if (!gapHoldLogged.has(raw)) { gapHoldLogged.add(raw); evt(`GAP-PRIORITY-HOLD: ${raw} — product fire deferred while bite-class gap work is open (operator ruling 2026-07-03); skipping to next pending`); }
      return;
    }
    // RETRO-REPEAT GATE (blind-spot hunt #24, 2026-07-03 — receipt: 924 retros for ONE stem
    // at 30-second refire cadence while zero engine code read the retro corpus back): if this
    // stem has already FAILED >=3 times in 24h AND the mission text is UNCHANGED since the
    // newest failure, firing again is relitigating documented futility. Refuse with the
    // evidence quoted; the FAILED mark routes it into the normal conductor DIAGNOSE judgment.
    // An AMENDED mission (mtime newer than the newest retro) always passes — that is the
    // legitimate-refire path (poi-tags/trip-cost class: text fixed, requeued, fired clean).
    try {
      const rrbStem = path.basename(raw).replace(/\.mission\.txt$/i, '');
      let pfMtime = null;
      try { pfMtime = statSync(path.join(LOGDIR, 'preflight', `${rrbStem}.md`)).mtimeMs; } catch { /* no preflight receipt yet */ }
      const rrb = retroRepeatBlocked(rrbStem, path.join(LOGDIR, 'retro'), statSync(missionFile).mtimeMs, { preflightMtimeMs: pfMtime });
      if (rrb.blocked) {
        const pfNote = rrb.needsPreflight ? ` PREFLIGHT-RECEIPT REQUIRED at >=5 fails: write the dry-run evidence to missions/_logs/preflight/${rrbStem}.md (mtime newer than the newest retro) — an mtime bump on the mission alone no longer opens this gate.` : '';
        evt(`RETRO-REPEAT-BLOCKED: ${raw} — ${rrb.count} FAILED retros in 24h, newest ${rrb.newest}${rrb.needsPreflight ? ', preflight receipt MISSING/stale' : ', mission text UNCHANGED since'} — refusing to relitigate; amend the mission or park it (conductor judgment).${pfNote}`);
        setMark(raw, 'FAILED');
        notify(`⛔ RETRO-REPEAT gate: ${rrbStem} refused — ${rrb.count} failures in 24h${rrb.needsPreflight ? '; DRY-RUN RECEIPT required before refire' : ' with an unchanged mission text'}. Zero cycles burned.\n${nextUpLine()}\n${scoreLine()}`);
        return;
      }
    } catch { /* gate is best-effort — a broken retro dir must never stop legitimate fires */ }
    // PRE-SATISFIED GUARD (#25b, 2026-07-03): a code-repo mission whose ALLOW-FILES are ALL
    // byte-identical to its source sha at HEAD has NOTHING left to do — firing it burns
    // attempts on guaranteed baseline-check failures and mints the next false death (receipt:
    // aurora.S1 fired post-landing, its absence-preflight failed, FALSE death recorded; 9 of
    // 13 sampled FAILED marks were this class). Byte-identity only — PARTIAL/nosha still fire.
    try {
      const mtextGuard = readFileSync(missionFile, 'utf8');
      // EXECUTION-CLASS EXEMPTION (2026-07-03, two live false-refusals 30s after this guard
      // shipped: gpx.S2 + trip-cost.S2 refused because their ALLOW-FILES MIRROR their S1's
      // landed files — but an S2's work is EXECUTION (apply/verify/render), which file
      // identity cannot prove. The scanner's rule text already named this class; the guard
      // now inherits it mechanically: TARTIB-INDEX >= 2 missions never pre-satisfy.)
      const tartibIdx = Number((mtextGuard.match(/TARTIB-INDEX:\s*(\d+)\s+of/i) || [])[1] || 1);
      // VISUAL-QC EXEMPTION (2026-07-03, live false-refusal 14:35:11: lane-fix.S1 refused as
      // "work already landed" while production served ZERO bytes of the fix — muddytires.ca/map
      // grep mt-mobile-lane-fix = 0. A VISUAL-QC-REQUIRED mission's Done-means includes deploy +
      // render verification, which file identity cannot prove — the SAME class as tartib>=2
      // execution missions, inherited mechanically the same way.)
      const visualQC = /^VISUAL-QC-REQUIRED\b/m.test(mtextGuard);
      const st = (tartibIdx >= 2 || visualQC) ? null : missionLandedState(mtextGuard,
        (repo, argstr) => { try { return { ok: true, out: execSync(`git -C "${repo}" ${argstr}`, { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 }).toString() }; } catch { return { ok: false, out: '' }; } });
      if (st && st.verdict === 'FULL') {
        evt(`PRE-SATISFIED: ${raw} — every ALLOW-FILE byte-identical to source ${st.srcSha} at HEAD; work already landed, refusing to fire into a guaranteed baseline failure. Marking for conductor RESOLVED-LANDED stamp.`);
        setMark(raw, 'FAILED');   // routes into the false-death judgment path with the receipt already in events
        return;
      }
    } catch { /* guard is best-effort — never blocks a legitimate fire */ }
    // MIQAT (2026-06-11, operator: "how do we catch things like this"): a mission with a
    // mechanically-visible design flaw (unstaged evidence, jail-contradiction, line-cite
    // bar without numbered source, no done-means) is REFUSED at the boundary with named
    // reasons — zero attempts burned, vs the 4-6 cycles 4a/fb-backlog each cost before
    // a conductor root-caused the same flaws from receipts.
    const lint = lintMission(readFileSync(missionFile, 'utf8'));
    if (!lint.ok) {
      const why = lint.problems.map((p) => `${p.rule}: ${p.detail}`).join(' | ');
      evt(`MIQAT-REFUSED: ${raw} — ${why.slice(0, 300)}`);
      setMark(raw, 'FAILED');
      notify(`⛔ MIQAT refused ${path.basename(raw).replace(/\.mission\.txt$/, '')}\n${lint.problems.map((p) => p.rule).join(', ')} — fix the mission text, zero cycles burned\n${nextUpLine()}\n${scoreLine()}`);
      return;
    }
    // READINESS GATE (M-READINESS-GATE.1): a search-REQUIRES mission must not burn an
    // attempt firing into a blind backend. Runs BEFORE attempts++. Fail-soft (the gate
    // never throws; a 'hold' leaves the line pending with NO attempt spent, re-checked
    // next poll). Only acts on missions that declare a search requirement.
    try {
      const gate = await searchReadinessGate(readFileSync(missionFile, 'utf8'), {
        probe: () => searxngPreflight(),
        heal: () => { try { execSync('docker restart searxng', { stdio: ['ignore', 'ignore', 'pipe'], timeout: 30000 }); } catch { /* heal best-effort */ } },
        holds: searchHolds,
        key: raw,
      });
      if (gate.action === 'hold') { evt(`HELD (search not ready): ${raw} — ${gate.reason}`); return; }   // NO attempts++, line stays pending
      if (gate.action === 'block') { evt(`BLOCKED (search backend down x3): ${raw} — ${gate.reason}`); setMark(raw, 'FAILED'); notify(`⛔ BLOCKED ${path.basename(raw).replace(/\.mission\.txt$/, '')}\nsearch backend down after heal+recheck — ${gate.reason}\n${nextUpLine()}\n${scoreLine()}`); return; }
      // gate.action === 'fire' -> fall through unchanged
    } catch (e) { evt(`readiness-gate error (continuing to fire, fail-open): ${raw} — ${e.message}`); }
    const n = (attempts.get(raw) || 0) + 1; attempts.set(raw, n);
    setMark(raw, 'RUNNING');
    evt(`firing lane ${lanes.size + 1}/${MAX_LANES} (attempt ${n}/${MAX_ATTEMPTS}): ${raw}`);
    // CONDUCTOR-SELF-WITNESS (M-ENGINE.CONDUCTOR-SELF-WITNESS.1, operator standing ruling
    // 2026-06-16): every CONSTRUCTED mission is an OUT-OF-CHAIN, conductor-authored artifact
    // that drives autonomous work — and until now only MIQAT (mission_lint, format) checked
    // it; nothing witnessed its REASONING. Run the BOTH-witness pass (laguna structural +
    // guardian groundedness) over the mission text the same way the seats are witnessed.
    // NON-BLOCKING + GR10-SAFE BY DESIGN: this is FIRE-AND-FORGET, detached — it runs the
    // witness pair SERIALLY (yields if the GPU is busy) and emits a receipt to
    // missions/_logs/self-witness.jsonl + a daemon event. It NEVER gates, delays, or halts
    // the mission below; a concern is a FLAG the conductor reads at the next beat, not a
    // block. Only fires on attempt 1 (the construction is witnessed once, not re-witnessed
    // on a clean-pass retry). Earn the right to block later (mirrors guardian's promotion path).
    if (n === 1) {
      const missionText = readFileSync(missionFile, 'utf8');
      const mname = path.basename(raw).replace(/\.mission\.txt$/, '');
      witnessArtifact(missionText, { artifact: mname, artifact_kind: 'mission', pass: 'before', contextText: missionText })
        .then((w) => {
          const r = w?.receipt;
          if (!r) return;
          evt(`SELF-WITNESS[before] ${mname}: ok=${r.ok} struct=${r.laguna?.verdict ?? 'n/a'} guardian=${r.guardian?.grounded ?? 'n/a'}${r.ok === false ? ` — FLAG: ${(r.reasons || []).join(' | ').slice(0, 200)}` : ''}`);   // "struct" = structural witness (default ornith:9b since 2026-07-01); the r.laguna FIELD name is legacy — the LABEL was misreading as the model and misled a conductor 2026-07-02
        })
        .catch((e) => evt(`SELF-WITNESS[before] error (non-blocking, ignored): ${mname} — ${String(e?.message).slice(0, 120)}`));
    }
    const p = runMission(missionFile)
      .catch((e) => ({ ok: false, phase: 'daemon', reason: e.message }))
      .then((r) => {
        // Outcome marked by mission PATH (setMark) — never re-find by full line (the bug).
        // HAJJ SPLIT (queue-flow-1): the parent was decomposed (orchestrate phase:split),
        // NOT executed. orchestrate already wrote the S-files + manifest and appended the
        // children to AUTORUN (in tartib order) via the autorunFile opt. Mark the parent
        // SPLIT (a settled, non-firing status) — never DONE, never retried — and push the
        // decomposition so the conductor sees WHAT was queued. A split is success-shaped
        // (r.ok true) but is its OWN outcome, so it is intercepted BEFORE the DONE branch.
        if (r?.ok && r?.split) {
          const childRels = (r.subMissions || []).map((s) => s.file);
          evt(`SPLIT: ${raw} -> ${childRels.length} sub-missions queued (${childRels.join(', ')})`);
          setMark(raw, 'SPLIT');
          const mname = path.basename(raw).replace(/\.mission\.txt$/, '');
          notify(`🪓 SPLIT: ${mname}\nover the size ceiling (${r.ceiling}) — decomposed into ${childRels.length} tartib sub-missions, queued to AUTORUN\n${childRels.map((c) => '  ' + path.basename(c)).join('\n')}\n${scoreLine()}`);
          writeRetro(raw, r, n); attempts.delete(raw); lanes.delete(raw);
          return;
        }
        // HOISTED (early-exit design, 2026-07-01): the widened halt condition below (shouldHaltMission)
        // must SEE the failed step's recurringError BEFORE deciding retry-vs-terminal, not after — the
        // prior code only computed this inside the n>=MAX_ATTEMPTS branch, one branch too late to ever
        // gate on it. r?.ok is truthy for DONE/SPLIT, so failedStep is simply unused (harmless) there.
        const failedStep = (r?.steps || []).filter((s) => !s.ok).pop();
        if (r?.ok) {
          evt(`DONE: ${raw}`);
          setMark(raw, 'DONE');
          try { chainStreak('DONE', path.join(LOGDIR, 'fail-streak.json')); } catch { /* breaker is best-effort */ }
          // CONDUCTOR-SELF-WITNESS — AFTER PASS (M-ENGINE.CONDUCTOR-SELF-WITNESS.1, operator
          // principle 2026-06-16 06:24 "witness BEFORE *and* AFTER"). The before pass (at fire)
          // witnessed the mission's DESIGN. This second pass witnesses the produced RESULT
          // against REALITY: did the OUTPUT actually satisfy the mission's own "Done means"?
          // The autosplit-spam bug proved a before-only check can't catch output bugs — it
          // lived entirely in the after-gap. buildAfterContext extracts the Done-means + the
          // REAL receipts off `r` (step targets, validation outcomes, verdict) — ground truth,
          // not self-assertion. DETACHED + FIRE-AND-FORGET + NON-BLOCKING: DONE is already
          // marked above and the lane releases below regardless — this NEVER un-DONEs, delays,
          // or gates the mission. A flagged after-pass (output did NOT match Done-means) is a
          // FLAG the conductor reads next beat. GR10-SAFE: reuses witnessArtifact (serial
          // laguna->guardian, yields on oversubscribe). Only the DONE branch fires it — SPLIT
          // (intercepted above) and FAILED do NOT (nothing to verify against Done-means).
          if (shouldWitnessAfter(r)) {
            const wname = path.basename(raw).replace(/\.mission\.txt$/, '');
            try {
              const mtext = readFileSync(missionFile, 'utf8');
              const { text: afterText, context: afterCtx } = buildAfterContext(mtext, r, { artifact: wname, artifact_kind: 'mission' });
              witnessArtifact(afterText, afterCtx)
                .then((w) => {
                  const wr = w?.receipt;
                  if (!wr) return;
                  evt(`SELF-WITNESS[after] ${wname}: ok=${wr.ok} struct=${wr.laguna?.verdict ?? 'n/a'} guardian=${wr.guardian?.grounded ?? 'n/a'}${wr.ok === false ? ` — FLAG (output vs Done-means): ${(wr.reasons || []).join(' | ').slice(0, 200)}` : ''}`);   // "struct" = structural witness (default ornith:9b); r.laguna is a legacy FIELD name, not the model
                })
                .catch((e) => evt(`SELF-WITNESS[after] error (non-blocking, ignored): ${wname} — ${String(e?.message).slice(0, 120)}`));
            } catch (e) { evt(`SELF-WITNESS[after] skipped (non-blocking): ${wname} — ${String(e?.message).slice(0, 120)}`); }
          }
          // information-dense DONE (operator 2026-06-10: "they don't tell me anything
          // valuable") — say WHAT was made and WHERE, not just that something finished.
          const mname = path.basename(raw).replace(/\.mission\.txt$/, '');
          const arts = [...new Set((r?.steps || []).map((s) => s.target).filter(Boolean))].slice(0, 4);
          const pt = missionPoint(missionFile);
          notify(`✅ DONE: ${mname}${pt ? `\nPOINT: ${pt}` : ''}${arts.length ? `\nmade: ${arts.join(', ')}\nopen: muezzin-plugin\\missions\\${mname}\\` : ''}\n${nextUpLine()}\n${scoreLine()}`);
          writeRetro(raw, r, n); attempts.delete(raw);
        }
        else if (shouldHaltMission(n, MAX_ATTEMPTS, failedStep)) {
          // the REAL reason lives in the failed step's error or the verdict findings —
          // the bare phase name ('verify') is what made every FAILED push useless
          // (operator receipt: 6 pushes all saying '— verify', 2026-06-10).
          const why = (failedStep?.error || failedStep?.violations?.join('; ') || r?.findings?.map((f) => f.description).join('; ') || r?.reason || r?.errors?.join('; ') || r?.phase || 'unknown').slice(0, 300);
          // EARLY vs BUDGET-SPENT (early-exit design, 2026-07-01): shouldHaltMission can now halt
          // BEFORE the attempt budget (MAX_ATTEMPTS) is spent, on a proven recurring-error pattern
          // alone. Distinguish the two in the receipt text ONLY — setMark/writeRetro/attempts.delete
          // below are byte-for-byte the same terminal FAILED path either way (no new status).
          const early = n < MAX_ATTEMPTS;
          evt(`${early ? `RECURRING-HALT (early, attempt ${n}/${MAX_ATTEMPTS})` : `FAILED (x${n})`}: ${raw} — ${why}`);
          setMark(raw, 'FAILED');
          // VALUE LAYER (operator 2026-06-11: "state what the root of the failure was and
          // what the outcome is"): ROOT = the witnessed why; DISPOSITION = what happens
          // next mechanically (conductor diagnoses at next beat; fix-ledgered classes
          // auto-requeue once their fix is live); POINT/NEXT = why this mission mattered
          // and what the queue works on now.
          const pt = missionPoint(missionFile);
          // RECURRING-ERROR FLAG (2026-07-01): the identical raw error already fired 3+ times
          // across this mission's replans/escalations -- almost certainly an infra bug, not a
          // content defect no amount of re-authoring will fix. Called out distinctly so the
          // operator doesn't have to grep mission-events.jsonl by hand to notice the pattern
          // (that's exactly how tonight's real agy_dispatch.mjs crash went unnoticed for ~55m).
          const recurringFlag = failedStep?.recurringError
            ? `\n⚠️ RECURRING (seen ${failedStep.priorOccurrences}x already) — likely an engine/infra bug, not fixable by re-authoring`
            : '';
          notify(`${early ? '⛔ RECURRING-HALT' : `❌ FAILED x${n}`}: ${path.basename(raw).replace(/\.mission\.txt$/, '')}\nROOT step ${failedStep?.step ?? '?'}: ${why.slice(0, 140)}${recurringFlag}${early ? `\nHALTED at attempt ${n}/${MAX_ATTEMPTS} — pattern already proven, remaining attempt(s) skipped` : ''}\nDISPOSITION: conductor diagnoses at next beat; fix-ledgered classes auto-requeue${pt ? `\nPOINT: ${pt}` : ''}\n${nextUpLine()}\n${scoreLine()}`);
          writeRetro(raw, r, n); attempts.delete(raw);
          try {
            const streak = chainStreak('FAILED', path.join(LOGDIR, 'fail-streak.json'));
            if (streak.alert) {
              evt(`CHAIN-STREAK: ${streak.count} consecutive terminal-FAILED runs across missions (cause-blind counter) — the chain itself is the anomaly; conductor must change strategy, not requeue the next mission`);
              notify(`🚨 CHAIN-STREAK: ${streak.count} missions FAILED in a row (different causes — invisible to the cause-class storm watch).\nThe chain is the problem, not any one mission. Conductor strategy change required at next beat.\n${scoreLine()}`);
            }
          } catch { /* breaker is best-effort */ }
        }
        else { evt(`attempt ${n} failed (${r?.phase}); will retry: ${raw}`); setMark(raw, ''); }
        lanes.delete(raw);
        laneStartTs.delete(raw);
      })
      .catch((e) => {
        // OUTCOME-HANDLER SAFETY NET (M-DAEMON-CRASH-HANDLER hardening, 2026-07-01 — from an
        // adversarial review of baf4ed9, caveat B): the .then above frees the lane at its LAST
        // two lines. If an earlier branch op throws (setMark's writeFileSync to AUTORUN hitting
        // EBUSY on Windows; writeRetro on disk error), that cleanup is skipped — and now that the
        // global unhandledRejection handler log-AND-CONTINUEs instead of terminating, the lane
        // LEAKS in the lanes Map. With MAX_LANES=1 a single leak wedges the daemon (alive but
        // never fires again). This local catch guarantees the lane is freed (the severe failure)
        // and logs the throw with a stack. It deliberately does NOT touch the mission's mark: if
        // setMark threw, the line is still RUNNING and reclaimStaleRunning reverts it on the next
        // restart; if the throw came after a terminal mark, that mark is already correct and
        // reverting here could re-run a DONE mission (duplicate side effects). Freeing the lane is
        // the fix that matters — it restores the pre-change guarantee that one bad outcome cannot
        // permanently stop the daemon from firing.
        logCrash('runMission-outcome', e);
        lanes.delete(raw);
        laneStartTs.delete(raw);
      });
    lanes.set(raw, p);
    laneStartTs.set(raw, new Date().toISOString());
  };

  while (true) {
    // GRACEFUL RELOAD (2026-07-02): landing an engine fix needs the daemon to reload the new code
    // (Node caches imports in-process). Force-killing the PID is the only other path and the harness
    // classifier blocks it (it protects a running shared workload). So honor a flag file: when it is
    // present AND no lane is mid-mission, delete it and exit(0) — daemon-supervisor.ps1 respawns in
    // ~3s with fresh code, no mission interrupted. Writing the flag (conduct-cycle --request-reload,
    // or `New-Item _logs/RELOAD-REQUEST`) is classifier-safe; a force-kill is not. Makes engine-fix
    // activation self-service instead of an operator force-kill every time.
    if (lanes.size === 0 && existsSync(RELOAD_FLAG)) {
      try { rmSync(RELOAD_FLAG, { force: true }); } catch { /* best-effort — a stale flag would just re-exit next poll */ }
      evt('GRACEFUL-RELOAD: flag honored between missions — exiting for supervisor respawn with fresh code');
      process.exit(0);
    }
    // LIVE-CANARY (blind-spot #29, GAP-FIRST ruling 2026-07-03): every 6h, lane-free only
    // (puppeteer is heavy; missions keep right of way), run the REAL e2e verifier against
    // the LIVE site. Fire-and-forget with a hard timeout — the drain loop never waits on it.
    // State survives reloads in _logs/live-canary.json; pushes are transition-based only.
    if (lanes.size === 0 && !canaryRunning) {
      try {
        const cst = existsSync(CANARY_STATE) ? JSON.parse(readFileSync(CANARY_STATE, 'utf8')) : {};
        if (canaryDue(Date.parse(cst.last_run || ''))) {
          canaryRunning = true;
          const started = new Date().toISOString();
          execFile('node', [CANARY_SCRIPT], {
            cwd: path.dirname(path.dirname(CANARY_SCRIPT)), timeout: 5 * 60000, windowsHide: true,
            env: { ...process.env, MT_BASE_URL: 'https://muddytires.ca' },
          }, (err, stdout, stderr) => {
            canaryRunning = false;
            const verdict = err ? 'FAIL' : 'PASS';
            const tail = String(stdout || '').slice(-300).replace(/\s+/g, ' ');
            const tr = canaryTransition(cst.last_verdict, verdict);
            try { writeFileSync(CANARY_STATE, JSON.stringify({ last_run: started, last_verdict: verdict, tail }, null, 2)); } catch { }
            evt(`LIVE-CANARY ${verdict}: muddytires.ca e2e ${verdict === 'PASS' ? 'healthy' : `REGRESSED — ${(String(stderr || stdout || '').slice(-200)).replace(/\s+/g, ' ')}`}`);
            if (tr.push) notify(`${tr.text}\n${scoreLine()}`);
          });
        }
      } catch { canaryRunning = false; /* canary must never break the drain loop */ }
    }
    try {
      if (Date.now() - lastHealTs >= HEAL_INTERVAL_MS) {
        lastHealTs = Date.now();
        try {
          const healed = conductCycleHeal(HERE, Date.now());
          if (healed.performed?.length) evt(`AUTO-HEAL: ${healed.performed.map((p) => `${p.action}${p.stem ? `(${p.stem})` : ''}`).join(', ')}`);
        } catch (e) {
          const detail = e.stderr ? e.stderr.toString().trim() : e.message;
          evt(`AUTO-HEAL error (continuing, next cycle in ${HEAL_INTERVAL_MS / 60000}m): ${detail}`);
        }
      }
      const { pending } = readQueue();
      for (const { raw } of pending) {
        if (lanes.size >= MAX_LANES) break;
        if (lanes.has(raw)) continue;
        // RELOAD LIVENESS (2026-07-02): under continuous load, missions chain fail->next-fire
        // within one poll iteration (172ms receipt), so the loop-top reload check never sees an
        // empty lane and a pending flag can wait HOURS. Check again here — between missions,
        // BEFORE firing the next one — so committed engine fixes land at the next boundary.
        if (lanes.size === 0 && existsSync(RELOAD_FLAG)) {
          try { rmSync(RELOAD_FLAG, { force: true }); } catch { /* stale flag re-exits next poll */ }
          evt('GRACEFUL-RELOAD: flag honored between missions (mid-drain boundary) — exiting for supervisor respawn with fresh code');
          process.exit(0);
        }
        // FIRE-TIME TARTIB GATE: hold a queued mission whose dependency lacks a PASS receipt;
        // skip to the NEXT pending line (never deadlock the lane behind an unsatisfiable head).
        try {
          const mtxt = readFileSync(path.join(HERE, raw.replace(/\//g, path.sep)), 'utf8');
          const artxt = readFileSync(AUTORUN, 'utf8');
          const resOk = (dep) => { try { return JSON.parse(readFileSync(path.join(HERE, 'missions', path.basename(dep).replace(/\.mission\.txt$/, '') + '.mission.result.json'), 'utf8')).ok === true; } catch { return false; } };
          const gate = queuedDepsHold(mtxt, raw, artxt, resOk);
          if (gate.hold) {
            const key = `${raw}|${gate.dep}`;
            if (!tartibHoldLogged.has(key)) { tartibHoldLogged.add(key); evt(`TARTIB-HOLD: ${raw} — ${gate.why}; skipping to next pending`); }
            continue;
          }
        } catch { /* unreadable mission file: let fire() handle/report it as before */ }
        await fire(raw);   // await: fire only blocks on the pre-flight readiness gate; the mission itself still launches non-blocking into lanes (M-READINESS-GATE.1)
      }
      // AUTO-QUEUE FROM SUBSTRATE (queue-flow-1, Half B): manual append fired above; only
      // when it leaves a lane free AND no ready pending line remains to fill it do we
      // promote ONE constructed-but-never-queued mission from disk. This FILLS GAPS — it
      // never races manual append (a live pending line always wins the lane first). One
      // promotion per tick: the appended line is picked up as normal pending on the NEXT
      // poll, re-reading truth (RUNNING/DONE marks, fresh manual appends) before the next.
      // NEVER promotes a triaged (already-in-AUTORUN) or HELD/BLOCKED/unsatisfied-dep
      // mission (pickPromotion enforces both). Disable via MUEZZIN_NO_AUTOPROMOTE=1.
      const noReadyPending = readQueue().pending.filter(({ raw }) => !lanes.has(raw)).length === 0;
      if (process.env.MUEZZIN_NO_AUTOPROMOTE !== '1' && lanes.size < MAX_LANES && noReadyPending) {
        autoPromoteFromSubstrate();   // appends at most one line; fired next poll
      }
    } catch (e) { evt(`daemon loop error (continuing): ${e.message}`); }
    setStatus({
      state: lanes.size ? 'running' : 'idle',
      lanes: [...lanes.keys()].map((raw) => ({ path: raw, start_ts: laneStartTs.get(raw) })),
      queued: readQueue().pending.length,
    });
    await new Promise((res) => setTimeout(res, lanes.size ? 5000 : POLL_MS));
  }
}

// ---- CRASH INSTRUMENTATION (M-DAEMON-CRASH-HANDLER, 2026-07-01) ----
// The daemon had NO global uncaughtException/unhandledRejection handler, so a throw outside
// mainLoop's inner try/catch (~line 944) OR a rejected detached promise (this daemon has
// several fire-and-forget witnesses/notifies) killed the process with ZERO trace — the
// leading theory in STATE.md's OPEN WORK QUEUE for the silent-death crash class that has made
// missions fail mysteriously. These handlers turn every such event into a dated stack in
// _logs/daemon-crash.log + a daemon event, and (because registering an unhandledRejection
// handler suppresses Node 22's default terminate) stop a NON-fatal detached rejection from
// killing a healthy daemon.
const CRASHLOG = path.join(LOGDIR, 'daemon-crash.log');
function logCrash(kind, err, target = CRASHLOG) {
  const stack = err && err.stack ? err.stack : String(err);
  const line = `${new Date().toISOString()} [${kind}] ${stack}`;
  try { appendFileSync(target, line + '\n\n'); } catch { /* best-effort: never let logging crash the crash handler */ }
  // Only touch the real event stream for real crashes — a selftest call with a custom target must not pollute daemon-events.log.
  if (target === CRASHLOG) { try { evt(`CRASH [${kind}]: ${String((err && err.message) || err).slice(0, 300)} — full stack in _logs/daemon-crash.log`); } catch { /* best-effort */ } }
}
function _onUncaught(err) { logCrash('uncaughtException', err); process.exit(1); }
function _onUnhandled(reason) { logCrash('unhandledRejection', reason); }
function installCrashHandlers() {
  // uncaughtException: process state is undefined after a synchronous throw escaped everything
  // — log the stack and exit(1) so the supervisor restart-loop brings up a CLEAN process
  // rather than limping on in an unknown state.
  process.on('uncaughtException', _onUncaught);
  // unhandledRejection: registering a handler ALSO suppresses Node 22's default terminate, so
  // a non-fatal detached-promise rejection is logged, not fatal. mainLoop's own loop errors
  // are already caught (~line 944); a rejection reaching here is BY DEFINITION from outside
  // that loop, so continuing is correct. A rejection of mainLoop's OWN promise is caught
  // explicitly at the entry point below (log + exit), never reaching this handler.
  process.on('unhandledRejection', _onUnhandled);
}

// ---- self-test (offline, argv-guarded): queue mechanics only — no seats dispatched.
if (process.argv.includes('--selftest')) {
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'mzd_'));
  const q = path.join(tmp, 'AUTORUN.md');
  writeFileSync(q, '# comment\nmissions/nope.mission.txt\nDONE missions/old.mission.txt\n');
  // Canonical line parsing — the helpers that settle the 2026-06-09 DONE->FAILED bug.
  ck(missionPath('RUNNING missions/x.mission.txt  <!-- 2026 -->') === 'missions/x.mission.txt', 'missionPath strips status + comment');
  ck(missionPath('FAILED FAILED missions/x  <!-- a -->  <!-- b -->') === 'missions/x', 'missionPath survives STACKED status/comments (the exact corruption seen in AUTORUN)');
  ck(statusOf('DONE missions/x') === 'DONE' && statusOf('missions/x') === null, 'statusOf reads terminal status / null when bare');
  // Round-trip regression: a mission marked DONE is NEVER seen as pending again, and a
  // RUNNING line re-marks to the RIGHT place by path (the bug re-found by full line and missed).
  const pend = (text) => text.split(/\r?\n/).map((line) => ({ raw: missionPath(line), s: statusOf(line), c: line.trim().startsWith('#') }))
    .filter((o) => o.raw && !o.c && !o.s).map((o) => o.raw);
  ck(JSON.stringify(pend('# c\nmissions/nope.mission.txt\nDONE missions/old.mission.txt')) === JSON.stringify(['missions/nope.mission.txt']), 'pending: skips comment + DONE, finds the one live mission');
  ck(pend('RUNNING missions/x  <!-- ts -->').length === 0, 'RUNNING line is NOT pending (no double-fire)');
  ck(pend('DONE missions/x  <!-- ts -->').length === 0, 'DONE line is NOT pending (the bug: it used to re-fire as missing-file)');
  ck(pidAlive(process.pid) === true, 'pidAlive: own pid is alive');
  ck(pidAlive(999999999) === false, 'pidAlive: bogus pid is dead');
  // TEMP pidfile only (2026-06-11: this selftest ORPHANED the live daemon TWICE today by
  // overwriting + deleting the REAL pidfile — conduct-cycle then read "daemon DEAD" while
  // missions ran headless, and one recovery spawned a second daemon. Selftests never
  // touch live state.)
  const tpid = path.join(tmp, 'daemon.pid');
  writeFileSync(tpid, '999999999');
  ck(acquireSingleton(tpid).ok === true, 'singleton: stale (dead-holder) pidfile is claimed');
  ck(acquireSingleton(tpid).ok === false, 'singleton: live holder (ourselves, just written) refuses a second acquire');
  // ──────────────────────────────────────────────────────────────────────────
  // HALF A — HAJJ SPLIT status mechanics (queue-flow-1). SPLIT is a settled, non-firing
  // status: it is parsed like DONE/FAILED (excluded from pending, stripped in missionPath,
  // reported by statusOf) so a split parent is NEVER re-fired. (The end-to-end split-on-
  // daemon behavior — opts→orchestrate→S-files+AUTORUN-append+parent-SPLIT — is proven in
  // orchestrate.mjs's SPLIT(1) test through the real defaultSplitFn; here we lock the
  // daemon-side contract that consumes that outcome.)
  ck(statusOf('SPLIT missions/parent.mission.txt  <!-- ts -->') === 'SPLIT', 'SPLIT: statusOf reads SPLIT as a terminal status');
  ck(missionPath('SPLIT missions/parent.mission.txt  <!-- ts -->') === 'missions/parent.mission.txt', 'SPLIT: missionPath strips the SPLIT status + comment');
  ck(pend('SPLIT missions/parent.mission.txt  <!-- ts -->').length === 0, 'SPLIT: a SPLIT line is NOT pending (the parent is never re-fired — its children carry the work)');
  // and a SPLIT-marked line does not interfere with a sibling live line being pending.
  ck(JSON.stringify(pend('SPLIT missions/p.mission.txt\nmissions/p.S1.mission.txt')) === JSON.stringify(['missions/p.S1.mission.txt']), 'SPLIT: a SPLIT parent + a live child -> only the child is pending');
  // ──────────────────────────────────────────────────────────────────────────
  // RETRO-REPEAT GATE (blind-spot #24): >=3 same-stem FAILED retros in 24h + unchanged
  // mission text -> refuse the fire; amended text or sparse failures -> pass. These lock
  // the exact 924-retro-storm class and the legitimate-refire path.
  {
    const NOW = Date.parse('2026-07-03T01:00:00Z');
    const ts = (h) => `2026-07-03T0${h}-00-00-000Z`;
    const mk = (names, failHead = '# RETRO x — FAILED(plan)') => ({
      readdir: () => names, readHead: () => failHead, now: NOW,
    });
    const three = [`st-${ts(0)}.md`, `st-2026-07-03T00-20-00-000Z.md`, `st-2026-07-03T00-40-00-000Z.md`];
    const oldMtime = Date.parse('2026-07-02T00:00:00Z'), newMtime = Date.parse('2026-07-03T00:50:00Z');
    ck(retroRepeatBlocked('st', '/r', oldMtime, mk(three)).blocked === true, 'retro-gate: 3 FAILED in 24h + unchanged mission -> BLOCKED (924-storm class)');
    ck(retroRepeatBlocked('st', '/r', newMtime, mk(three)).blocked === false && retroRepeatBlocked('st', '/r', newMtime, mk(three)).amended === true, 'retro-gate: AMENDED mission (mtime newer than newest retro) -> passes (the poi-tags/trip-cost path)');
    ck(retroRepeatBlocked('st', '/r', oldMtime, mk(three.slice(0, 2))).blocked === false, 'retro-gate: only 2 failures -> passes');
    ck(retroRepeatBlocked('st', '/r', oldMtime, mk([`st-2026-07-01T00-00-00-000Z.md`, `st-2026-07-01T01-00-00-000Z.md`, `st-2026-07-01T02-00-00-000Z.md`])).blocked === false, 'retro-gate: 3 failures but OUTSIDE 24h window -> passes');
    ck(retroRepeatBlocked('st', '/r', oldMtime, mk(three, '# RETRO st — DONE (5m)')).blocked === false, 'retro-gate: DONE retros never count as failures');
    ck(retroRepeatBlocked('st', '/r', oldMtime, mk([`st.S1-${ts(0)}.md`, `st.S1-2026-07-03T00-20-00-000Z.md`, `st.S1-2026-07-03T00-40-00-000Z.md`])).blocked === false, 'retro-gate: CHILD-stem retros do not gate the parent');
    ck(retroRepeatBlocked('st', '/nonexistent', oldMtime, { readdir: () => { throw new Error('ENOENT'); }, now: NOW }).blocked === false, 'retro-gate: unreadable retro dir -> never blocks a fire (best-effort)');
  }
  // ──────────────────────────────────────────────────────────────────────────
  // LIVE-CANARY (#29) + GAP-PRIORITY-HOLD (operator ruling 2026-07-03) contracts.
  ck(canaryTransition(undefined, 'FAIL').push === true, 'canary: FIRST failure pushes (aurora hollow-live class now self-alerts)');
  ck(canaryTransition('FAIL', 'FAIL').push === false, 'canary: repeat failure is SILENT (outcome-only ruling; board carries standing state)');
  ck(canaryTransition('FAIL', 'PASS').push === true, 'canary: recovery pushes once');
  ck(canaryTransition('PASS', 'PASS').push === false, 'canary: steady-green is silent');
  ck(canaryDue(NaN) === true, 'canary: never-ran -> due');
  ck(canaryDue(Date.now() - 7 * 3600e3) === true && canaryDue(Date.now() - 3600e3) === false, 'canary: 6h interval respected');
  ck(gapHoldSkips('missions/mt-integrate-anything.S1.mission.txt') === true, 'gap-hold: product (mt-*) fires DEFERRED while flag open');
  ck(gapHoldSkips('missions/engine-fix-something.mission.txt') === false && gapHoldSkips('missions/damm-repay.mission.txt') === false, 'gap-hold: engine/damm missions keep firing (holding them would defeat the ruling)');
  // WIDENED 2026-07-04 (hunt-item #17): the mt- test alone missed real on-disk product
  // missions -- muddytires-*.mission.txt (literal word, not the mt- abbreviation) and the
  // hunt-item's own named examples (b13-*, card-*, cgsports-*, quirky-*).
  ck(gapHoldSkips('missions/muddytires-community-1-social-platform.mission.txt') === true, 'gap-hold: literal "muddytires-" prefix (not just "mt-") now held -- real on-disk mission that slipped through before this fix');
  ck(gapHoldSkips('missions/b13-sitemap-prune-cf-limits.mission.txt') === true, 'gap-hold: b13-* held (hunt-item #17 named example)');
  ck(gapHoldSkips('missions/card-vanlife-muddy.mission.txt') === true, 'gap-hold: card-* held (hunt-item #17 named example)');
  ck(gapHoldSkips('missions/cgsports-resume-dossier.mission.txt') === true, 'gap-hold: cgsports-* held (hunt-item #17 named example)');
  ck(gapHoldSkips('missions/quirky-poi-curation.mission.txt') === true, 'gap-hold: quirky-* held (hunt-item #17 named example)');
  ck(gapHoldSkips('missions/get-upgrade.mission.txt') === false, 'gap-hold: get-* (installer tooling, not muddytires product) deliberately NOT held -- ambiguous prefixes stay live rather than risk blocking real engine/tooling work');
  // ──────────────────────────────────────────────────────────────────────────
  // STORM-ALERT (self-healing audit 2026-07-02): repeating failure signatures push once at
  // 3 hits + once at 50, normalized over numbers/hashes, capped at 5 pushes/hour, and benign
  // lines never match. These lock the exact incident classes the audit receipted.
  ck(stormSig('fired: missions/x.mission.txt') === null, 'storm: benign event line -> no signature (never counted)');
  ck(stormSig('FAILED (missing file): missions/a.mission.txt') !== null, 'storm: failure line -> gets a signature');
  ck(stormSig('claude-exec err model=sonnet attempt 2 code=1') === stormSig('claude-exec err model=sonnet attempt 9 code=53'),
    'storm: numbers normalized — attempt 2 vs attempt 9 collapse to ONE signature');
  ck(stormSig('FAILED cherry-pick cbb07a5f0 conflict') === stormSig('FAILED cherry-pick deadbeef1 conflict'),
    'storm: hashes normalized — different SHAs collapse to ONE signature');
  ck(stormSig('FAILED (missing file): missions/a.mission.txt') !== stormSig('FAILED (missing file): missions/b.mission.txt'),
    'storm: DIFFERENT missions stay DISTINCT signatures (per-mission storm detection)');
  {
    const pushed = []; const nf = (t) => pushed.push(t); const t0 = 1000000;
    const S = { counts: new Map(), pushes: [] };
    ck(stormWatch('FAILED (missing file): missions/a.mission.txt', S, nf, t0) === null, 'storm: hit 1 -> silent');
    ck(stormWatch('FAILED (missing file): missions/a.mission.txt', S, nf, t0) === null, 'storm: hit 2 -> silent');
    const a3 = stormWatch('FAILED (missing file): missions/a.mission.txt', S, nf, t0);
    ck(!!a3 && /3x/.test(a3), 'storm: hit 3 -> ONE push naming 3x (the 66k-storm class now alerts in ~1 min, not never)');
    for (let i = 4; i <= 49; i++) ck2Silent(stormWatch('FAILED (missing file): missions/a.mission.txt', S, nf, t0), i);
    const a50 = stormWatch('FAILED (missing file): missions/a.mission.txt', S, nf, t0);
    ck(!!a50 && /x50 ESCALATION/.test(a50), 'storm: hit 50 -> single escalation push');
    ck(pushed.length === 2, `storm: 50 identical failures -> exactly 2 pushes total (one-shot, not a push-storm) — got ${pushed.length}`);
    // cause-class (2026-07-03 rotating-signature fix): DIFFERENT missions, SAME cause -> pushes.
    {
      const Sc = { counts: new Map(), pushes: [] }; const pc = []; const nfc = (t) => pc.push(t);
      stormWatch('FAILED (x2): missions/a.mission.txt — dispatch failed (HTTP_503): server busy', Sc, nfc, t0);
      stormWatch('FAILED (x2): missions/b.mission.txt — dispatch failed (HTTP_503): server busy', Sc, nfc, t0);
      const c3 = stormWatch('FAILED (x2): missions/c.mission.txt — dispatch failed (HTTP_503): server busy', Sc, nfc, t0);
      ck(!!c3 && /CAUSE \(CAUSE:HTTP_503\)|failure CAUSE \(HTTP_503\)/.test(c3), `storm: ROTATING missions + constant cause -> cause-class push at 3 (the 45-min-silent 503 storm class) — got ${JSON.stringify(c3).slice(0, 80)}`);
      ck(pc.length === 1, 'storm: cause-class push is one-shot too');
      const Sd = { counts: new Map(), pushes: [] }; const pd = [];
      stormWatch('FAILED (missing file): missions/x.mission.txt', Sd, (t) => pd.push(t), t0);
      stormWatch('FAILED (x2): missions/y.mission.txt — dispatch failed (HTTP_503)', Sd, (t) => pd.push(t), t0);
      stormWatch('claude-exec err model=z TIMEOUT', Sd, (t) => pd.push(t), t0);
      ck(pd.length === 0, 'storm: three DIFFERENT causes across different missions -> no cause-class push (distinct causes stay distinct)');
    }
    // hourly cap: 5 pushes already spent this hour -> a NEW signature's 3rd hit is suppressed.
    const Scap = { counts: new Map(), pushes: [t0 - 100, t0 - 200, t0 - 300, t0 - 400, t0 - 500] };
    const cf = []; for (let i = 0; i < 3; i++) stormWatch('FAILED other: missions/z.mission.txt', Scap, (t) => cf.push(t), t0);
    ck(cf.length === 0, 'storm: hourly cap (5) suppresses further storm pushes (outcome-only ruling)');
    // ...and the cap WINDOW slides: an hour later the same state pushes again.
    const cf2 = []; for (let i = 0; i < 3; i++) stormWatch('FAILED late: missions/w.mission.txt', Scap, (t) => cf2.push(t), t0 + 3700e3);
    ck(cf2.length === 1, 'storm: cap window slides — pushes resume after the hour');
  }
  function ck2Silent(r, i) { if (r !== null) ck(false, `storm: hit ${i} should be silent between 3 and 50`); }

  // HALF A — the daemon actually PASSES the split opts to orchestrate. Import the real
  // orchestrate with an INJECTED splitFn that captures the ctx orchestrate hands it, and a
  // throwing implementFn (a split must short-circuit before any step). This proves
  // missionsDir / parentMissionFile / autorunFile flow through exactly as the live daemon
  // sets them — the one-line wiring the autosplit agent deferred.
  {
    const { orchestrate } = await import('./orchestrate.mjs');
    const t2 = mkdtempSync(path.join(os.tmpdir(), 'mzd_split_'));
    const mdir = path.join(t2, 'missions'); mkdirSync(mdir, { recursive: true });
    const sbx = path.join(mdir, 'parent'); mkdirSync(sbx, { recursive: true });
    const arun = path.join(mdir, 'AUTORUN.md'); writeFileSync(arun, '# q\n');
    let capturedCtx = null;
    // injected splitFn returns a split result, capturing the ctx (4th arg) orchestrate passes.
    const fakeSplit = (mission, queue, opts, ctx) => {
      capturedCtx = ctx;
      return { split: true, ceiling: 3, parentId: 'M-P.1', stepCount: 7,
        emission: { files: [{ id: 'M-P.1.S1', rel: 'missions/parent.S1.mission.txt', predecessorId: null, steps: 3 }], manifestPath: path.join(mdir, 'parent._split-manifest.json'), queued: ['missions/parent.S1.mission.txt'] } };
    };
    const neverImpl = async () => { throw new Error('IMPLEMENT RAN ON A SPLIT MISSION'); };
    const r = await orchestrate('MISSION-ID: M-P.1\nMaqsad: x', sbx, {
      deconstructFn: async () => ({ ok: true, queue: { mission_id: 'M-P.1', steps: Array.from({ length: 7 }, (_, i) => ({ step_index: i + 1, description: `s${i}`, action_type: 'edit', target_files: [`f${i}.mjs`], context_dependencies: [], validation_command: 'node -e 0' })) } }),
      implementFn: neverImpl, splitFn: fakeSplit,
      // EXACTLY what runMission sets (the wiring under test):
      missionsDir: mdir, parentMissionFile: path.join(mdir, 'parent.mission.txt'), autorunFile: arun,
      verdictFn: async () => ({ consensus: 'APPROVE', dispositions: [], contracts: [] }), witnessFn: async () => ({ verdict: 'APPROVE', findings: [] }), maxRepairs: 0,
    });
    ck(r.ok === true && r.phase === 'split' && r.split === true, 'HALF A: an over-ceiling mission returns phase:split (parent NOT executed)');
    ck(capturedCtx && capturedCtx.missionsDir === mdir && capturedCtx.autorunFile === arun && capturedCtx.parentMissionFile === path.join(mdir, 'parent.mission.txt'), 'HALF A: the daemon-set missionsDir/parentMissionFile/autorunFile reach orchestrate -> the split CAN append children to the real AUTORUN');
    ck(Array.isArray(r.subMissions) && r.subMissions.length === 1, 'HALF A: the split outcome carries the emitted sub-missions for the SPLIT-mark/notify path');
    rmSync(t2, { recursive: true, force: true });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HALF B — AUTO-QUEUE FROM SUBSTRATE (pure promotion helpers). A constructed mission
  // file is promoted ONLY if it is (a) mentioned NOWHERE in AUTORUN (never triaged) and
  // (b) not held/blocked/awaiting an unsatisfied tartib predecessor.
  {
    // mentionedInQueue: a path present in AUTORUN — as a live line, a status line, OR a
    // '# HELD' comment — is already triaged and OFF LIMITS.
    const autorun = [
      '# queue',
      'RUNNING missions/running-one.mission.txt  <!-- ts -->',
      'DONE missions/done-one.mission.txt  <!-- ts -->',
      'FAILED missions/failed-one.mission.txt  <!-- ts -->',
      '# HELD missions/held-one.mission.txt  <!-- waiting on X -->',
      'missions/live-pending.mission.txt',
    ].join('\n');
    ck(mentionedInQueue(autorun, 'missions/running-one.mission.txt') === true, 'HALF B: a RUNNING mission is mentioned (off-limits)');
    ck(mentionedInQueue(autorun, 'missions/done-one.mission.txt') === true, 'HALF B: a DONE mission is mentioned (off-limits)');
    ck(mentionedInQueue(autorun, 'missions/failed-one.mission.txt') === true, 'HALF B: a FAILED mission is mentioned (off-limits — never resurrected by auto-promote)');
    ck(mentionedInQueue(autorun, 'missions/held-one.mission.txt') === true, 'HALF B: a # HELD comment mention is off-limits (held missions never auto-promote)');
    ck(mentionedInQueue(autorun, 'missions/never-seen.mission.txt') === false, 'HALF B: a file mentioned NOWHERE is a promotion candidate (the operator gap)');

    // promotionHold: own-text HELD/BLOCKED, and the tartib predecessor dependency.
    ck(promotionHold('MISSION-ID: M\nMaqsad: ok\nREQUIRES: none', new Set()).hold === false, 'HALF B: a ready mission (REQUIRES: none) is NOT held');
    ck(promotionHold('# HELD\nMaqsad: later', new Set()).hold === true, 'HALF B: a mission whose own text marks HELD is held');
    ck(promotionHold('Maqsad: blocked\n# BLOCKED pending fix', new Set()).hold === true, 'HALF B: a BLOCKED mission is held');
    ck(promotionHold('REQUIRES: predecessor M-X.S1 DONE (tartib)', new Set()).hold === true, 'HALF B: a tartib child with an UNSATISFIED predecessor is held');
    ck(promotionHold('REQUIRES: predecessor M-X.S1 DONE (tartib)', new Set(['M-X.S1'])).hold === false, 'HALF B: the same child is RELEASED once its predecessor is DONE');
    ck(promotionHold('REQUIRES: search', new Set()).hold === true, 'HALF B: a non-tartib prose REQUIRES (search) on a never-queued file is held (conductor-curated)');

    // pickPromotion end-to-end on a fake on-disk set: picks the one ready unqueued mission,
    // skipping queued + held + blocked + unsatisfied-dep. Lock the SKIP behavior with teeth.
    const disk = {
      'missions/already.mission.txt': 'MISSION-ID: A\nREQUIRES: none\nMaqsad: x',          // mentioned in AUTORUN -> skip
      'missions/held.mission.txt': '# HELD\nMaqsad: later',                                   // own-text held -> skip
      'missions/blocked.mission.txt': 'Maqsad: y\n# BLOCKED pending engine fix',              // blocked -> skip
      'missions/child.mission.txt': 'MISSION-ID: C\nREQUIRES: predecessor M-Z.S1 DONE (tartib)', // unsatisfied dep -> skip
      'missions/ready.mission.txt': 'MISSION-ID: R\nREQUIRES: none\nMaqsad: the ready one',   // READY -> picked
    };
    const files = ['already.mission.txt', 'held.mission.txt', 'blocked.mission.txt', 'child.mission.txt', 'ready.mission.txt'];
    const autorun2 = '# q\nmissions/already.mission.txt';   // only "already" is triaged
    const readText = (p) => { const rel = 'missions/' + p.split(/[\\/]/).pop(); if (rel in disk) return disk[rel]; throw new Error('ENOENT ' + p); };
    const picked = pickPromotion(autorun2, files, '/fake/missions', readText);
    ck(picked && picked.file === 'ready.mission.txt', 'HALF B: pickPromotion selects the one READY unqueued mission, SKIPPING queued/held/blocked/unsatisfied-dep');

    // once the tartib predecessor is DONE in AUTORUN, the child becomes promotable (and is
    // picked when it is the only remaining ready candidate).
    const autorun3 = '# q\nmissions/already.mission.txt\nmissions/ready.mission.txt\nDONE missions/zpred.mission.txt';
    const diskWithPred = { ...disk, 'missions/zpred.mission.txt': 'MISSION-ID: M-Z.S1\nMaqsad: pred' };
    const readText2 = (p) => { const rel = 'missions/' + p.split(/[\\/]/).pop(); if (rel in diskWithPred) return diskWithPred[rel]; throw new Error('ENOENT'); };
    const picked2 = pickPromotion(autorun3, [...files, 'zpred.mission.txt'], '/fake/missions', readText2);
    ck(picked2 && picked2.file === 'child.mission.txt', 'HALF B: a tartib child is auto-promotable ONCE its predecessor is marked DONE in AUTORUN (REQUIRES satisfied)');

    // nothing ready -> null (no spurious append). All candidates are queued/held.
    const allQueued = '# q\nmissions/ready.mission.txt\nmissions/child.mission.txt';
    const picked3 = pickPromotion(allQueued, ['ready.mission.txt', 'child.mission.txt', 'held.mission.txt', 'blocked.mission.txt'], '/fake/missions', readText);
    ck(picked3 === null, 'HALF B: when no unqueued+ready mission exists, pickPromotion returns null (manual append untouched, no spurious promotion)');

    // mt-c2b-pickpromotion: a candidate whose own text carries a landed-state claim disputed
    // by missionLandedState (verdict GENUINE — nothing matches at HEAD) must NOT be promoted.
    const stampDiskDisputed = {
      'missions/disputed.mission.txt': [
        'MISSION-ID: DSP', 'MISSION-CLASS: code-repo', 'REQUIRES: none',
        'REPO-ROOT: ' + ['C:', 'fake', 'repo'].join('/'),
        '  - ' + ['some', 'file.mjs'].join('/'),
      ].join('\n'),
      'missions/ready.mission.txt': 'MISSION-ID: R\nREQUIRES: none\nMaqsad: the ready one',
    };
    const stampReadDisputed = (p) => { const rel = 'missions/' + p.split(/[\\/]/).pop(); if (rel in stampDiskDisputed) return stampDiskDisputed[rel]; throw new Error('ENOENT'); };
    const absentGitFnPick = () => ({ ok: true, out: '' });
    const pickedDisputedOnly = pickPromotion('# q', ['disputed.mission.txt'], '/fake/missions', stampReadDisputed, '', absentGitFnPick);
    ck(pickedDisputedOnly === null, 'mt-c2b-pickpromotion: a disputed stamp (verdict GENUINE) as the ONLY candidate -> null, never promoted');
    const pickedDisputedSkipped = pickPromotion('# q', ['disputed.mission.txt', 'ready.mission.txt'], '/fake/missions', stampReadDisputed, '', absentGitFnPick);
    ck(pickedDisputedSkipped && pickedDisputedSkipped.file === 'ready.mission.txt', 'mt-c2b-pickpromotion: a disputed stamp is SKIPPED; the next ready candidate is promoted instead');

    // orderByPriority: a name appearing in the OPERATOR PRIORITY ORDER block sorts ahead of
    // an unlisted one; unlisted ties break lexically.
    const blockText = '# OPERATOR PRIORITY ORDER\n# P2. muddytires (d1, then resilience).\n# P3. corpus.';
    const ord = orderByPriority(['zeta-task.mission.txt', 'muddytires-d2.mission.txt', 'corpus-x.mission.txt'], blockText);
    ck(ord[0] === 'muddytires-d2.mission.txt' && ord[1] === 'corpus-x.mission.txt' && ord[2] === 'zeta-task.mission.txt', 'HALF B: orderByPriority ranks by the OPERATOR PRIORITY ORDER block (muddytires before corpus before the unlisted zeta)');

    // shouldHaltMission (early-exit design, 2026-07-01): locks the widened FAILED condition —
    // halts on EITHER the attempt budget being spent OR a proven recurring-error pattern,
    // whichever comes first. This is the exact decision fire()'s outcome-switch now delegates
    // to (previously an untestable inline `n >= MAX_ATTEMPTS`, buried inside the fire() closure).
    ck(shouldHaltMission(1, 2, { recurringError: false }) === false, 'RECURRING-HALT: attempt 1/2, no recurring pattern -> does NOT halt (normal retry — byte-for-byte the prior behavior)');
    ck(shouldHaltMission(2, 2, { recurringError: false }) === true, 'RECURRING-HALT: attempt budget spent (n>=MAX_ATTEMPTS) -> halts, exactly as before this change');
    ck(shouldHaltMission(1, 2, { recurringError: true, priorOccurrences: 2 }) === true, 'RECURRING-HALT: attempt 1/2 but recurringError already proven -> halts EARLY (the new behavior — does not wait for the 2nd attempt to burn)');
    ck(shouldHaltMission(1, 2, undefined) === false, 'RECURRING-HALT: no failed step at all (e.g. a split/plan-phase outcome with no per-step record) -> falls back to the attempt-budget check only, never throws on undefined');

    // ── TERMINAL-MISSION GUARD (spam-loop root fix, 2026-06-16) ──────────────────
    // A FAILED-x2 / DONE / SPLIT mission must NEVER be auto-promoted again. terminalMissionIds
    // reads terminal outcomes from TWO durable sources — AUTORUN status lines AND the
    // persistent MISSION-LEDGER.md — so a restart (which clears the in-memory attempts Map)
    // or a path-token drift cannot resurrect a dead mission into a loop.
    const ledger = [
      '| 2026-06-16T00:00:00Z | muddytires-d1-healthcheck-1 | FAILED(sandbox) | 2m | plans:1 steps:0 heals:0 halts:0 |',
      '| 2026-06-16T00:05:00Z | some-done-mission | DONE | 5m | plans:1 steps:3 heals:0 halts:0 |',
    ].join('\n');
    const tIds = terminalMissionIds('# q\nFAILED missions/from-autorun.mission.txt  <!-- ts -->', ledger);
    ck(tIds.has('muddytires-d1-healthcheck-1'), 'TERMINAL: a FAILED row in MISSION-LEDGER.md marks the mission terminal (survives restart)');
    ck(tIds.has('some-done-mission'), 'TERMINAL: a DONE ledger row is terminal');
    ck(tIds.has('from-autorun'), 'TERMINAL: a FAILED AUTORUN status line is terminal (second source of truth)');
    ck(!tIds.has('never-failed'), 'TERMINAL: a mission absent from both sources is NOT terminal');

    // THE LIVE LOOP, reproduced + closed: the FAILED mission file still sits on disk and its
    // path token is NOT in AUTORUN (the drift/restart case the old mentionedInQueue guard
    // missed). Without the terminal guard auto-promote re-fires it -> FAILED x2 -> loop. WITH
    // the ledger, pickPromotion now SKIPS it and falls through to the genuinely-ready mission.
    const loopDisk = {
      'missions/muddytires-d1-healthcheck-1.mission.txt': 'MISSION-ID: D1\nREQUIRES: none\nMaqsad: healthcheck',  // FAILED-x2 on disk, NOT in AUTORUN
      'missions/fresh-ready.mission.txt': 'MISSION-ID: F\nREQUIRES: none\nMaqsad: a genuinely new mission',
    };
    const loopFiles = ['muddytires-d1-healthcheck-1.mission.txt', 'fresh-ready.mission.txt'];
    const loopRead = (p) => { const rel = 'missions/' + p.split(/[\\/]/).pop(); if (rel in loopDisk) return loopDisk[rel]; throw new Error('ENOENT'); };
    const emptyAutorun = '# q (the FAILED mission is NOT mentioned here — restart/drift case)';
    // Without the ledger guard, the dead mission would be picked (proves the hole existed):
    const pickNoLedger = pickPromotion(emptyAutorun, loopFiles, '/fake/missions', loopRead, '');
    ck(pickNoLedger && pickNoLedger.file === 'muddytires-d1-healthcheck-1.mission.txt', 'TERMINAL: WITHOUT the ledger, the dead FAILED mission WOULD be re-promoted (the loop hole)');
    // WITH the ledger, it is excluded and the fresh mission is promoted instead (loop closed):
    const pickWithLedger = pickPromotion(emptyAutorun, loopFiles, '/fake/missions', loopRead, ledger);
    ck(pickWithLedger && pickWithLedger.file === 'fresh-ready.mission.txt', 'TERMINAL: WITH the ledger, the FAILED-x2 mission is NOT re-promoted; the next ready mission is picked instead (spam-loop CLOSED)');
    // and if the dead mission is the ONLY candidate, pickPromotion returns null (no resurrection).
    const pickOnlyDead = pickPromotion(emptyAutorun, ['muddytires-d1-healthcheck-1.mission.txt'], '/fake/missions', loopRead, ledger);
    ck(pickOnlyDead === null, 'TERMINAL: a FAILED-x2 mission as the ONLY candidate => null (a dead mission is never resurrected, even with nothing else to run)');

    // ── BUG 2 FIX REGRESSION (2026-06-25, split-path separation) ─────────────────
    // SETUP: a base mission foo-bar exists alongside its split children foo-bar.S1 and
    // foo-bar.S2. AUTORUN has FAILED entries for the BASE only — NOT for S1/S2. The OLD
    // logic stem-matched by 'foo-bar' alone, leaving S1/S2 unblocked (they're separate
    // stems) — but the user wants split paths to be PROPERLY treated as separate: a FAILED
    // base must not over-block its splits, AND a FAILED split must be honored on its own.
    //
    // PROPERTY 1: with only the base FAILED, the splits are STILL promotable (the base
    // FAILED does not over-reach into the splits — they have their own lifecycle).
    const splitDisk = {
      'missions/foo-bar.mission.txt': 'MISSION-ID: F\nREQUIRES: none\nMaqsad: base',
      'missions/foo-bar.S1.mission.txt': 'MISSION-ID: F.S1\nREQUIRES: none\nMaqsad: split 1',
      'missions/foo-bar.S2.mission.txt': 'MISSION-ID: F.S2\nREQUIRES: none\nMaqsad: split 2',
    };
    const splitFiles = ['foo-bar.mission.txt', 'foo-bar.S1.mission.txt', 'foo-bar.S2.mission.txt'];
    const splitRead = (p) => { const rel = 'missions/' + p.split(/[\\/]/).pop(); if (rel in splitDisk) return splitDisk[rel]; throw new Error('ENOENT'); };
    const baseOnlyFailed = '# q\nFAILED missions/foo-bar.mission.txt  <!-- base only -->';
    const pickBaseFailed = pickPromotion(baseOnlyFailed, splitFiles, '/fake/missions', splitRead, '');
    ck(pickBaseFailed && (pickBaseFailed.file === 'foo-bar.S1.mission.txt' || pickBaseFailed.file === 'foo-bar.S2.mission.txt'),
       'BUG 2: with only the BASE marked FAILED, a split child IS promotable (full-path exclusion — base FAILED does not over-block splits)');

    // PROPERTY 2: once a SPLIT is ALSO marked FAILED by its full path, it is excluded;
    // only the other split remains promotable. This is the contract the user specified:
    // "match by FULL PATH ... both need their own FAILED entries to be blocked."
    const baseAndS1Failed = '# q\nFAILED missions/foo-bar.mission.txt  <!-- base -->\nFAILED missions/foo-bar.S1.mission.txt  <!-- S1 -->';
    const pickAfterS1Failed = pickPromotion(baseAndS1Failed, splitFiles, '/fake/missions', splitRead, '');
    ck(pickAfterS1Failed && pickAfterS1Failed.file === 'foo-bar.S2.mission.txt',
       'BUG 2: a FAILED split is excluded by full path; the remaining split is promoted (each split needs its own terminal entry)');

    // PROPERTY 3: once ALL of base + S1 + S2 are FAILED, NO candidate is promotable —
    // no resurrection via stem mismatch.
    const allSplitsFailed = '# q\nFAILED missions/foo-bar.mission.txt\nFAILED missions/foo-bar.S1.mission.txt\nFAILED missions/foo-bar.S2.mission.txt';
    const pickAllFailed = pickPromotion(allSplitsFailed, splitFiles, '/fake/missions', splitRead, '');
    ck(pickAllFailed === null,
       'BUG 2: with base + S1 + S2 all marked FAILED, nothing is promotable (full-path exclusion catches every entry — no S3 resurrection)');

    // ── BUG 3 PARKED status (2026-06-25, operator-marked permanent block) ────────
    // STATUS_RE / statusOf / missionPath must treat PARKED as a terminal status the same as
    // DONE/FAILED/SPLIT. pickPromotion excludes a PARKED-marked path from promotion.
    ck(statusOf('PARKED missions/baz.mission.txt  <!-- broken indefinitely -->') === 'PARKED', 'BUG 3: statusOf reads PARKED as a terminal status');
    ck(missionPath('PARKED missions/baz.mission.txt  <!-- ts -->') === 'missions/baz.mission.txt', 'BUG 3: missionPath strips the PARKED status + comment cleanly');
    // pending-extraction skips PARKED lines (same as DONE/FAILED/SPLIT).
    ck(pend('PARKED missions/baz.mission.txt  <!-- ts -->').length === 0, 'BUG 3: a PARKED line is NOT pending (the parked mission is never re-fired)');

    // pickPromotion: a PARKED-marked baz must NOT be promoted, even when its file is on
    // disk and would otherwise be a candidate. The fresh-ready mission is picked instead.
    const parkedDisk = {
      'missions/baz.mission.txt': 'MISSION-ID: B\nREQUIRES: none\nMaqsad: parked indefinitely',
      'missions/other-ready.mission.txt': 'MISSION-ID: O\nREQUIRES: none\nMaqsad: ready to run',
    };
    const parkedFiles = ['baz.mission.txt', 'other-ready.mission.txt'];
    const parkedRead = (p) => { const rel = 'missions/' + p.split(/[\\/]/).pop(); if (rel in parkedDisk) return parkedDisk[rel]; throw new Error('ENOENT'); };
    const parkedAutorun = '# q\nPARKED missions/baz.mission.txt  <!-- broken — engine batch -->';
    const pickWithParked = pickPromotion(parkedAutorun, parkedFiles, '/fake/missions', parkedRead, '');
    ck(pickWithParked && pickWithParked.file === 'other-ready.mission.txt', 'BUG 3: a PARKED-marked mission is excluded from promotion; the other ready mission is picked');

    // and if PARKED is the ONLY candidate, pickPromotion returns null (no spurious append).
    const pickParkedOnly = pickPromotion(parkedAutorun, ['baz.mission.txt'], '/fake/missions', parkedRead, '');
    ck(pickParkedOnly === null, 'BUG 3: a PARKED mission as the ONLY candidate => null (parking is permanent until the operator un-parks)');

    // terminalMissionIds includes a PARKED AUTORUN line as terminal (full path + stem alias).
    const parkedIds = terminalMissionIds('# q\nPARKED missions/baz.mission.txt  <!-- ts -->', '');
    ck(parkedIds.has('missions/baz.mission.txt'), 'BUG 3: terminalMissionIds stores a PARKED line by FULL PATH (the bug-2 form)');
    ck(parkedIds.has('baz'), 'BUG 3: terminalMissionIds also stores a PARKED line by bare stem (back-compat alias)');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SELF-WITNESS AFTER PASS gating (M-ENGINE.CONDUCTOR-SELF-WITNESS.1, operator principle
  // 2026-06-16: witness BEFORE *and* AFTER). The after pass fires ONLY for a genuinely
  // completed mission (r.ok && !split) — never for a SPLIT (decomposed, no output) or a
  // FAILED result (no Done-satisfying output to verify). This locks the DONE-only contract
  // the inline fire branch consumes; the after-context build + non-blocking witness behavior
  // are proven in self_witness.mjs's selftests (buildAfterContext + witnessArtifact AFTER).
  ck(shouldWitnessAfter({ ok: true, phase: 'done', steps: [] }) === true, 'AFTER: a DONE mission (ok:true, not split) -> after pass FIRES');
  ck(shouldWitnessAfter({ ok: true, split: true, phase: 'split' }) === false, 'AFTER: a SPLIT mission (ok:true but split) -> after pass does NOT fire (no produced output to verify)');
  ck(shouldWitnessAfter({ ok: false, phase: 'verify' }) === false, 'AFTER: a FAILED mission (ok:false) -> after pass does NOT fire');
  ck(shouldWitnessAfter(null) === false && shouldWitnessAfter(undefined) === false, 'AFTER: a null/undefined result -> after pass does NOT fire (fail-soft)');

  // crash-instrumentation (M-DAEMON-CRASH-HANDLER): registration + logCrash write, then clean removal
  const _beforeUE = process.listeners('uncaughtException').length;
  const _beforeUR = process.listeners('unhandledRejection').length;
  installCrashHandlers();
  ck(process.listeners('uncaughtException').includes(_onUncaught), 'crash: uncaughtException handler registered');
  ck(process.listeners('unhandledRejection').includes(_onUnhandled), 'crash: unhandledRejection handler registered');
  const _cf = path.join(tmp, 'crash.log');
  logCrash('selftest-kind', new Error('boom-42'), _cf);
  const _cw = readFileSync(_cf, 'utf8');
  ck(_cw.includes('boom-42') && _cw.includes('selftest-kind'), 'crash: logCrash writes kind+stack to target file');
  // remove OUR handlers so a later selftest throw doesn't exit(1) via _onUncaught, and prove no leak
  process.removeListener('uncaughtException', _onUncaught);
  process.removeListener('unhandledRejection', _onUnhandled);
  ck(process.listeners('uncaughtException').length === _beforeUE && process.listeners('unhandledRejection').length === _beforeUR, 'crash: handlers cleanly removable (no listener leak)');

  // ---- FIRE-TIME TARTIB GATE (queuedDepsHold — the 3-incident hollow-S2 class) ----
  {
    const ar = 'DONE missions/a.S1.mission.txt  <!-- t -->\nFAILED missions/b.S1.mission.txt  <!-- t -->\n# TOPOLOGY-RESOLVED 2026-07-02 (landed): missions/c.S1.mission.txt\n';
    const okMap = { 'missions/a.S1.mission.txt': true, 'missions/d.S1.mission.txt': false };
    const resOk = (dep) => okMap[dep] === true;
    ck(queuedDepsHold('MISSION-ID: x', 'missions/a.S2.mission.txt', ar, resOk).hold === false, 'tartib-gate: implicit S2 with S1 DONE + ok:true result -> FIRES');
    ck(queuedDepsHold('MISSION-ID: x', 'missions/b.S2.mission.txt', ar, resOk).hold === true, 'tartib-gate: implicit S2 with S1 FAILED -> HELD (the b13-aria class)');
    const dHold = queuedDepsHold('MISSION-ID: x', 'missions/d.S2.mission.txt', 'DONE missions/d.S1.mission.txt\n', resOk);
    ck(dHold.hold === true && /hollow receipt/.test(dHold.why), 'tartib-gate: S1 DONE but result ok:false -> HELD as hollow receipt (the crown-legal class)');
    ck(queuedDepsHold('MISSION-ID: x', 'missions/c.S2.mission.txt', ar, resOk).hold === false, 'tartib-gate: conductor-RESOLVED dependency satisfies');
    ck(queuedDepsHold('REQUIRES: missions/a.S1.mission.txt, missions/b.S1.mission.txt\n', 'missions/z.mission.txt', ar, resOk).hold === true, 'tartib-gate: explicit REQUIRES list — one FAILED dep holds the mission');
    ck(queuedDepsHold('REQUIRES: missions/a.S1.mission.txt\n', 'missions/z.mission.txt', ar, resOk).hold === false, 'tartib-gate: explicit REQUIRES with passing dep fires');
    ck(queuedDepsHold('REQUIRES: none\n', 'missions/z.mission.txt', ar, resOk).hold === false, 'tartib-gate: REQUIRES none fires');
    ck(queuedDepsHold('REQUIRES: search-grounded seats\n', 'missions/z.mission.txt', ar, resOk).hold === false, 'tartib-gate: prose precondition does not mechanically hold');
    const selfRes = queuedDepsHold('MISSION-ID: x', 'missions/c.S1.mission.txt', ar, resOk);
    ck(selfRes.hold === true && selfRes.resolvedSelf === true, 'tartib-gate: a mission ITSELF conductor-RESOLVED never refires (the reload-resurrection loop)');
    // (b2) BARE-STEM form (2026-07-03 minimal pair: reachability fired past a pending dep)
    const arPend = ar + 'missions/e.S1.mission.txt  <!-- pending -->\n';
    ck(queuedDepsHold('REQUIRES: e.S1 (tartib — same-file serialization)\n', 'missions/z.mission.txt', arPend, resOk).hold === true, 'tartib-gate b2: bare-stem REQUIRES with dep merely PENDING -> HELD (today\'s reachability class)');
    ck(queuedDepsHold('REQUIRES: a.S1 (tartib)\n', 'missions/z.mission.txt', ar, resOk).hold === false, 'tartib-gate b2: bare-stem REQUIRES with dep DONE + ok:true -> FIRES');
    ck(queuedDepsHold('REQUIRES: b.S1 (tartib)\n', 'missions/z.mission.txt', ar, resOk).hold === true, 'tartib-gate b2: bare-stem REQUIRES with dep FAILED -> HELD');
    ck(queuedDepsHold('REQUIRES: search-grounded seats always\n', 'missions/z.mission.txt', arPend, resOk).hold === false, 'tartib-gate b2: prose tokens with no matching queue line never become phantom deps');
  }

  // ---- mt-c1-boundary regression pair (ported from conduct-cycle.mjs's closed() selftest):
  // an UNRESOLVED-noted line must NOT satisfy either RESOLVED check (self or dependency);
  // an explicit RESOLVED-noted line still must. Fixture strings are built by runtime
  // concatenation, never typed as a single literal.
  {
    const stem = ['q', 'boundary', 'stem'].join('-');
    const selfPath = 'missions/' + stem + '.mission.txt';
    const unresolvedSelfNote = '# UN' + 'RESOLVED' + ' — still failing, do not treat as landed: ' + selfPath;
    const resolvedSelfNote = '# ' + 'RESOLVED' + ' — landed: ' + selfPath;
    ck(queuedDepsHold('MISSION-ID: x', selfPath, unresolvedSelfNote, () => false).hold === false, 'mt-c1-boundary: an UNRESOLVED-noted comment must NOT satisfy the self-resolved check');
    ck(queuedDepsHold('MISSION-ID: x', selfPath, resolvedSelfNote, () => false).hold === true, 'mt-c1-boundary: an explicit RESOLVED-noted comment still satisfies the self-resolved check');

    const depPath = 'missions/' + stem + '.dep.mission.txt';
    const childPath = 'missions/' + stem + '.child.mission.txt';
    const reqText = 'REQUIRES: ' + depPath + '\n';
    const unresolvedDepNote = '# UN' + 'RESOLVED' + ' — still failing: ' + depPath;
    const resolvedDepNote = '# ' + 'RESOLVED' + ' — landed: ' + depPath;
    ck(queuedDepsHold(reqText, childPath, unresolvedDepNote, () => false).hold === true, 'mt-c1-boundary(dep): an UNRESOLVED-noted dependency comment must NOT satisfy the dependency check — stays held');
    ck(queuedDepsHold(reqText, childPath, resolvedDepNote, () => false).hold === false, 'mt-c1-boundary(dep): an explicit RESOLVED-noted dependency comment satisfies the dependency check');
  }

  // ---- mt-c2a-queueddeps: RESOLVED stamp verification via missionLandedState ----
  {
    const stem2 = ['q', 'stampcheck', 'stem'].join('-');
    const selfPath2 = 'missions/' + stem2 + '.mission.txt';
    const resolvedNote2 = '# ' + 'RESOLVED' + ' — landed: ' + selfPath2;
    const disputedMissionText = [
      'MISSION-ID: x',
      'MISSION-CLASS: code-repo',
      'REPO-ROOT: ' + ['C:', 'fake', 'repo'].join('/'),
      '  - ' + ['some', 'file.mjs'].join('/'),
    ].join('\n');
    const absentGitFn = () => ({ ok: true, out: '' });
    const disputed = queuedDepsHold(disputedMissionText, selfPath2, resolvedNote2, () => false, absentGitFn);
    ck(disputed.hold === false, 'mt-c2a-queueddeps: a RESOLVED stamp disputed by missionLandedState (GENUINE — nothing landed at HEAD) does NOT retire the mission, stays live');

    const plainMissionText = ['MISSION-ID: y', 'Maqsad: ' + ['plain', 'research', 'mission'].join(' ')].join('\n');
    const neverCalledGitFn = () => { throw new Error('gitFn must not be invoked when missionLandedState is undeterminable'); };
    const honored = queuedDepsHold(plainMissionText, selfPath2, resolvedNote2, () => false, neverCalledGitFn);
    ck(honored.hold === true && honored.resolvedSelf === true, 'mt-c2a-queueddeps: a null/undeterminable verdict fails OPEN, stamp honored unchanged (mission retired as before)');
  }

  rmSync(tmp, { recursive: true, force: true });
  console.log(fails === 0 ? '\nALL PASS — daemon queue mechanics sound (incl. Hajj SPLIT status + auto-queue-from-substrate + self-witness AFTER gating + crash instrumentation)' : `\n${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  installCrashHandlers();
  // Catch a rejection of mainLoop's OWN promise explicitly: the loop is dead, so log the
  // stack and exit(1) for a clean supervisor restart (vs. a zombie process kept alive by the
  // unhandledRejection handler). Detached-promise rejections still route to _onUnhandled.
  mainLoop().catch((e) => { logCrash('mainLoop-rejection', e); process.exit(1); });
}
