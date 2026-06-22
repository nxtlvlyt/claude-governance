// deconstructor.mjs — mission -> micro_queue (the micro-queue spine, task #18).
//
// Two parts: (1) the DETERMINISTIC validator a micro_queue must pass — schema + the
// SIZE CEILING (a micro-action touches at most ONE implementation file) + witnessable-deed
// (every step carries a validation_command) + tartib (strict sequential step_index);
// (2) [task #18 cont.] dispatch the Architect seat to PRODUCE the queue from a mission's
// Maqsad + niyyah. The validator is built and tested FIRST — the Architect's output is
// only accepted if it passes this gate (deeds-not-claims applied to decomposition itself).

import { dispatchSeat, recognizeClaudeModel } from './seat_dispatch.mjs';
import { pickArchitects } from './seat_modes.mjs';

// .ps1/.psm1/.sh/.bat added 2026-06-10: get-upgrade FAILED x2 because installer scripts
// weren't "implementation" — the validator's vocabulary was narrower than the work.
// WEB/STATIC/CONFIG extensions added 2026-06-15 (bootstrap hand-apply — the engine could NOT
// edit this 19KB file as a mission across both seats + every failure mode; same class as the
// 2026-06-10 get-upgrade vocab fix above). Static-web deploy missions (muddytires #1) edit
// .html/.json/.md/.toml; the security-gate edits .cmd. Extended IMPL_EXT DIRECTLY (NOT changing
// isImplFile's signature — `.filter(isImplFile)` passes (element,index) and would corrupt an opts arg).
const IMPL_EXT = ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.ps1', '.psm1', '.sh', '.bat', '.cmd', '.html', '.htm', '.css', '.scss', '.json', '.xml', '.svg', '.vue', '.astro', '.md', '.txt', '.toml', '.yaml', '.yml', '.sql'];
const ACTION_TYPES = ['edit', 'command', 'verify'];

const isImplFile = (p) => { const s = String(p).toLowerCase(); return IMPL_EXT.some((e) => s.endsWith(e)); };

// FALSE-GREEN FLOOR (ROADMAP-2026-06-16 #ENGINE-ITEM, d1-1 receipt: 8 steps reported
// ok:true but the remote D1 had num_tables:0 — the phase-3 panel CORRECTLY BLOCKed, but
// only AFTER 8 hollow greens). A step's `ok` is exit-0 of its planner-authored
// validation_command; the engine cannot know whether that command PROVES the real
// outcome — that is semantic, and the phase-3 verdict panel is the right (if slower)
// catch. But ONE class is mechanically catchable at plan-time, cost zero: a step whose
// DESCRIPTION asserts an EXTERNAL/REMOTE outcome ("the table exists on the REMOTE edge",
// "the worker RETURNS GeoJSON", "N rows on the live DB") while its validation_command is
// TRIVIALLY LOCAL — only file/string presence (Test-Path / Get-Item / Select-String
// -Quiet) with NO command that actually reaches the external resource. Such a command can
// only ever witness "a local file exists", never the remote deed it claims. This is the
// narrowest unambiguous slice; the broader "the command must assert COUNT>0" is left to
// the verdict panel + ENGINE-RELIABILITY-DIAGNOSIS.md (cannot be mechanized without
// false-positives on legitimate plans). code-repo only (opts.codeRepo) — research/sandbox
// missions produce LOCAL deliverables where a Test-Path witness is correct by design.
//
// EXTERNAL-OUTCOME signal in the description (the step CLAIMS a remote/network deed):
// NOTE: tokens chosen to avoid FILENAME collisions — a bare 'D1' was removed because it
// matches '.d1.' inside the legitimate local filename 'wrangler.d1.toml' (a local witness
// step). The remaining signals ('remote', 'edge', 'sqlite_master', 'workers.dev', 'responds',
// 'returns json/geojson', 'live db') are strong external-outcome markers that do not collide.
const EXTERNAL_OUTCOME_RE = /\b(remote|edge|live (site|db|database|endpoint)|on the live|landed on the (remote|edge|live)|deployed|published|uploaded|responds?|returns? (geojson|json|\d|the (right|correct|expected)|rows?)|http (status|200)|status 200|reachable|sqlite_master|workers?\.dev|endpoint responds?)\b/i;
// a command that ACTUALLY reaches an external resource (so the witness can prove the deed).
// Each tool must appear as a COMMAND INVOCATION — followed by whitespace then an arg — so a
// FILENAME that merely contains a tool name (e.g. 'wrangler.d1.toml', a Test-Path/Select-String
// argument) does NOT count as reaching the resource. 'wrangler ' (space) matches a real call;
// 'wrangler.' (dot, in the filename) does not. http(s):// URLs also count (a curl/iwr target).
const REACHES_EXTERNAL_RE = /(?:^|[\s;|&(])(wrangler|curl|Invoke-WebRequest|Invoke-RestMethod|iwr|irm|wget|gh|aws|az|gcloud|npx|psql|mysql|sqlite3|ssh|scp|nslookup|Resolve-DnsName|Test-NetConnection|Test-Connection)\s|https?:\/\//i;
// a TRIVIALLY-LOCAL witness: presence checks only, nothing that runs a tool or queries.
// (If the command contains ANY external-reaching verb above, it is NOT trivially local —
// we only flag a command whose ENTIRE proof is local presence.)
const TRIVIAL_LOCAL_WITNESS_RE = /^[\s(]*(Test-Path|Get-Item|Get-ChildItem|gci|Resolve-Path|\[System\.IO\.File\]::Exists)\b|^[\s(]*Select-String\b[^\n]*-Quiet\b/i;
// is the validation_command a pure-local presence witness (no external reach anywhere)?
export function isTriviallyLocalWitness(cmd) {
  const c = String(cmd || '').trim();
  if (!c) return false;
  if (REACHES_EXTERNAL_RE.test(c)) return false;            // reaches a real resource -> not trivial
  // node -c / node -e compile/exec checks, schema applies, etc. are not "presence" — leave them.
  return TRIVIAL_LOCAL_WITNESS_RE.test(c);
}

// PATH CONTAINMENT (sandbox integrity): every step path must be cwd-relative and stay inside
// the mission sandbox. An absolute or traversal path escapes the staging repo — bypassing the
// per-step commit/rollback AND the entire witness chain. Found live: gr10-rebuild canary,
// 2026-06-09 (architect targeted an absolute reference path from the mission context).
const escapesSandbox = (p) => {
  const raw = String(p);
  if (/^([a-zA-Z]:|\/|\\\\)/.test(raw)) return true;             // drive letter, rooted, or UNC
  return raw.replace(/\\/g, '/').split('/').includes('..');       // traversal
};

// Deliverable extensions for RESEARCH-class missions: reports/data ARE the implementation.
const RESEARCH_DELIVERABLE_EXT = ['.md', '.json', '.txt', '.csv'];
const isResearchDeliverable = (p) => { const s = String(p).toLowerCase(); return RESEARCH_DELIVERABLE_EXT.some((e) => s.endsWith(e)); };

// validate ONE micro-action against the architecture's rules (MISSION_ARCHITECTURE.md).
// opts.research: MISSION-CLASS research — (i) .md/.json/.txt/.csv count as THE deliverable
// for 'edit' steps; (ii) absolute paths allowed in context_dependencies ONLY (read-only
// external sources); targets are ALWAYS sandbox-contained, every class.
export function validateMicroAction(step, i, opts = {}) {
  const errs = [];
  if (!step || typeof step !== 'object') return [`step ${i}: not an object`];
  if (typeof step.step_index !== 'number') errs.push(`step ${i}: missing numeric step_index`);
  if (!step.description || typeof step.description !== 'string') errs.push(`step ${i}: missing description`);
  if (!ACTION_TYPES.includes(step.action_type)) errs.push(`step ${i}: action_type must be one of ${ACTION_TYPES.join('|')}`);
  if (!Array.isArray(step.target_files)) errs.push(`step ${i}: target_files must be an array`);
  if (!Array.isArray(step.context_dependencies)) errs.push(`step ${i}: context_dependencies must be an array`);
  // witnessable deed: every step must declare how it will be verified (its receipt command).
  if (!step.validation_command || typeof step.validation_command !== 'string')
    errs.push(`step ${i}: missing validation_command — a deed must be witnessable (deeds-not-claims)`);
  // FALSE-GREEN FLOOR (code-repo only): a step CLAIMING a remote/external outcome must
  // WITNESS it with a command that actually reaches the resource — a pure local Test-Path
  // can only ever prove "a local file exists", never the remote deed it claims (the d1-1
  // hollow-green class). The broader outcome-strength check lives with the verdict panel.
  else if (opts.codeRepo && typeof step.description === 'string'
        && EXTERNAL_OUTCOME_RE.test(step.description)
        && isTriviallyLocalWitness(step.validation_command)) {
    errs.push(`step ${i}: false-green floor — the step description claims an EXTERNAL/REMOTE outcome ("${String(step.description).slice(0, 70)}") but its validation_command is a TRIVIALLY-LOCAL presence check ('${String(step.validation_command).slice(0, 60)}') that proves only a local file exists, not the remote deed. Witness the real outcome (e.g. wrangler d1 execute --remote --command 'SELECT COUNT(*)...' / curl the endpoint / Invoke-RestMethod), not file-existence.`);
  }
  // PATH CONTAINMENT: targets must NEVER escape the sandbox (every mission class).
  for (const p of (step.target_files || [])) {
    if (escapesSandbox(p))
      errs.push(`step ${i}: path containment — target '${p}' is absolute or escapes the mission sandbox; targets must be cwd-relative in every mission class`);
  }
  // Context dependencies: research-class may read absolute external sources (read-only);
  // other classes stay fully contained.
  for (const p of (step.context_dependencies || [])) {
    if (escapesSandbox(p) && !(opts.research && String(p).indexOf('..') === -1))
      errs.push(`step ${i}: path containment — context dep '${p}' escapes the sandbox${opts.research ? " (traversal '..' is banned even in research class)" : ' (absolute context deps are allowed only in MISSION-CLASS: research)'}`);
  }
  // READ-ONLY CONVENTION: reference/ holds pre-placed mission inputs — never a write target.
  for (const p of (step.target_files || [])) {
    if (/^reference[\\/]/i.test(String(p)))
      errs.push(`step ${i}: '${p}' is under reference/ — read-only by sandbox convention, never a target`);
  }
  // SIZE CEILING (capacity / Q2:286): a micro-action touches AT MOST ONE implementation file.
  // Research class: a single .md/.json/.txt/.csv deliverable satisfies the 'edit' rule —
  // reports and data files ARE that class's implementation (agy-import x2 failure receipt).
  const implTargets = (step.target_files || []).filter(isImplFile);
  const deliverables = opts.research ? (step.target_files || []).filter(isResearchDeliverable) : [];
  if (step.action_type === 'edit' && implTargets.length !== 1 && !(opts.research && implTargets.length === 0 && deliverables.length === 1))
    errs.push(`step ${i}: an 'edit' micro-action must touch EXACTLY 1 ${opts.research ? 'implementation-or-deliverable' : 'implementation'} file (found impl:${implTargets.length}${opts.research ? `, deliverable:${deliverables.length}` : ''}) — split it`);
  else if (implTargets.length > 1)
    errs.push(`step ${i}: size ceiling — at most 1 implementation file per micro-action (found ${implTargets.length}: ${implTargets.join(', ')})`);
  return errs;
}

// validate a whole micro_queue. Returns { ok, errors }. opts.research per mission class.
export function validateMicroQueue(queue, opts = {}) {
  const errors = [];
  if (!queue || typeof queue !== 'object') return { ok: false, errors: ['queue is not an object'] };
  if (!queue.mission_id) errors.push('missing mission_id');
  if (!Array.isArray(queue.steps) || queue.steps.length === 0) errors.push('steps must be a non-empty array');
  (queue.steps || []).forEach((s, i) => {
    errors.push(...validateMicroAction(s, i, opts));   // opts carries { research?, codeRepo? }
    // tartib — strict sequential order, 1..n
    if (s && s.step_index !== i + 1)
      errors.push(`step ${i}: step_index ${s?.step_index} out of order (expected ${i + 1}) — tartib requires sequence`);
  });
  // ONE TARGET, ONE WRITER — enforced in CODE (2026-06-10: the PROMPT version of this
  // rule was ignored in 3 identical kills — m28's final step re-emitted a file an earlier
  // step wrote and dropped its assertion lines; the integrity guard caught it every time,
  // AFTER paying for the work. The validator rejects the plan BEFORE any seat runs, and
  // its error feeds the repair loop, which the planner cannot ignore.)
  // Only steps that actually WRITE count as writers: 'edit' (executor authors the file) and
  // 'command' (engine-exec may create it). A 'verify' step that lists the deliverable in
  // target_files is CHECKING it, not writing it (receipt 2026-06-11: a legit plan = author
  // step 1 + verify step 2, both naming the card; the over-broad first version rejected it).
  const writers = new Map();
  (queue.steps || []).forEach((s) => {
    if (s?.action_type !== 'edit' && s?.action_type !== 'command') return;  // verify steps don't write
    for (const t of (s?.target_files || [])) {
      const key = String(t).toLowerCase().replace(/\\/g, '/');
      if (writers.has(key))
        errors.push(`one-writer: '${t}' is written by BOTH step ${writers.get(key)} and step ${s.step_index} — a file has exactly one authoring (edit/command) step; later steps may only READ it (list it in context_dependencies, action_type 'verify')`);
      else writers.set(key, s.step_index);
    }
  });
  return { ok: errors.length === 0, errors };
}

// --- the PRODUCING half of #18: dispatch the Architect to PRODUCE a micro_queue, gated by validateMicroQueue.
const QUEUE_INSTRUCTION = `Decompose the MISSION below into a micro_queue. Output ONLY one json code block, nothing else:
{"mission_id":"<id>","steps":[{"step_index":1,"description":"...","action_type":"edit|command|verify","target_files":["path"],"context_dependencies":["path"],"validation_command":"how this step is witnessed (e.g. node -c <file> or a test command)"}]}
HARD RULES: step_index sequential from 1; each step is EXACTLY ONE of {edit ONE implementation file | run ONE command | ONE verification}; an 'edit' step touches EXACTLY ONE implementation file (split if more); EVERY step needs a validation_command (a deed must be witnessable); ALL paths cwd-RELATIVE — never absolute, never containing '..' (absolute paths mentioned in the mission are read-only references, NOT targets); the reference/ directory is READ-ONLY — read it via context_dependencies, never write to it. State what each step achieves; smaller and verifiable beats fewer and large.
APPEND/MODIFY RULE: any step that MODIFIES or APPENDS to a file an earlier step created MUST list that same file in its context_dependencies — the executor emits FULL file contents and regenerates from scratch without it, silently dropping earlier lines (integrity-guard WEAKENED-VERIFICATION receipt, m28 2026-06-10).
SINGLE-EMISSION RULE for SINGLE-SUBJECT research deliverables: a .md/.json deliverable about ONE subject is emitted COMPLETE in ONE step (full content, all required sections) — NEVER built by appending across steps (receipt: 4 thin-card failures, verdict BLOCK 2026-06-10). Preceding steps may gather inputs into separate files the emission step lists as context_dependencies. For MULTI-SUBJECT deliverables the SIZE/SCOPE RULE below TAKES PRECEDENCE: each part-file is itself emitted complete-in-one-step (so both rules hold at the part level).
VALIDATION COMMANDS run under PowerShell (pwsh) on Windows and MUST be STATELESS single expressions — no PowerShell variables ($x), no session state, no multi-statement pipelines that define-then-use (receipt: $-stripped command ParserError killed a mission 2026-06-10). Good shapes: node -c <file> · Test-Path <file> · Select-String -Path <file> -Pattern '<regex>' -Quiet · (Get-Item <file>).Length -gt 1000.
POSITIVE-ASSERTION HARD RULE (false-green, d1-1 receipt: 8 steps exited 0 while the remote DB had 0 tables — step 8 printed True on a 0-row query): a validation_command MUST exit NON-ZERO when the real outcome is ABSENT. A witness that prints True / exits 0 on an EMPTY or ZERO-ROW result is a HOLLOW witness and is FORBIDDEN — it proves the command RAN, not that the deed HAPPENED. Most tools (wrangler, curl, psql, gh) exit 0 when the QUERY/REQUEST succeeds regardless of whether anything was found, so you must wrap the witness to ASSERT the positive outcome and FAIL when it is absent. Concrete positive-assertion shapes:
  · remote row-count: wrangler d1 execute <db> --remote --json --command "SELECT COUNT(*) AS n FROM <table>" piped/wrapped so it exits 1 if n==0 — e.g. wrap as "$o = wrangler d1 execute <db> --remote --json --command 'SELECT COUNT(*) AS n FROM <table>' | ConvertFrom-Json; if (-not ($o.result.results[0].n -gt 0)) { exit 1 }" (but recall the STATELESS rule above — if a $-bearing assertion is needed, the engine permits it ONLY when it is the COMPLETE single witness expression, not a define-then-use pipeline that strips);
  · http endpoint: "$r = Invoke-WebRequest -Uri <url> -UseBasicParsing; if ($r.StatusCode -ne 200 -or -not $r.Content) { exit 1 }" — assert BOTH status 200 AND a non-empty body, fail otherwise;
  · presence-of-text-in-output: pipe the tool output to Select-String -Pattern '<the expected value>' -Quiet (which exits non-zero when the pattern is absent), NOT a query that returns a boolean True regardless.
Re-state: the witness must FAIL (non-zero exit) when the outcome is absent. Exit 0 on an empty/zero-row/missing result is a HOLLOW witness and is forbidden.
COMMAND/VERIFY STEPS ARE ENGINE-EXECUTED: for action_type 'command' or 'verify', the engine runs validation_command ITSELF (pwsh, cwd = sandbox) — no model is dispatched. So the validation_command IS the step: put the COMPLETE working command there. USE 'command' steps for gathering — fetching a URL into the sandbox (Invoke-WebRequest -Uri <url> -OutFile <file> -UseBasicParsing), listing a directory into a file, copying a read-only reference in. NEVER assign gathering/fetching/listing to an 'edit' step — executor seats can only emit text and CANNOT run commands; every such plan dies witness-rejected (7 missions, 2026-06-10). 'edit' steps are ONLY for content a model must author. Subdirectory targets need a preceding 'command' step that creates the directory (New-Item -ItemType Directory -Force <dir>).
SIZE/SCOPE RULE (receipt: one mission died 6 cycles, 2026-06-10): a deliverable covering MORE THAN ONE analysis subject, or demanding >5 evidence-cited sections, CANNOT be one 'edit' emission — the witness rigor bar exceeds single-emission capability. Plan it as SEPARATE PART-FILE emissions (one subject/section-group per 'edit' step, each its own file) followed by ONE final assembly emission that lists every part-file in context_dependencies. If even the parts exceed ~3 such steps, say so in step 1's description: the mission needs splitting upstream. ONE TARGET, ONE WRITER: no two steps may write the same file (receipt: re-emission dropped earlier lines, integrity-blocked twice 2026-06-10).`;

function extractQueue(text) {
  const t = String(text || '');
  const m = t.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  let raw = m ? m[1] : null;
  if (!raw) { const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i >= 0 && j > i) raw = t.slice(i, j + 1); }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// detect MISSION-CLASS: research once (shared by deconstruct + the panel integrator).
const isResearchMission = (mission) => /MISSION-CLASS:\s*research/i.test(String(mission));
// detect MISSION-CLASS: code-repo (carries the false-green floor: a remote-claiming step
// must reach the resource, not Test-Path a local file). Shared by both planner paths.
const isCodeRepoMission = (mission) => /MISSION-CLASS:\s*code-repo/i.test(String(mission));
const codeRepoNoteFor = (codeRepo) => codeRepo
  ? `\nCODE-REPO VALIDATION-COMMAND RULE (false-green floor, d1-1 receipt): a step that CLAIMS an EXTERNAL/REMOTE outcome (a remote DB has the table/rows, a worker RESPONDS, an endpoint RETURNS) MUST witness it with a command that actually REACHES the resource (wrangler d1 execute --remote --command 'SELECT COUNT(*)...', curl/Invoke-RestMethod the URL, gh/aws/az status) — NEVER a bare Test-Path/Get-Item on a local file, which proves only that a local file exists, not that the remote deed happened. File-existence is a valid witness ONLY for steps whose outcome IS a local file.
POSITIVE-ASSERTION HARD RULE: reaching the resource is NOT enough — the witness MUST EXIT NON-ZERO WHEN THE OUTCOME IS ABSENT. wrangler/curl/psql/gh all exit 0 when the query/request SUCCEEDS regardless of row count, so a command like wrangler ... --command "SELECT name FROM sqlite_master WHERE name='pois'" prints True / exits 0 EVEN WHEN ZERO ROWS COME BACK (the exact d1-1 step-8 hollow green). A witness that prints True / exits 0 on an EMPTY or ZERO-ROW result is a HOLLOW witness and is FORBIDDEN. Assert the positive outcome and fail when it is absent: e.g. wrangler d1 execute <db> --remote --json --command "SELECT COUNT(*) AS n FROM <table>" wrapped so it exits 1 when n==0; or "$r = Invoke-WebRequest -Uri <url> -UseBasicParsing; if ($r.StatusCode -ne 200 -or -not $r.Content) { exit 1 }"; or pipe the tool output to Select-String -Pattern '<expected value>' -Quiet so it exits non-zero when the value is absent.`
  : '';
const researchNoteFor = (research) => research
  ? `\nRESEARCH MISSION RULES: deliverables are .md/.json/.txt/.csv files (an 'edit' step targets exactly ONE of them); external source files may be listed in context_dependencies as ABSOLUTE paths (read-only) — targets must still be cwd-relative.`
  : '';

// runQueueLoop — the SHARED queue-emission + validate + repair primitive (extracted 2026-06-15
// for the blind panel so deconstruct() AND the panel's integrator reuse the EXACT same
// validateMicroQueue gate + repair framing). Dispatches `seat` with `baseFraming` as the first
// user message; on a validation failure it re-dispatches with the errors appended, up to
// maxRepairs. diagDir/diagTag persist the raw seat output of each failed attempt. dispatchFn is
// injectable (default dispatchSeat) so the panel is offline-testable without real dispatch.
async function runQueueLoop(seat, baseFraming, { research = false, codeRepo = false, maxRepairs = 2, diagDir = null, diagTag = 'plan', dispatchFn = dispatchSeat } = {}) {
  let framing = baseFraming;
  let lastErrors = ['no attempt made'];
  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const r = await dispatchFn(seat, framing, { wantVerdict: false });
    const queue = extractQueue(r?.content);
    const v = queue ? validateMicroQueue(queue, { research, codeRepo }) : { ok: false, errors: ['no valid JSON micro_queue in the seat output'] };
    if (v.ok) return { ok: true, queue, attempts: attempt + 1, _model: seat.model, _provider: r?.provider };
    // DIAGNOSIS RECEIPT: persist the raw seat output on every failed attempt — a failed
    // plan with discarded output forces guessing (found live: P0-CORPUS x2, undiagnosable).
    if (diagDir) {
      try {
        const fs = await import('fs');
        fs.mkdirSync(diagDir, { recursive: true });
        fs.writeFileSync(`${diagDir}/${diagTag}-attempt-${attempt + 1}.raw.txt`,
          `provider: ${r?.provider ?? 'unknown'}  heals: ${r?.heals ?? '?'}  cloudError: ${r?.cloudError ?? ''}\n--- raw content ---\n${String(r?.content ?? '(empty)')}`, 'utf8');
      } catch { /* diagnosis must never break the run */ }
    }
    lastErrors = v.errors;
    framing = `${baseFraming}\n\nYour previous micro_queue FAILED validation:\n- ${lastErrors.join('\n- ')}\nFix ALL of these and output a corrected micro_queue. REMINDER: every edit step MUST list exactly ONE cwd-relative target file in target_files — a judge/audit/research step targets the .md it produces.`;
  }
  return { ok: false, errors: lastErrors, attempts: maxRepairs + 1 };
}

// deconstruct(mission, opts) -> { ok, queue?, errors?, attempts }. Dispatches the Architect, validates against
// validateMicroQueue, and re-dispatches with the errors (repair loop) up to maxRepairs. Deeds-not-claims for decomposition.
// PRESERVED AS THE FALLBACK + the panel's per-seat primitive (the blind panel's deconstructPanel
// is the default planner in orchestrate; this single-architect path is what it falls back to).
export async function deconstruct(mission, { model = 'kimi-k2.6', today = '2026-06-09', maxRepairs = 2, diagDir = null, dispatchFn = dispatchSeat } = {}) {
  // max_tokens 32768: kimi reasons 40-70K chars (~10-18K tokens) before answering and
  // ignores think:false on v1 — 8192 starved content on attempt 1 every time (the
  // EMPTY_CONTENT_THINKING burn class; the heal's 16384 sometimes still clipped).
  const seat = { role: 'architect', model, today, max_tokens: 32768, sampling: { temperature: 0.7, top_p: 0.9 } };
  // MISSION-CLASS: research → md/json deliverables count as the edit target; absolute
  // paths allowed in context_dependencies (read-only). Declared in the mission text.
  const research = isResearchMission(mission);
  const codeRepo = isCodeRepoMission(mission);
  const baseFraming = `${QUEUE_INSTRUCTION}${researchNoteFor(research)}${codeRepoNoteFor(codeRepo)}\n\nMISSION:\n${mission}`;
  return runQueueLoop(seat, baseFraming, { research, codeRepo, maxRepairs, diagDir, diagTag: 'plan', dispatchFn });
}

// ----------------------------------------------------------------------- PHASE 1 BLIND PANEL
// deconstructPanel — the operator's locked Phase-1 design (SEAT-PLAN-OPERATOR-ORIGINAL.md):
// THREE EQUAL, BLIND architects plan INDEPENDENTLY (no seat reads another's output —
// blindness is STRUCTURAL: each gets the SAME byte-identical mission framing and nothing
// more), then an OPUS INTEGRATOR (route maps nemotron-3-ultra -> opus-first) synthesizes the
// three plans into ONE micro_queue, run through the EXISTING extractQueue + validateMicroQueue
// + repair loop UNCHANGED. The synthesis is where three independent reads catch what one misses.
//
// Seats (operator ruling 2026-06-10/-14): A=kimi-k2.6, B=deepseek-v4-pro, C=minimax-m3
// (Ollama-first per muezzin-route.json; Claude-tier outage panel opus/sonnet/haiku handled
// transparently by seat_dispatch's CLAUDE_SEAT_MAP — the panel names the cloud-primary seat
// and the dispatch waterfall picks the fallback). Integrator primary model = nemotron-3-ultra
// so the route's Opus-first window carries it (CLAUDE_SEAT_MAP['nemotron-3-ultra']='sonnet'
// today; Opus is the operator's integrator intent via the route/seat policy, not hardcoded here).
//
// GR10 (no two LOCAL models at once): architects are authored SERIALLY (the lower-risk choice
// per the mission spec — a cloud-parallel fan-out could fall to LOCAL concurrently on an
// outage, the GR10 + scheduler-deadlock class). Cloud-serial costs latency, not correctness.
//
// FAIL-CLOSED SEARCH: every architect must be search-grounded (the systemAnchor mandate). If
// FEWER THAN 2 of 3 architects are grounded, the panel HOLDS the mission (ok:false, named
// reason) rather than synthesize from training memory. groundedFn is injectable; the default
// inspects the dispatch result's tool trace for an actual search call.
//
// FALLBACK (hard safety rail): if fewer than 2 architects produce a usable plan, or the
// integrator cannot emit a valid queue, deconstructPanel falls back to the single-architect
// deconstruct() so the engine never hard-breaks. Disable the panel entirely with the
// `panel:false` opt (or MUEZZIN_PANEL=off) — then deconstructPanel IS deconstruct().
export const PANEL_ARCHITECTS = ['kimi-k2.6', 'deepseek-v4-pro', 'minimax-m3'];
export const PANEL_INTEGRATOR_MODEL = 'nemotron-3-ultra';

// --------------------------------------------------------------- PER-MISSION ARCHITECT ROUTING
// chooseArchitectRoute(missionText, opts) -> 'single' | 'panel'. The PLAN-PHASE COST FIX
// (ROADMAP-2026-06-16 P1 #1, from d1-1's block): the 3-blind SERIAL panel cost ~20min and
// d1-1 — a simple 5-file additive code-repo build — NEVER planned. Simple missions don't need
// three independent reads + an integrator; they get the fast single architect (deconstruct()).
// HIGH-STAKES / COMPLEX missions STILL get the panel (the operator's locked Phase-1 design,
// SEAT-PLAN-OPERATOR-ORIGINAL.md — this ADDS routing, it does NOT delete the panel).
//
// THE HEURISTIC (conservative — when UNSURE, panel; never downgrade a mission that needs scrutiny):
//   PANEL (complex / high-stakes) when ANY of:
//     - an EXPLICIT panel marker in the mission text: "TIER: HAJJ", "PANEL: required",
//       "complex", "high-stakes", "build-program", "build program" (the architect's / operator's
//       own escalation — declared structure wins, same precedence as mission_split's stage markers);
//     - the mission is LARGE: a code-repo whose ALLOW-FILES list exceeds the routing file-cap
//       (default 6 — comfortably above d1-1's 5, below a sprawling build), since many writable
//       files signals a multi-part build the three reads should scrutinize;
//   SINGLE (simple / fast) otherwise — the clearly-simple classes:
//     - MISSION-CLASS research, command, or authoring;
//     - code-repo with a SMALL ALLOW-FILES (<= the file-cap) and no panel marker;
//     - any mission with no panel marker that is not large.
// TUNABLE / OVERRIDABLE: opts.route ('single'|'panel') or MUEZZIN_ARCHITECT_ROUTE env force a
// route outright; opts.fileCap / MUEZZIN_ROUTE_FILECAP tune the code-repo size boundary. A
// forced 'panel' can never be downgraded; a forced 'single' is the operator's explicit choice.
const PANEL_MARKER_RE = /\bTIER:\s*HAJJ\b|\bPANEL:\s*required\b|\bhigh-?stakes\b|\bbuild[ -]program\b|\bcomplex\b/i;
// count a code-repo mission's declared writable files (ALLOW-FILES: a, b, c  OR a bulleted block).
function countAllowFiles(missionText) {
  const t = String(missionText || '');
  // match the header to END OF ITS OWN LINE ([^\n] — NOT \s, which would eat the newline and
  // pull a following bullet line into the "inline" capture, miscounting a bulleted block).
  const m = t.match(/^ALLOW-FILES:[ \t]*([^\n\r]*)/mi);
  if (!m) return 0;
  // inline comma/space list on the same line (d1-1's shape): "ALLOW-FILES: a, b, c"
  const inline = m[1].split('#')[0].trim();
  if (inline) return inline.split(/[,\s]+/).filter(Boolean).length;
  // bulleted block beneath the header: subsequent "  - file" lines until a non-bullet line.
  const after = t.slice(m.index + m[0].length);
  const bullets = after.split(/\r?\n/);
  let n = 0;
  for (const line of bullets) {
    if (/^\s*-\s+\S/.test(line)) n++;
    else if (line.trim() === '' || /^\s*#/.test(line)) continue;   // blank / comment lines don't end the block
    else break;
  }
  return n;
}
export function chooseArchitectRoute(missionText, opts = {}) {
  // 1. EXPLICIT override (opt or env) — operator/test forces the route; forced 'panel' is never downgraded.
  const forced = opts.route || (process.env.MUEZZIN_ARCHITECT_ROUTE || '').toLowerCase();
  if (forced === 'single' || forced === 'panel') return forced;
  // 2. DEFAULT -> PANEL (always). The operator's locked spec (SEAT-PLAN-OPERATOR-ORIGINAL.md)
  //    requires Phase-1 planning to ALWAYS be 3 blind architects. The single-architect route was
  //    a spec violation (removed 2026-06-16); only an EXPLICIT override above may force 'single'.
  return 'panel';
}

// CLOUD-PARALLEL-SAFE seat classifier (GR10 — never two LOCAL models at once). A seat is
// parallel-safe ONLY when it dispatches to a CLOUD provider that can never collide on the 4090:
//   - a Claude family name (opus/sonnet/haiku/claude-*) -> the Claude tier, cloud;
//   - a known OLLAMA-CLOUD model (the cloud labs the panel seats by default: kimi/deepseek/
//     minimax/glm/nemotron-3-ultra) -> ollama-cloud, GPU-free/parallel-safe per the cloud waterfall.
// Anything ELSE — a bare local tag (qwen3.6:27b, granite4.1:30b, the local-heavy architects) or
// an unrecognized name — is treated as LOCAL/UNKNOWN -> NOT parallel-safe (the conservative rail:
// "if uncertain, stay serial"). The default PANEL_ARCHITECTS (kimi/deepseek/minimax) are all cloud,
// so the common path parallelizes; local-heavy mode stays serial; the Claude outage panel parallelizes.
const CLOUD_OLLAMA_MODELS = new Set(['kimi-k2.6', 'deepseek-v4-pro', 'minimax-m3', 'glm-5.1', 'nemotron-3-ultra']);
export function isCloudParallelSafe(model) {
  if (recognizeClaudeModel(model)) return true;            // Claude tier -> cloud
  return CLOUD_OLLAMA_MODELS.has(String(model || ''));     // known ollama-cloud labs -> cloud; else local/unknown -> serial
}

// default grounding detector: did the seat actually search? Inspect the dispatch result for a
// tool-trace entry that is a web/SearXNG search. (dispatchSeat's non-verdict return does not
// surface toolTrace today, so a real run treats grounding as UNKNOWN -> grounded:true unless a
// trace is present and shows NO search; tests inject results carrying _tools/toolTrace to
// exercise the fail-closed path deterministically. A future one-line seat_dispatch change to
// surface toolTrace on non-verdict returns upgrades this to strict observed grounding.)
const SEARCH_TOOLS = new Set(['searxng_web_search', 'WebSearch', 'web_search']);
export function defaultGroundedFn(result) {
  const trace = result?._tools || result?.toolTrace;
  if (!Array.isArray(trace)) return true;                 // no trace surfaced -> cannot disprove grounding
  return trace.some((t) => SEARCH_TOOLS.has(t?.tool));
}

export async function deconstructPanel(mission, {
  today = new Date().toISOString().slice(0, 10), maxRepairs = 2, diagDir = null,
  architects: architectsArg, integratorModel: integratorModelArg,
  panel = process.env.MUEZZIN_PANEL !== 'off', dispatchFn = dispatchSeat, groundedFn = defaultGroundedFn,
  deconstructFn = deconstruct, route: routeArg,
} = {}) {
  // SEATING MODE (seating-modes build, 2026-06-15): the active mode remaps WHICH models fill
  // the 3 blind architect seats + the integrator. An EXPLICIT caller/test arg always wins;
  // absent that, pickArchitects returns the active mode's seats, or — when no mode is set —
  // the today-default PANEL_ARCHITECTS / PANEL_INTEGRATOR_MODEL (safe default, byte-for-byte).
  // Only the model NAMES change here; the blind-serial panel LOGIC below is untouched.
  const picked = pickArchitects(PANEL_ARCHITECTS, PANEL_INTEGRATOR_MODEL);
  const architects = architectsArg ?? picked.architects;
  const integratorModel = integratorModelArg ?? picked.integrator;
  const research = isResearchMission(mission);
  const codeRepo = isCodeRepoMission(mission);
  // FLAG OFF -> the panel IS the single architect (the fallback path, made explicit).
  if (!panel) return deconstructFn(mission, { today, maxRepairs, diagDir, dispatchFn });

  // PER-MISSION ROUTING (P1 #1, plan-phase cost fix): a SIMPLE mission skips the 3-blind
  // panel entirely and gets the fast single architect (deconstruct). A COMPLEX/high-stakes
  // mission keeps the panel (the operator's locked design). The chooser is conservative —
  // unsure => panel. Caller/test may force via opts.route ('single'|'panel') / MUEZZIN_ARCHITECT_ROUTE.
  const route = chooseArchitectRoute(mission, { route: routeArg });
  if (route === 'single') {
    const r = await deconstructFn(mission, { today, maxRepairs, diagDir, dispatchFn });
    return { ...r, _panel: false, _route: 'single' };
  }

  const fallback = async (reason) => {
    const r = await deconstructFn(mission, { today, maxRepairs, diagDir, dispatchFn });
    return { ...r, _panel: false, _fallback: reason };
  };

  // ---- (1) THREE BLIND ARCHITECTS — BYTE-IDENTICAL framing, authored SERIALLY (GR10).
  // The framing asks for a PLAN NARRATIVE (the decomposition reasoning), NOT the final json
  // queue — the queue is emitted ONCE, by the integrator, so there is a single validated
  // artifact. Blindness is structural: archFraming depends ONLY on `mission`, never on any
  // peer's output, and every architect receives the IDENTICAL string.
  const archFraming =
    `You are ONE of THREE INDEPENDENT architects planning the SAME mission BLIND — you do NOT see the other architects' work, and they do not see yours. Independence is the design.\n` +
    `Produce a PLAN NARRATIVE: the ordered steps you would decompose this mission into, each as a short line stating WHAT the step does, its action_type (edit ONE impl file | command | verify), its single target file (cwd-relative), and how it is witnessed (a validation_command). Do NOT emit the final json queue — a separate integrator will synthesize the three narratives into the validated queue.\n` +
    `Ground every SOTA / current-fact claim in live search (the systemAnchor mandate).${researchNoteFor(research)}\n\nMISSION:\n${mission}`;

  // dispatch ONE architect + persist its diagnostic. Pure of ordering — the caller decides
  // serial-vs-parallel; this just runs the seat and returns its result.
  const dispatchArchitect = async (model) => {
    const seat = { role: 'architect', model, today, max_tokens: 32768, sampling: { temperature: 0.7, top_p: 0.9 } };
    let r;
    try { r = await dispatchFn(seat, archFraming, { wantVerdict: false }); }
    catch (e) { r = { content: '', _failed: true, _error: String(e?.message || e) }; }
    const content = String(r?.content || '').trim();
    if (diagDir) {
      try {
        const fs = await import('fs');
        fs.mkdirSync(diagDir, { recursive: true });
        fs.writeFileSync(`${diagDir}/panel-architect-${model.replace(/[^\w.-]/g, '_')}.raw.txt`,
          `model: ${model}  provider: ${r?.provider ?? 'unknown'}  grounded: ${groundedFn(r)}\n--- raw narrative ---\n${content || '(empty)'}`, 'utf8');
      } catch { /* diagnosis must never break the run */ }
    }
    return { model, content, grounded: !!(content && groundedFn(r)) };
  };

  // PARALLELIZATION (P1 #2): when ALL three architect seats are CLOUD/Claude (parallel-safe —
  // never collide on the 4090), dispatch them CONCURRENTLY so wall-clock = the slowest single
  // architect (~5min), not the serial sum (~15min). GR10 (no two LOCAL models at once): if ANY
  // architect resolves to a LOCAL/unknown seat, stay SERIAL (the safe rail; uncertain => serial).
  const allCloud = architects.every(isCloudParallelSafe);
  let results;
  if (allCloud) {
    results = await Promise.all(architects.map(dispatchArchitect));
  } else {
    results = [];
    for (const model of architects) results.push(await dispatchArchitect(model));   // GR10: serial when any local
  }

  const plans = [];
  let grounded = 0;
  for (const res of results) {
    if (res.content) {
      plans.push({ model: res.model, narrative: res.content });
      if (res.grounded) grounded++;
    }
  }

  // ---- (2) FAIL-CLOSED gates.
  // <2 usable plans -> the panel cannot synthesize independence; fall back to single architect.
  if (plans.length < 2) return fallback(`only ${plans.length}/3 architects produced a usable plan`);
  // <2 of 3 SEARCH-GROUNDED -> HOLD the mission (do NOT plan from training memory; spec gate).
  if (grounded < 2) return { ok: false, errors: [`fail-closed search: only ${grounded}/${plans.length} architects were search-grounded (need >=2) — mission HELD rather than planned from stale training memory`], attempts: plans.length, _panel: true, _grounded: grounded };

  // ---- (3) OPUS INTEGRATOR synthesizes the three blind plans into ONE validated micro_queue,
  // through the EXISTING extractQueue + validateMicroQueue + repair loop (runQueueLoop), with
  // the research/code-repo opts threaded exactly as deconstruct() does.
  const planBlock = plans.map((p, i) => `--- ARCHITECT ${i + 1} (${p.model}) PLAN ---\n${p.narrative}\n--- END ARCHITECT ${i + 1} ---`).join('\n\n');
  const integratorFraming =
    `${QUEUE_INSTRUCTION}${researchNoteFor(research)}${codeRepoNoteFor(codeRepo)}\n\n` +
    `You are the INTEGRATOR. Below are ${plans.length} INDEPENDENT, BLIND architect plans for the SAME mission. ` +
    `Synthesize them into ONE micro_queue: take the best decomposition, reconcile overlaps, keep steps the independent reads AGREE on, and DROP any step that is fabricated, contradictory, or unsupported by the mission. ` +
    `The three reads exist to catch what one misses — prefer the safest, most-verifiable decomposition. Output ONLY the final json micro_queue.\n\n` +
    `MISSION:\n${mission}\n\n${planBlock}`;
  const integSeat = { role: 'integrator', model: integratorModel, today, max_tokens: 32768, sampling: { temperature: 0.3, top_p: 0.9 } };
  const synth = await runQueueLoop(integSeat, integratorFraming, { research, codeRepo, maxRepairs, diagDir, diagTag: 'integrator', dispatchFn });
  if (synth.ok) return { ...synth, _panel: true, _architects: plans.map((p) => p.model), _grounded: grounded };
  // integrator could not emit a valid queue -> fall back to the single architect (never hard-break).
  return fallback(`integrator failed to synthesize a valid queue (${(synth.errors || []).join('; ').slice(0, 200)})`);
}

// --------------------------------------------------------------------------- self-test
if (process.argv[1]?.endsWith('deconstructor.mjs')) {
  if (process.argv.includes('--live')) {
    const mission = `Niyyah: give the bakery owner a cost number per recipe they can trust.
Maqsad: a working cost calculator that, given a recipe, returns total production cost.
Context: Node + TypeScript project; DB schema in prisma/schema.prisma; tests run with \`node --test\`.`;
    const r = await deconstruct(mission, { model: 'kimi-k2.6', today: '2026-06-09' });
    console.log(JSON.stringify(r, null, 2));
    console.log(r.ok
      ? `\nLIVE OK — architect produced a VALID micro_queue: ${r.queue.steps.length} steps in ${r.attempts} attempt(s)`
      : `\nLIVE FAIL after ${r.attempts} attempts — ${(r.errors || []).join('; ')}`);
    process.exit(r.ok ? 0 : 1);
  }
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

  ck(validateMicroQueue({ mission_id: 'M-X', steps: [
    { step_index: 1, description: 'write cost calc', action_type: 'edit', target_files: ['src/cost.ts'], context_dependencies: [], validation_command: 'node -c src/cost.ts' },
    { step_index: 2, description: 'run the test', action_type: 'verify', target_files: [], context_dependencies: ['src/cost.ts'], validation_command: 'node test/cost.test.mjs' },
  ] }).ok, 'well-formed micro_queue passes');

  ck(!validateMicroQueue({ mission_id: 'M-X', steps: [
    { step_index: 1, description: 'edit two files', action_type: 'edit', target_files: ['a.ts', 'b.ts'], context_dependencies: [], validation_command: 'node -c a.ts' },
  ] }).ok, 'size ceiling: a step touching 2 impl files is REJECTED (split it)');

  ck(!validateMicroQueue({ mission_id: 'M-X', steps: [
    { step_index: 1, description: 'edit', action_type: 'edit', target_files: ['a.ts'], context_dependencies: [], validation_command: '' },
  ] }).ok, 'un-witnessable deed (no validation_command) is REJECTED');

  ck(!validateMicroQueue({ mission_id: 'M-X', steps: [
    { step_index: 5, description: 'edit', action_type: 'edit', target_files: ['a.ts'], context_dependencies: [], validation_command: 'node -c a.ts' },
  ] }).ok, 'out-of-order step_index is REJECTED (tartib)');

  ck(!validateMicroQueue({ mission_id: 'M-X', steps: [] }).ok, 'empty queue is REJECTED');

  ck(!validateMicroQueue({ mission_id: 'M-X', steps: [
    { step_index: 1, description: 'edit', action_type: 'edit', target_files: ['C:\\Users\\x\\hooks\\a.mjs'], context_dependencies: [], validation_command: 'node -c a.mjs' },
  ] }).ok, 'ABSOLUTE target path is REJECTED (sandbox containment)');

  ck(!validateMicroQueue({ mission_id: 'M-X', steps: [
    { step_index: 1, description: 'edit', action_type: 'edit', target_files: ['../escape.mjs'], context_dependencies: [], validation_command: 'node -c x' },
  ] }).ok, 'traversal (../) target path is REJECTED (sandbox containment)');

  // RESEARCH CLASS: md deliverable + absolute read-only context dep both pass; same step
  // WITHOUT the research flag still fails (regression guard both directions).
  const researchStep = { mission_id: 'M-R', steps: [
    { step_index: 1, description: 'write the verdict table', action_type: 'edit', target_files: ['verdict-table.md'], context_dependencies: ['C:\\Users\\x\\.agents\\MISSIONS.md'], validation_command: 'node -e "require(\'fs\').accessSync(\'verdict-table.md\')"' },
  ] };
  ck(validateMicroQueue(researchStep, { research: true }).ok, 'research class: .md deliverable + absolute context dep PASS');
  ck(!validateMicroQueue(researchStep).ok, 'same step WITHOUT research class is REJECTED');
  ck(!validateMicroQueue({ mission_id: 'M-R', steps: [
    { step_index: 1, description: 'edit', action_type: 'edit', target_files: ['C:\\evil\\out.md'], context_dependencies: [], validation_command: 'x' },
  ] }, { research: true }).ok, 'research class: ABSOLUTE TARGET still REJECTED (targets contained in every class)');

  // ----------------------------------------------- FALSE-GREEN FLOOR (code-repo, d1-1 receipt)
  // isTriviallyLocalWitness — the unit boundary: a pure local presence check is trivial; a
  // command that REACHES a real resource (wrangler/curl/etc.) is NOT, even if it also tests a path.
  ck(isTriviallyLocalWitness('Test-Path d1/schema.sql') === true, 'FG-unit: bare Test-Path is a trivially-local witness');
  ck(isTriviallyLocalWitness('(Get-Item wrangler.d1.toml).Length -gt 0') === true, 'FG-unit: Get-Item presence is trivially-local');
  ck(isTriviallyLocalWitness("Select-String -Path wrangler.d1.toml -Pattern 'database_id' -Quiet") === true, 'FG-unit: Select-String -Quiet on a local file is trivially-local');
  ck(isTriviallyLocalWitness("wrangler d1 execute muddytires-pois --remote --command \"SELECT COUNT(*) FROM pois\"") === false, 'FG-unit: a wrangler --remote query REACHES the resource (not trivial)');
  ck(isTriviallyLocalWitness("Invoke-RestMethod https://x.workers.dev/pois") === false, 'FG-unit: Invoke-RestMethod reaches the endpoint (not trivial)');
  ck(isTriviallyLocalWitness("curl -s https://x.workers.dev | Test-Path") === false, 'FG-unit: a command containing curl is not trivially-local even if it mentions Test-Path');
  ck(isTriviallyLocalWitness('node -c x.mjs') === false, 'FG-unit: node -c (compile check) is not a presence witness — left alone');

  // the EXACT d1-1 false-green class: a step CLAIMING the table exists on the REMOTE edge DB
  // but witnessing it with a bare Test-Path -> REJECTED at plan time (cost 0), code-repo only.
  const fgStep = { mission_id: 'M-FG', steps: [
    { step_index: 1, description: 'Witness the pois table now exists in sqlite_master on the REMOTE edge DB', action_type: 'verify', target_files: [], context_dependencies: [], validation_command: 'Test-Path d1/schema.sql' },
  ] };
  ck(!validateMicroQueue(fgStep, { codeRepo: true }).ok && validateMicroQueue(fgStep, { codeRepo: true }).errors.some((e) => /false-green floor/.test(e)),
    'FALSE-GREEN FLOOR: a remote-claiming step witnessed by a bare Test-Path is REJECTED (code-repo) — the d1-1 hollow-green class');
  // the SAME step with a REAL remote query PASSES (the floor only rejects the hollow witness).
  const fgFixed = { mission_id: 'M-FG2', steps: [
    { step_index: 1, description: 'Witness the pois table now exists in sqlite_master on the REMOTE edge DB', action_type: 'verify', target_files: [], context_dependencies: [], validation_command: "wrangler d1 execute muddytires-pois --remote --command \"SELECT name FROM sqlite_master WHERE name='pois'\"" },
  ] };
  ck(validateMicroQueue(fgFixed, { codeRepo: true }).ok, 'FALSE-GREEN FLOOR: the same remote-claiming step with a real wrangler --remote query PASSES (floor rejects only the hollow witness)');
  // CONSERVATIVE — the floor does NOT fire when the step is NOT code-repo (research/sandbox
  // produce local deliverables; a Test-Path witness is correct there).
  ck(validateMicroQueue(fgStep).ok === false ? validateMicroQueue(fgStep).errors.every((e) => !/false-green floor/.test(e)) : true,
    'FALSE-GREEN FLOOR: does NOT fire outside code-repo (no codeRepo opt) — a local-deliverable Test-Path witness stays legal');
  // CONSERVATIVE — a code-repo step whose description is LOCAL (witness a local file carries a
  // UUID) is NOT flagged even though it uses Test-Path/Select-String (correct local witness).
  const fgLocalOk = { mission_id: 'M-FG3', steps: [
    { step_index: 1, description: 'Witness wrangler.d1.toml carries a real 36-char UUID', action_type: 'verify', target_files: [], context_dependencies: [], validation_command: "Select-String -Path wrangler.d1.toml -Pattern 'database_id' -Quiet" },
  ] };
  ck(validateMicroQueue(fgLocalOk, { codeRepo: true }).ok, 'FALSE-GREEN FLOOR: a LOCAL-outcome code-repo step (witness a local file) with Test-Path/Select-String is NOT flagged (conservative — only remote-claiming steps)');

  // ------------------------------------------------------------- PHASE 1 BLIND PANEL (offline)
  // All panel tests inject a fake dispatchFn (no network). A valid micro_queue the integrator
  // can emit; a grounded architect result carries a search tool-trace.
  const VALID_QUEUE_JSON = '```json\n' + JSON.stringify({ mission_id: 'M-P', steps: [
    { step_index: 1, description: 'write the module', action_type: 'edit', target_files: ['src/mod.mjs'], context_dependencies: [], validation_command: 'node -c src/mod.mjs' },
  ] }) + '\n```';
  const groundedArch = { content: 'PLAN: step 1 edit src/mod.mjs (node -c src/mod.mjs)', _tools: [{ tool: 'searxng_web_search', args: 'q' }], provider: 'ollama-cloud' };
  const ungroundedArch = { content: 'PLAN: step 1 edit src/mod.mjs (node -c src/mod.mjs)', _tools: [], provider: 'ollama-cloud' };

  // (1) HAPPY PANEL: 3 grounded architects -> integrator synthesizes ONE valid queue.
  {
    let archCalls = 0, integCalls = 0;
    const seenArchFramings = new Set();
    const dispatch = async (seat, framing) => {
      if (seat.role === 'architect') { archCalls++; seenArchFramings.add(framing); return groundedArch; }
      if (seat.role === 'integrator') { integCalls++; return { content: VALID_QUEUE_JSON, provider: 'ollama-cloud' }; }
      throw new Error('unexpected seat role ' + seat.role);
    };
    const r = await deconstructPanel('Maqsad: add a module. Done means: node -c src/mod.mjs.', { dispatchFn: dispatch, maxRepairs: 0, route: 'panel' });
    ck(r.ok === true && r._panel === true, 'PANEL happy: 3 blind architects + integrator -> ok, _panel:true');
    ck(archCalls === 3 && integCalls === 1, 'PANEL happy: exactly 3 architect dispatches + 1 integrator dispatch');
    ck(validateMicroQueue(r.queue).ok, 'PANEL happy: the synthesized queue passes the EXISTING validateMicroQueue (reused gate)');
    ck(Array.isArray(r._architects) && r._architects.length === 3, 'PANEL happy: result records the 3 architect seats');
    // BLINDNESS: every architect received the IDENTICAL framing string and nothing peer-derived.
    ck(seenArchFramings.size === 1, 'PANEL blindness: all 3 architects got BYTE-IDENTICAL framing (no peer output threaded — structural blindness)');
    const f = [...seenArchFramings][0];
    ck(!/ARCHITECT \d PLAN/.test(f) && f.includes('you do NOT see the other architects'), 'PANEL blindness: architect framing contains NO peer plan + states independence');
  }

  // (2) DEGRADED PANEL: 1 dead architect (empty), 2 live -> still synthesizes from 2.
  {
    let n = 0;
    const dispatch = async (seat) => {
      if (seat.role === 'integrator') return { content: VALID_QUEUE_JSON, provider: 'ollama-cloud' };
      n++;
      return n === 2 ? { content: '', _failed: true } : groundedArch;   // 2nd architect dead
    };
    const r = await deconstructPanel('Maqsad: add a module.', { dispatchFn: dispatch, maxRepairs: 0, route: 'panel' });
    ck(r.ok === true && r._panel === true && r._architects.length === 2, 'PANEL degraded: 1 dead architect -> integrator synthesizes from the 2 live plans');
  }

  // (3) FAIL-CLOSED SEARCH: <2 grounded -> HOLD (ok:false, named reason), integrator NEVER called.
  {
    let integCalled = false;
    const dispatch = async (seat) => {
      if (seat.role === 'integrator') { integCalled = true; return { content: VALID_QUEUE_JSON }; }
      return ungroundedArch;   // all architects UNgrounded
    };
    const r = await deconstructPanel('Maqsad: x. needs SOTA search.', { dispatchFn: dispatch, maxRepairs: 0, route: 'panel' });
    ck(r.ok === false && /fail-closed search/.test((r.errors || []).join(' ')), 'PANEL fail-closed: <2 search-grounded architects -> mission HELD (ok:false, named reason)');
    ck(integCalled === false, 'PANEL fail-closed: integrator is NEVER dispatched when the panel holds (no plan from stale memory)');
  }

  // (4) FULL FALLBACK: too few usable plans -> falls back to the single-architect deconstruct().
  {
    let singleCalled = false;
    const dispatch = async (seat) => {
      if (seat.role === 'integrator') return { content: VALID_QUEUE_JSON };
      return { content: '', _failed: true };   // every architect dead -> <2 plans -> fallback
    };
    const fakeSingle = async () => { singleCalled = true; return { ok: true, queue: { mission_id: 'M-FB', steps: [
      { step_index: 1, description: 'x', action_type: 'edit', target_files: ['a.mjs'], context_dependencies: [], validation_command: 'node -c a.mjs' },
    ] }, attempts: 1 }; };
    const r = await deconstructPanel('Maqsad: x.', { dispatchFn: dispatch, deconstructFn: fakeSingle, maxRepairs: 0, route: 'panel' });
    ck(r.ok === true && r._panel === false && /usable plan/.test(r._fallback || ''), 'PANEL fallback: <2 architect plans -> single-architect deconstruct() (engine never hard-breaks)');
    ck(singleCalled === true, 'PANEL fallback: the single-architect path was actually invoked');
  }

  // (5) INTEGRATOR FAILURE FALLBACK: 3 grounded plans but the integrator can't emit a valid
  // queue -> falls back to the single architect (never hard-break).
  {
    let singleCalled = false;
    const dispatch = async (seat) => {
      if (seat.role === 'integrator') return { content: 'I cannot produce json.' };   // no valid queue
      return groundedArch;
    };
    const fakeSingle = async () => { singleCalled = true; return { ok: true, queue: { mission_id: 'M-FB2', steps: [
      { step_index: 1, description: 'x', action_type: 'edit', target_files: ['a.mjs'], context_dependencies: [], validation_command: 'node -c a.mjs' },
    ] }, attempts: 1 }; };
    const r = await deconstructPanel('Maqsad: x.', { dispatchFn: dispatch, deconstructFn: fakeSingle, maxRepairs: 0, route: 'panel' });
    ck(r.ok === true && r._panel === false && singleCalled && /integrator failed/.test(r._fallback || ''), 'PANEL fallback: integrator emits no valid queue -> single-architect deconstruct() (never hard-break)');
  }

  // (6) PANEL OFF (flag): deconstructPanel IS deconstruct() — one architect, no integrator.
  {
    let archCalls = 0, integCalls = 0;
    const dispatch = async (seat) => {
      if (seat.role === 'architect') { archCalls++; return { content: VALID_QUEUE_JSON, provider: 'ollama-cloud' }; }
      integCalls++; return { content: VALID_QUEUE_JSON };
    };
    const r = await deconstructPanel('Maqsad: x.', { dispatchFn: dispatch, panel: false, maxRepairs: 0 });
    ck(r.ok === true && archCalls === 1 && integCalls === 0, 'PANEL off (panel:false): falls to single architect, NO integrator (the explicit kill-switch)');
  }

  // (7) RESEARCH OPTS SURVIVE the integrator path: a research mission's .md deliverable +
  // absolute read-only context dep must VALIDATE through the integrator's validateMicroQueue.
  {
    const researchQueue = '```json\n' + JSON.stringify({ mission_id: 'M-RP', steps: [
      { step_index: 1, description: 'write the verdict table', action_type: 'edit', target_files: ['verdict-table.md'], context_dependencies: ['C:\\Users\\x\\sources.md'], validation_command: 'Test-Path verdict-table.md' },
    ] }) + '\n```';
    const dispatch = async (seat) => seat.role === 'integrator'
      ? { content: researchQueue, provider: 'ollama-cloud' }
      : groundedArch;
    const r = await deconstructPanel('MISSION-CLASS: research\nMaqsad: produce a verdict table from sources.', { dispatchFn: dispatch, maxRepairs: 0, route: 'panel' });
    ck(r.ok === true && r._panel === true, 'PANEL research: a research-class .md deliverable + absolute context dep SURVIVES the integrator validateMicroQueue (research opts threaded)');
    // and the SAME queue would FAIL under the non-research gate (proves the flag actually flowed):
    ck(!validateMicroQueue(r.queue).ok, 'PANEL research: that same queue is REJECTED without the research flag (regression guard — the flag truly threaded)');
  }

  // (8) SEATING MODE remaps the architect seats (seating-modes build): with MUEZZIN_MODE=
  // anthropic-heavy, the 3 blind architects are dispatched as opus/sonnet/haiku (Claude IN
  // the phase); with no mode they stay the today-default kimi/deepseek/minimax. The panel
  // LOGIC (3 blind serial + integrator) is identical — only the model names change.
  {
    const seatModelsFor = async (envMode) => {
      const saved = process.env.MUEZZIN_MODE;
      if (envMode) process.env.MUEZZIN_MODE = envMode; else delete process.env.MUEZZIN_MODE;
      const seen = [];
      const dispatch = async (seat) => {
        if (seat.role === 'architect') { seen.push(seat.model); return groundedArch; }
        return { content: VALID_QUEUE_JSON, provider: 'ollama-cloud' };   // integrator
      };
      const r = await deconstructPanel('Maqsad: add a module.', { dispatchFn: dispatch, maxRepairs: 0, route: 'panel' });
      if (saved === undefined) delete process.env.MUEZZIN_MODE; else process.env.MUEZZIN_MODE = saved;
      return { seen, architects: r._architects };
    };
    // NOTE: the all-cloud panel now dispatches in PARALLEL (Promise.all), so seat-push order
    // is COMPLETION order, not input order. Assert on r._architects (input-order-preserving,
    // built from Promise.all's order-stable results) — and that seen is the same SET.
    const ah = await seatModelsFor('anthropic-heavy');
    ck(JSON.stringify(ah.architects) === JSON.stringify(['opus', 'sonnet', 'haiku']) && [...ah.seen].sort().join() === ['opus', 'sonnet', 'haiku'].sort().join(),
      'SEATING MODE anthropic-heavy: the 3 blind architects are seated opus/sonnet/haiku (Claude in the phase)');
    // "absent mode" = set MUEZZIN_MODE to an INVALID sentinel -> readMode returns null
    // deterministically (env-set-but-invalid -> default), so this test does NOT read (and is
    // not polluted by) the machine's live route file, which legitimately carries a real mode.
    const def = await seatModelsFor('__none__');
    ck(JSON.stringify(def.architects) === JSON.stringify(PANEL_ARCHITECTS) && [...def.seen].sort().join() === [...PANEL_ARCHITECTS].sort().join(),
      'SEATING MODE absent: architects fall back to today-default PANEL_ARCHITECTS (kimi/deepseek/minimax) — safe default');
    // explicit caller arg still wins over the mode (injectability preserved for every test above).
    {
      const saved = process.env.MUEZZIN_MODE; process.env.MUEZZIN_MODE = 'anthropic-heavy';
      const seen = [];
      const dispatch = async (seat) => { if (seat.role === 'architect') { seen.push(seat.model); return groundedArch; } return { content: VALID_QUEUE_JSON }; };
      await deconstructPanel('Maqsad: x.', { dispatchFn: dispatch, architects: ['m1', 'm2', 'm3'], maxRepairs: 0, route: 'panel' });
      if (saved === undefined) delete process.env.MUEZZIN_MODE; else process.env.MUEZZIN_MODE = saved;
      ck(JSON.stringify(seen) === JSON.stringify(['m1', 'm2', 'm3']), 'SEATING MODE: an EXPLICIT architects arg overrides the mode (test injectability preserved)');
    }
  }

  // ------------------------------------------------- (9) PER-MISSION ARCHITECT ROUTING (P1 #1)
  // chooseArchitectRoute: ALWAYS PANEL (3 blind architects per the locked spec); only an EXPLICIT override forces 'single'.
  {
    // d1-1's ACTUAL header shape (code-repo, 5 ALLOW-FILES inline) -> PANEL (always, no single-route default).
    const d1_1 = `MISSION-CLASS: code-repo (Cloudflare D1)
MISSION-ID: M-MUDDYTIRES.D1.1
ALLOW-FILES: d1/schema.sql, d1/load-pois.mjs, workers/pois-d1.js, wrangler.d1.toml, d1/README.md
Maqsad: stand up D1 + load POIs.`;
    ck(chooseArchitectRoute(d1_1) === 'panel', 'ROUTE: d1-1 (code-repo, 5 ALLOW-FILES, no override) routes PANEL (always-panel default)');
    ck(countAllowFiles(d1_1) === 5, 'ROUTE: d1-1 ALLOW-FILES counted = 5 (inline comma list, comment stripped)');

    // research / command / authoring -> PANEL (no single-route default; spec mandates 3 blind architects).
    ck(chooseArchitectRoute('MISSION-CLASS: research\nMaqsad: write one verdict card.') === 'panel', 'ROUTE: a research mission routes PANEL (always-panel default)');
    ck(chooseArchitectRoute('MISSION-CLASS: command\nMaqsad: run a backup.') === 'panel', 'ROUTE: a command mission routes PANEL (always-panel default)');
    ck(chooseArchitectRoute('Maqsad: author one knowledge card about the website pipeline.') === 'panel', 'ROUTE: an authoring mission (no class/markers) routes PANEL (always-panel default)');

    // a build-program / TIER: HAJJ -> PANEL (high-stakes, the panel kept for complex work).
    ck(chooseArchitectRoute('MISSION-CLASS: code-repo\nMaqsad: a full build-program for the new engine subsystem.') === 'panel', 'ROUTE: a build-program routes PANEL (complex)');
    ck(chooseArchitectRoute('TIER: HAJJ\nMaqsad: anything.') === 'panel', 'ROUTE: an explicit TIER: HAJJ marker routes PANEL');
    ck(chooseArchitectRoute('PANEL: required\nMaqsad: anything.') === 'panel', 'ROUTE: an explicit PANEL: required marker routes PANEL');
    ck(chooseArchitectRoute('Maqsad: a high-stakes irreversible migration.') === 'panel', 'ROUTE: a high-stakes marker routes PANEL');

    // LARGE code-repo (ALLOW-FILES > file-cap) -> PANEL (a sprawling multi-part build).
    const bigRepo = `MISSION-CLASS: code-repo
ALLOW-FILES:
  - a.mjs
  - b.mjs
  - c.mjs
  - d.mjs
  - e.mjs
  - f.mjs
  - g.mjs
Maqsad: implement seven modules.`;
    ck(countAllowFiles(bigRepo) === 7, 'ROUTE: bulleted ALLOW-FILES block counted = 7');
    ck(chooseArchitectRoute(bigRepo) === 'panel', 'ROUTE: a code-repo with 7 ALLOW-FILES (> cap 6) routes PANEL (large)');

    // OVERRIDES: opt and env force a route; forced PANEL is never downgraded, forced SINGLE honored.
    ck(chooseArchitectRoute(d1_1, { route: 'panel' }) === 'panel', 'ROUTE override: opts.route=panel forces PANEL on a simple mission (never downgrade scrutiny)');
    ck(chooseArchitectRoute(bigRepo, { route: 'single' }) === 'single', 'ROUTE override: opts.route=single forces SINGLE');
    { const saved = process.env.MUEZZIN_ARCHITECT_ROUTE; process.env.MUEZZIN_ARCHITECT_ROUTE = 'panel';
      ck(chooseArchitectRoute(d1_1) === 'panel', 'ROUTE override: MUEZZIN_ARCHITECT_ROUTE=panel env forces PANEL');
      if (saved === undefined) delete process.env.MUEZZIN_ARCHITECT_ROUTE; else process.env.MUEZZIN_ARCHITECT_ROUTE = saved; }
    { const saved = process.env.MUEZZIN_ROUTE_FILECAP; process.env.MUEZZIN_ROUTE_FILECAP = '4';
      ck(chooseArchitectRoute(d1_1) === 'panel', 'ROUTE: d1-1 routes PANEL regardless of MUEZZIN_ROUTE_FILECAP (always-panel default; filecap heuristic retired)');
      if (saved === undefined) delete process.env.MUEZZIN_ROUTE_FILECAP; else process.env.MUEZZIN_ROUTE_FILECAP = saved; }

    // deconstructPanel honors an EXPLICIT single override -> single-architect path, NO panel/integrator.
    // (The DEFAULT is always-panel per the locked spec; only an explicit override takes the single path.)
    {
      let archCalls = 0, integCalls = 0;
      const dispatch = async (seat) => { if (seat.role === 'architect') { archCalls++; return { content: VALID_QUEUE_JSON, provider: 'ollama-cloud' }; } integCalls++; return { content: VALID_QUEUE_JSON }; };
      const r = await deconstructPanel(d1_1, { dispatchFn: dispatch, maxRepairs: 0, route: 'single' });
      ck(r.ok === true && r._panel === false && r._route === 'single' && archCalls === 1 && integCalls === 0,
        'ROUTE wired: an EXPLICIT route:single through deconstructPanel takes the single-architect path (1 architect, NO integrator, _panel:false)');
    }
  }

  // -------------------------------------------- (10) PANEL PARALLELIZATION (P1 #2, GR10-guarded)
  // isCloudParallelSafe + the panel's all-cloud parallel branch.
  {
    ck(isCloudParallelSafe('opus') && isCloudParallelSafe('sonnet') && isCloudParallelSafe('haiku'), 'PARALLEL: Claude family names are cloud-parallel-safe');
    ck(['kimi-k2.6', 'deepseek-v4-pro', 'minimax-m3'].every(isCloudParallelSafe), 'PARALLEL: the default PANEL_ARCHITECTS (kimi/deepseek/minimax) are all cloud-parallel-safe');
    ck(!isCloudParallelSafe('qwen3.6:27b') && !isCloudParallelSafe('granite4.1:30b'), 'PARALLEL: local-heavy bare local tags are NOT parallel-safe (GR10 -> serial)');
    ck(!isCloudParallelSafe('totally-unknown-model'), 'PARALLEL: an unknown model is NOT parallel-safe (conservative: uncertain -> serial)');

    // ALL-CLOUD architects -> CONCURRENT dispatch. Prove concurrency with an injected fake that
    // records how many architect dispatches are IN FLIGHT simultaneously: parallel -> peak 3.
    {
      let inFlight = 0, peak = 0;
      const dispatch = async (seat) => {
        if (seat.role === 'integrator') return { content: VALID_QUEUE_JSON, provider: 'ollama-cloud' };
        inFlight++; peak = Math.max(peak, inFlight);
        await new Promise((res) => setTimeout(res, 5));   // hold the seat 'busy' so peers can overlap
        inFlight--;
        return groundedArch;
      };
      const r = await deconstructPanel('Maqsad: add a module.', { dispatchFn: dispatch, maxRepairs: 0, route: 'panel', architects: ['kimi-k2.6', 'deepseek-v4-pro', 'minimax-m3'] });
      ck(r.ok === true && r._panel === true, 'PARALLEL all-cloud: panel still synthesizes a valid queue');
      ck(peak === 3, 'PARALLEL all-cloud: all 3 architects dispatched CONCURRENTLY (peak in-flight = 3 — Promise.all, not serial)');
    }

    // ANY LOCAL architect -> SERIAL (GR10: never two local models at once). peak in-flight = 1.
    {
      let inFlight = 0, peak = 0;
      const dispatch = async (seat) => {
        if (seat.role === 'integrator') return { content: VALID_QUEUE_JSON, provider: 'ollama-cloud' };
        inFlight++; peak = Math.max(peak, inFlight);
        await new Promise((res) => setTimeout(res, 5));
        inFlight--;
        return groundedArch;
      };
      // one LOCAL seat present (qwen3.6:27b) -> the whole panel stays serial.
      const r = await deconstructPanel('Maqsad: add a module.', { dispatchFn: dispatch, maxRepairs: 0, route: 'panel', architects: ['kimi-k2.6', 'qwen3.6:27b', 'minimax-m3'] });
      ck(r.ok === true && r._panel === true, 'PARALLEL serial-when-local: panel still synthesizes a valid queue');
      ck(peak === 1, 'GR10 serial-when-local: a local architect present -> architects dispatched ONE AT A TIME (peak in-flight = 1, never two local at once)');
    }
  }

  console.log(fails === 0 ? '\nALL PASS — micro_queue validator + Phase-1 blind panel sound (routing: simple->single / complex->panel; parallel-when-cloud, serial-when-local; fail-closed search, single-architect fallback)' : `\n${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}
