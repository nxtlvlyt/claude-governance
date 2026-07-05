// conduct-cycle.mjs — the conductor's cycle sweep, frozen into code (QUEUE 5b, operator
// ruling 2026-06-10: "this process needs to be so good a LOCAL model could be in your
// seat"). Judgment drains out of the seat into this script: it reads the substrate,
// computes every check the Fable conductor ran by hand, and emits (a) a board-format
// report ready to relay and (b) REQUIRED ACTIONS with exact commands and file paths.
// The seat's job collapses to: run this -> relay the report -> approve/perform the
// listed actions. Nothing here asks the model to remember to go read anything —
// substrate is only read after failure, so this script delivers it instead (operator
// delivery principle, 2026-06-10).
//
// Usage:  node conduct-cycle.mjs            one sweep, prints report + actions
//         node conduct-cycle.mjs --json     same data as JSON (for tooling)
//         node conduct-cycle.mjs --selftest offline fixture tests, no daemon needed
//
// Thresholds (from the conductor faith + 2026-06-10 session receipts):
//   status heartbeat older than 5 min  -> daemon DEAD/HUNG -> restart action
//   no dispatch heartbeat for 20 min while lanes run -> STALL flag
//   FAILED mission -> diagnose action (retro + result paths named), NEVER blind refire
//   claude-tier heartbeat lines with no 429 in the same window -> investigate flag
//   3+ EMPTY_CONTENT_THINKING fails in window -> known quota-burn class (QUEUE fix item)

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, appendFileSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractSourceShas } from './git_steps.mjs';   // DONENESS L3: parse deliverable source shas from mission prose

const HERE = path.dirname(fileURLToPath(import.meta.url));

const T = {
  STATUS_DEAD_MS: 5 * 60 * 1000,
  LANE_STALL_MS: 20 * 60 * 1000,
  HB_WINDOW_MS: 30 * 60 * 1000,
  THINKING_BURN_COUNT: 3,
  // RAISED 2026-07-01 (real incident: the daemon self-killed 5 times in ~50 minutes,
  // regardless of which mission was running, because heal()'s own 5-min auto-cadence
  // means a lane surviving the first check gets killed on the second at ~10 elapsed
  // minutes -- and a 3-seat Phase-1 panel PLANNING pass under claude-local-hybrid
  // (Claude + 2 local Ollama models each generating a full plan) routinely takes longer
  // than 5 minutes on its own, with nothing actually hung. 15min gives 2 full heal
  // cycles of headroom past a normal PLANNING pass, while staying well under
  // LANE_STALL_MS's 20min report-only threshold -- so a lane that's STILL running past
  // 15min AND past 20min gets both the stall flag and (if the kill-target bug below is
  // ever fixed) a real kill, instead of the two thresholds colliding on top of each
  // other as they did at 5min.
  TASK_STUCK_MS: 15 * 60 * 1000,
  LOOP_CAP_REPEATS: 3,
};

const RESTART_CMD =
  "powershell -Command \"Start-Process node -ArgumentList 'muezzin-daemon.mjs' -WorkingDirectory '" + HERE.replace(/\\/g, '\\\\') + "' -WindowStyle Hidden\"";

function readText(p) { try { return readFileSync(p, 'utf8'); } catch { return ''; } }
function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
function age(iso, now) { const t = Date.parse(iso); return Number.isFinite(t) ? now - t : Infinity; }
function mins(ms) { return ms === Infinity ? '?' : Math.round(ms / 60000); }
function pidAlive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }

// AUTORUN line parsing — same identity rules as the daemon (status prefix + path).
// PARKED + SPLIT added 2026-07-02 (parked-graveyard audit): this parser previously knew only
// DONE/FAILED/RUNNING, so every `PARKED missions/x` and `SPLIT missions/x` ledger line fell
// through to PENDING with the status word embedded in the path — inflating the doneness
// pending count by every parked/split line and hiding the parked population from the sweep
// entirely. The daemon's own parser has known both statuses since 2026-06-25; this one drifted.
const STATUS_RE = /^(DONE|FAILED|RUNNING|PARKED|SPLIT)\b/;
function parseAutorun(text) {
  const out = { done: [], failed: [], running: [], pending: [], parked: [], split: [], notes: {} };
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const m = s.match(STATUS_RE);
    const note = (s.match(/<!--([\s\S]*?)-->/) || [])[1]?.trim() || '';
    const p = s.replace(STATUS_RE, '').replace(/<!--.*?-->/g, '').trim();
    if (!p) continue;
    if (note) out.notes[p] = note;
    if (!m) out.pending.push(p);
    else out[m[1].toLowerCase()].push(p);
  }
  return out;
}

// status keyword of a single AUTORUN line (DONE/FAILED/RUNNING or null when bare).
function statusOfLine(line) { const m = String(line).trim().match(STATUS_RE); return m ? m[1] : null; }
const stemOf = (p) => path.basename(String(p)).replace(/\.mission\.txt$/i, '');

// STUCK-LANE detection: a lane with a recorded start_ts that has exceeded the task
// stuck threshold. Lanes may be strings (legacy) or {path, start_ts} objects.
export function detectStuckLanes(status, now = Date.now()) {
  if (!status || !Array.isArray(status.lanes)) return [];
  return status.lanes.map((lane, i) => {
    const isString = typeof lane === 'string';
    const p = isString ? lane : (lane?.path || '');
    const start = isString ? NaN : Date.parse(lane?.start_ts || '');
    const ageMs = Number.isFinite(start) ? now - start : NaN;
    return { index: i, path: p, start_ts: isString ? undefined : lane?.start_ts, ageMs, stuck: Number.isFinite(ageMs) && ageMs > T.TASK_STUCK_MS };
  }).filter((x) => x.stuck);
}

// LOOP-CAP detection: a mission stem appearing LOOP_CAP_REPEATS or more times anywhere
// in the AUTORUN ledger is a loop and must be capped before it burns quota indefinitely.
export function detectLoopCaps(autorun, cap = T.LOOP_CAP_REPEATS) {
  const counts = {};
  // parked/split included: pre-2026-07-02 they rode in via the pending mis-parse; a stem that
  // loops through PARKED re-marks is still a loop.
  for (const p of [...autorun.done, ...autorun.failed, ...autorun.running, ...autorun.pending, ...(autorun.parked || []), ...(autorun.split || [])]) {
    const s = stemOf(p);
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts).filter(([_, c]) => c >= cap).map(([stem, count]) => ({ stem, count }));
}

// FIX-LEDGER — the conductor's diagnosis receipt that a fix LANDED. Each entry names the
// failure class, the fix, and the missions that fix unblocks. This is what makes
// requeue-on-fix-landed MECHANICAL without being blind: the daemon faith forbids blind
// relaunch, but "healing a class must requeue the healed" is the same rule's other half.
// An explicit entry IS the diagnosis; each entry requeues its missions exactly ONCE
// (the `requeued` flag), so a mission that fails AGAIN after requeue needs fresh
// diagnosis — it never auto-loops.  Path: missions/_logs/fix-ledger.json
const fixLedgerPath = (base) => path.join(base, 'missions', '_logs', 'fix-ledger.json');
// requeueStemOf: the per-stem shape is {stem, requeued} (mt-c3-perstem migration below);
// tolerate a bare legacy string too, since callers that build fixEntries arrays directly
// (not via readFixLedger) may still pass one.
const requeueStemOf = (item) => (typeof item === 'string' ? item : item?.stem);
function readFixLedger(base) {
  const o = readJson(fixLedgerPath(base));
  const ledger = (o && Array.isArray(o.entries)) ? o : { entries: [] };
  for (const e of ledger.entries) {
    if (!Array.isArray(e.requeue)) continue;
    // mt-c3-perstem: transparently migrate legacy bare-stem-string requeue entries into
    // per-stem tracking objects — a bare array can only ever be all-or-nothing, but a
    // fix that unblocks several missions may land for one before another.
    e.requeue = e.requeue.map((item) => (typeof item === 'string' ? { stem: item, requeued: false } : item));
  }
  return ledger;
}
function writeFixLedger(base, obj) { writeFileSync(fixLedgerPath(base), JSON.stringify(obj, null, 2)); }

// conductor records a landed fix (called from code or `--record`). cls=failure class,
// fix=what closed it, requeue=mission stems it unblocks.
export function recordFix(base, { cls, fix, requeue = [] }, now = Date.now()) {
  const ledger = readFixLedger(base);
  const requeueEntries = requeue.map((s) => (typeof s === 'string' ? { stem: s, requeued: false } : s));
  ledger.entries.push({ class: cls, fix, landed_ts: new Date(now).toISOString(), requeue: requeueEntries, requeued: false });
  writeFixLedger(base, ledger);
  return ledger;
}

// FALSE-DEATH SCAN (#25, blind-spot hunt wf_0b61e8ba; built 2026-07-03 under the GAP-FIRST
// ruling): the doneness gate validates DONE marks against deliverables, but nothing ever
// re-validated FAILED marks against the repo — 9 of 13 sampled code-repo FAILED lines were
// byte-identical-landed at HEAD (board ~70-90% wrong for that class). This scans every
// unresolved FAILED code-repo mission: ALLOW-FILES present at HEAD AND byte-identical to the
// mission's source sha => FULL false-death candidate. Keyed on BYTE-IDENTITY, never bare
// presence — the b13-aria trio (files present, map.html wiring absent) is the false-positive
// control that presence-keying would have flagged wrongly.
// missionLandedState — the per-mission identity core, ONE implementation consumed by BOTH
// the falseDeathScan sweep (post-hoc) and the daemon's PRE-SATISFIED fire guard (#25b,
// pre-hoc). Byte-identity keyed; nosha caps at PARTIAL (the b13-aria control).
export function missionLandedState(mtext, gitFn) {
  if (!mtext || !/MISSION-CLASS:\s*code-repo/i.test(mtext)) return null;
  const repo = (mtext.match(/REPO-ROOT:\s*(.+)/) || [])[1]?.trim();
  if (!repo) return null;
  const allow = [...mtext.matchAll(/^\s{2}-\s+(\S+)/gm)].map((m) => m[1]).filter((p2) => p2 !== '.');
  if (!allow.length) return null;
  const srcSha = (mtext.match(/\b([a-f0-9]{7,40})\b/) || [])[1];
  const files = {};
  let present = 0, identical = 0;
  for (const ap of allow) {
    const ls = gitFn(repo, `ls-tree HEAD -- "${ap}"`);
    if (!ls.ok || !ls.out.trim()) { files[ap] = 'absent'; continue; }
    present++;
    if (srcSha) {
      const d = gitFn(repo, `diff --quiet ${srcSha}:"${ap}" HEAD:"${ap}"`);
      files[ap] = d.ok ? (identical++, 'present-identical') : 'present-differs';
    } else files[ap] = 'present-nosha';
  }
  // NOSHA CAP (first-live-pass fix 2026-07-03): without a source sha, presence is the ONLY
  // evidence — that is exactly the weak keying the b13-aria control exists to forbid. FULL
  // requires byte-identity receipts; nosha missions cap at PARTIAL (present-unverifiable).
  const verdict = present === allow.length && srcSha && identical === allow.length ? 'FULL'
    : present > 0 ? 'PARTIAL' : 'GENUINE';
  return { verdict, srcSha: srcSha || null, files };
}

export function falseDeathScan(autorun, base, { gitFn, readTextFn } = {}) {
  const readT = readTextFn || ((p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } });
  const out = [];
  for (const f of autorun.failed || []) {
    const note = autorun.notes[f] || '';
    if (/\bRESOLVED\b|\bSUPERSEDED\b|REVISIT-JUDGED|FALSE-DEATH-JUDGED|\bDUPLICATE-RETIRED\b/i.test(note)) continue;
    const st = missionLandedState(readT(path.join(base, f.replace(/\//g, path.sep))), gitFn);
    if (st && st.verdict !== 'GENUINE') out.push({ path: f, verdict: st.verdict, srcSha: st.srcSha, files: st.files });
  }
  return out;
}

// BANKED-DELIVERABLES SCAN (#27, blind-spot hunt; built 2026-07-03): a mission that dies at
// step N silently discards the operator-valuable artifacts steps 1..N-1 produced — six
// verified sandboxes held ~200KB of complete research (incl. social-seo tiktok.md, 17KB
// live-sourced, serving the operator's declared focus) that NO surfacing mechanism could
// ever show him (review-queue requires LANDED, notify is outcome-only, the sweep judged
// ledger lines never sandbox contents). This scans unresolved FAILED/PARKED missions'
// sandboxes for substantive artifacts and surfaces them as a judgment item. Judging
// protocol: stamp the ledger line `SALVAGE-JUDGED <ISO ts>: <surfaced-at | worthless-because>`
// — stamped lines go quiet (same anchor discipline as REVISIT-JUDGED).
export function bankedDeliverables(autorun, base, { readdirFn, statFn, minBytes = 5120 } = {}) {
  const rd = readdirFn || ((d) => { try { return readdirSync(d); } catch { return null; } });
  const st = statFn || ((p) => { try { return statSync(p); } catch { return null; } });
  const out = [];
  const items = [
    ...(autorun.parked || []).map((p) => ({ path: p, note: autorun.notes[p] || '' })),
    ...(autorun.failed || []).map((p) => ({ path: p, note: autorun.notes[p] || '' })),
  ];
  for (const it of items) {
    if (/SALVAGE-JUDGED|\bRESOLVED\b|\bSUPERSEDED\b|\bDUPLICATE-RETIRED\b/i.test(it.note)) continue;
    const stem = path.basename(it.path).replace(/\.mission\.txt$/i, '');
    const sandbox = path.join(base, 'missions', stem);
    const names = rd(sandbox);
    if (!names) continue;
    const artifacts = [];
    for (const n of names) {
      if (!/\.md$/i.test(n)) continue;
      if (/\.numbered\.md$/i.test(n) || /^_/.test(n)) continue;      // numbered sources + _prior-attempt/_src dirs excluded per spec
      const s = st(path.join(sandbox, n));
      if (s && s.isFile && (typeof s.isFile !== 'function' || s.isFile()) && s.size >= minBytes) {
        artifacts.push({ name: n, bytes: s.size });
      }
    }
    if (artifacts.length) out.push({ path: it.path, stem, artifacts: artifacts.sort((a, b) => b.bytes - a.bytes).slice(0, 5) });
  }
  return out;
}

// PARKED-REVIVAL (2026-07-02, operator: "why are things getting parked, do they go there to
// die?" — receipt: they DID. PARKED is daemon-terminal ("DEAD, never re-promote",
// muezzin-daemon.mjs) and this sweep blessed every engine-capability park as "(legitimate)"
// with NO action, forever. Seven b13-* lines parked 2026-06-25 "revisit after engine fixes"
// were never revisited across a week in which the engine fixes actually landed.)
//
// A park is a CONDITION, not a verdict (CLAUDE.md D7). This detector makes the condition
// live: a parked item is DUE for a conductor revisit when
//   (a) any fix-ledger entry landed AFTER the park's anchor date, or
//   (b) the anchor is older than maxAgeDays (standing weekly look at the graveyard), or
//   (c) the item carries no parseable date at all (unknown-age parks get looked at until
//       someone stamps them).
// Judging protocol: the conductor revisits, then appends `REVISIT-JUDGED <ISO date>: <verdict>`
// to the line's annotation. That date becomes the new anchor — the item goes quiet until a
// NEWER fix lands or maxAgeDays pass again. Judged ≠ revived: STILL-BLOCKED is a valid
// verdict; what is not valid is silence.
export function parkedRevivalDue(autorun, fixEntries = [], { maxAgeDays = 7, now = Date.now() } = {}) {
  const items = [];
  for (const p of autorun.parked || []) items.push({ path: p, note: autorun.notes[p] || '', kind: 'PARKED' });
  for (const f of autorun.failed || []) {
    const note = autorun.notes[f] || '';
    if (/\bSUPERSEDED\b|\bRESOLVED\b|FIX:\s*none\b|\bDUPLICATE-RETIRED\b/i.test(note)) continue;   // judged-closed
    if (/pending engine|engine batch|PARKED/i.test(note)) items.push({ path: f, note, kind: 'FAILED-parked' });
  }
  const due = [];
  for (const it of items) {
    // structured timestamp capture — the loose class [T\d:.Z]* greedily ate the delimiter
    // colon after "…Z:" making Date.parse NaN and silently voiding every judgment stamp
    // (caught live 2026-07-02, first stamping pass)
    // LATEST-MATCH FIX (2026-07-05): a re-judged item appends a SECOND REVISIT-JUDGED
    // stamp after the first; .match() without /g returns only the first hit, so the
    // anchor never advanced past the original judgment date and every re-stamp was
    // invisible to isDue — the mechanism could never be silenced by re-judging (found
    // live: 13/13 re-stamped items stayed "due" with an unchanged anchor). Take the last.
    const revisitStamps = [...it.note.matchAll(/REVISIT-JUDGED[: ]+(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?)/gi)];
    const judged = revisitStamps.length ? Date.parse(revisitStamps[revisitStamps.length - 1][1]) : NaN;
    const parked = Date.parse((it.note.match(/\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?/) || [])[0] || '');
    const anchor = Number.isFinite(judged) ? judged : (Number.isFinite(parked) ? parked : null);
    const stem = path.basename(it.path).replace(/\.mission\.txt$/i, '');
    const fixesSince = fixEntries
      // TARGETED-HEAL FILTER (2026-07-03, first live churn receipt): a fix entry with a
      // non-empty requeue[] naming OTHER missions is a mission-targeted heal, not a park-
      // relevant engine capability — it must not re-open every judged park (two targeted
      // entries re-opened all 13 stamps within 90 minutes of judging). CLASS-level entries
      // (empty requeue) still re-open parks: that is the mechanism working as designed.
      .filter((e) => !(Array.isArray(e.requeue) && e.requeue.length && !e.requeue.some((item) => { const s = requeueStemOf(item); return stem === s || stem === String(s).replace(/\.mission\.txt$/i, '').replace(/^missions\//, ''); })))
      .filter((e) => anchor == null || (Number.isFinite(Date.parse(e.landed_ts)) && Date.parse(e.landed_ts) > anchor))
      .map((e) => e.class);
    const ageDays = anchor == null ? null : Math.floor((now - anchor) / 86400e3);
    const isDue = anchor == null || fixesSince.length > 0 || ageDays >= maxAgeDays;
    if (isDue) due.push({ path: it.path, kind: it.kind, ageDays, fixesSince: [...new Set(fixesSince)] });
  }
  return due;
}

// mt-model-audit-fn: groups a set of Ollama tag entries ({name, digest}) by digest; a
// shared-digest group is BENIGN only if every name shares the same substring before its
// first colon (the ordinary :latest-alias shape) — any other multi-name group is a FRAUD
// CANDIDATE: distinct-looking names secretly serving the same weights, the exact class
// that misattributed a model's lab/size/history four times in one operator-caught night
// before this detector existed. Pure — no network, no fs; the sweep supplies live data.
export function auditModelIdentities(models) {
  const byDigest = {};
  for (const m of models || []) {
    if (!m || !m.digest || !m.name) continue;
    (byDigest[m.digest] ||= []).push(m.name);
  }
  const fraudGroups = [];
  const benignGroups = [];
  for (const [digest, names] of Object.entries(byDigest)) {
    if (names.length < 2) continue;
    const prefixes = new Set(names.map((n) => n.split(':')[0]));
    const group = { digest, names };
    if (prefixes.size === 1) benignGroups.push(group);
    else fraudGroups.push(group);
  }
  return { fraudGroups, benignGroups };
}

// SearXNG sight-check: a control query that cannot honestly return zero results.
// Sync + bounded (the sweep is a CLI; 8s ceiling). Injectable for selftests.
import { execSync as _execSyncSight } from 'child_process';
export function checkSearxngSight({ probe } = {}) {
  try {
    const urls = [];
    if (process.env.SEARXNG_URL) urls.push(process.env.SEARXNG_URL.replace(/\/+$/, ''));
    urls.push('http://localhost:8080');
    urls.push('http://100.103.44.13:8080');
    urls.push('http://nxtbeast:8080');

    let lastError = null;
    for (const base of urls) {
      try {
        const urlBase = base.endsWith('/search') ? base : `${base}/search`;
        const body = probe ? probe() : _execSyncSight(
          `curl -s -m 8 "${urlBase}?q=github&format=json"`,
          { timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
        if (body && body.trim()) {
          const j = JSON.parse(body);
          const n = Array.isArray(j?.results) ? j.results.length : 0;
          if (n > 0) return { ok: true, results: n };
        }
      } catch (e) {
        lastError = e;
      }
    }
    return { ok: false, reason: lastError ? `probe failed: ${String(lastError?.message || lastError).slice(0, 80)}` : 'zero results' };
  } catch (e) {
    return { ok: false, reason: `probe failed: ${String(e?.message || e).slice(0, 80)}` };
  }
}

// mt-model-audit-fn reachability: fetch the live Ollama tag list from nxtbeast, same
// sync-curl/host-fallback/bounded-timeout shape as checkSearxngSight above (reused, not
// reinvented). On any fetch failure, callers skip the audit silently — never crash the sweep.
export function fetchOllamaTags({ probe } = {}) {
  try {
    const urls = [];
    if (process.env.OLLAMA_HOST) urls.push(process.env.OLLAMA_HOST.replace(/\/+$/, ''));
    urls.push('http://nxtbeast:11434');
    urls.push('http://100.103.44.13:11434');
    urls.push('http://localhost:11434');

    let lastError = null;
    for (const base of urls) {
      try {
        const body = probe ? probe() : _execSyncSight(
          `curl -s -m 8 "${base}/api/tags"`,
          { timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
        if (body && body.trim()) {
          const j = JSON.parse(body);
          const models = Array.isArray(j?.models) ? j.models.map((m) => ({ name: m.name, digest: m.digest })) : null;
          if (models) return { ok: true, models };
        }
      } catch (e) {
        lastError = e;
      }
    }
    return { ok: false, reason: lastError ? `probe failed: ${String(lastError?.message || lastError).slice(0, 80)}` : 'empty/unparseable response' };
  } catch (e) {
    return { ok: false, reason: `probe failed: ${String(e?.message || e).slice(0, 80)}` };
  }
}

// HEARTBEAT FLAG TABLE (mt-b2-flag-table, step B2): each row both classifies heartbeat lines
// and emits its own flag once threshold is met — replaces the hand-coded per-class parser
// fields (thinkingBurn/cudaCrash) and their two hand-written flag-emitting if-blocks with one
// iterated definition point. EMPTY_CONTENT_THINKING and CUDA are byte-equivalent migrations
// (same regex intent, same threshold, same flagText); LOCAL_TIMEOUT/LOCAL_NETWORK are new.
export const HEARTBEAT_FLAG_TABLE = [
  {
    key: 'EMPTY_CONTENT_THINKING',
    regex: /(?=.*attempt-fail)(?=.*EMPTY_CONTENT_THINKING)/,
    threshold: T.THINKING_BURN_COUNT,
    flagText: (n) => `FLAG: ${n} EMPTY_CONTENT_THINKING failures in window — known quota-burn class (QUEUE: KIMI THINKING-BURN FIX)`,
  },
  {
    key: 'CUDA',
    // CUDA-CLASS (2026-07-03, the self-healing-masking receipt: 155 gemma4:31b CUDA
    // illegal-memory-access crashes accumulated over 4 DAYS — every one healed-around
    // per-event, so no beat ever saw the pattern; the operator asked "why did gemma fail"
    // before any flag did. A heal that retries forever hides chronic degradation.)
    regex: /CUDA error/i,
    threshold: 1,
    flagText: (n) => `FLAG: ${n} CUDA error(s) in window — GPU-runner crash class; heals mask chronic degradation (155-over-4-days receipt 2026-07-03). Name the model, check the census (grep CUDA dispatch-heartbeat.log | count by model), escalate per the QUEUE watch-item conditions`,
    action: (logsDir) => ({ id: 'CUDA-CRASH-CLASS', class: 'judgment', approved_by_faith: false, read_first: [path.join(logsDir, 'dispatch-heartbeat.log')], rule: 'attribute the crash to a model via the census BEFORE any restart; one model at the VRAM edge is a roster/config call, every-model is an Ollama/driver call (ssh nxtbeast nvidia-smi + service restart at a lane boundary)' }),
  },
  {
    key: 'LOCAL_TIMEOUT',
    regex: /(?=.*provider=ollama-local)(?=.*attempt-fail)(?=.*kind=TIMEOUT)/,
    threshold: 3,
    flagText: (n) => `FLAG: ${n} local TIMEOUT failures (provider=ollama-local) in window — local lane instability class`,
  },
  {
    key: 'LOCAL_NETWORK',
    regex: /(?=.*provider=ollama-local)(?=.*attempt-fail)(?=.*kind=NETWORK)/,
    threshold: 3,
    flagText: (n) => `FLAG: ${n} local NETWORK failures (provider=ollama-local) in window — local lane instability class`,
  },
];

// heartbeat tail parsing: timestamped attempt lines from seat_dispatch.
function parseHeartbeats(text, now) {
  const lines = text.split(/\r?\n/).filter(Boolean).slice(-300);
  const within = [];
  for (const l of lines) {
    const ts = Date.parse(l.slice(0, 24));
    if (Number.isFinite(ts) && now - ts <= T.HB_WINDOW_MS) within.push({ ts, l });
  }
  const last = lines.length ? lines[lines.length - 1] : '';
  const flags = {};
  for (const row of HEARTBEAT_FLAG_TABLE) flags[row.key] = within.filter((x) => row.regex.test(x.l));
  return {
    lastLine: last,
    lastAgeMs: last ? age(last.slice(0, 24), now) : Infinity,
    claudeTier: within.filter((x) => /provider=claude-/.test(x.l)),
    rateLimited: within.filter((x) => /HTTP_429/.test(x.l)),
    flags,
  };
}

// CG repo freshness: minutes since the last v3 commit (fail-open: a missing repo or
// git error never breaks the sweep — it just can't demand increments).
export function checkCgFreshness(now = Date.now()) {
  try {
    const ts = parseInt(_execSyncSight('git -C "N:\\CGSports" log -1 --format=%ct', { timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim(), 10) * 1000;
    return Number.isFinite(ts) ? { ok: true, minutes: Math.round((now - ts) / 60000) } : { ok: false };
  } catch { return { ok: false }; }
}

// WORKTREE-HEAL (succession build 2026-07-02): the shared muddytires code-repo worktree
// gets left dirty/unmerged by a failed or interrupted cherry-pick, and then EVERY later
// code-repo mission fails its clean-worktree preflight ("map.html is unmerged"). Hand-fixed
// 3x in one night (fix-ledger: worktree-dirty-cascade / -orphaned-cherrypick / -unmerged) —
// pattern-amortization-signal.md says N same-shape fixes => build the helper. This drains that
// recovery judgment into the script so a LOCAL conductor never has to reason about git internals.
// Scoped to the KNOWN shared repo(s) below (not every mission's REPO-ROOT — bounded + safe).
const WORKTREE_REPOS = ['C:/Users/marka/code/mt-integration-2026-06-22'];

// detectWorktreeCorruption(repoRoot, gitFn) -> { corrupted, unmerged:[], staged:[], untracked:[], midOp }
// gitFn(args) runs a git command in the repo and returns stdout (injectable for tests).
// PURE: no mutation, only `git status --porcelain` + existence of a mid-op sentinel file.
// Classes that block a code-repo mission's clean-worktree preflight:
//   - unmerged (UU/AA/DD/*U*): conflict residue -> heal = checkout HEAD (restore committed)
//   - staged-uncommitted (index char A/M/D/R/C, not unmerged): failed-mission orphan added to
//     the index but never committed (the exact photo-upload-ux 2026-07-02 failure the first
//     WORKTREE-HEAL missed) -> heal = git reset -- <file> (UNSTAGE only; file survives as
//     untracked, never deleted). Safe here because this is a dedicated integration worktree
//     where the engine commits on success, so staged-uncommitted is always orphan residue.
//   - untracked (??): report-only, never auto-touched.
export function detectWorktreeCorruption(repoRoot, gitFn) {
  const git = gitFn || ((args) => _execSyncSight(`git -C "${repoRoot}" ${args}`, { timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }).toString());
  const out = { repoRoot, corrupted: false, unmerged: [], staged: [], untracked: [], midOp: null };
  let porcelain;
  try { porcelain = git('status --porcelain'); } catch { return out; }   // repo unreachable -> not our problem to heal
  for (const line of String(porcelain).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const xy = line.slice(0, 2);
    const x = xy[0];   // index (staged) position
    const file = line.slice(3).trim();
    // unmerged states per git porcelain: DD AU UD UA DU AA UU (any 'U', or AA/DD)
    if (/[U]/.test(xy) || xy === 'AA' || xy === 'DD') out.unmerged.push(file);
    else if (xy === '??') out.untracked.push(file);
    // staged-but-uncommitted: index char is a real change (A/M/D/R/C) and not an unmerged combo
    else if ('AMDRC'.includes(x)) out.staged.push(file);
  }
  // mid-operation sentinels (an aborted/partial pick leaves these; their presence + unmerged = stuck)
  try { if (existsSync(path.join(repoRoot, '.git', 'CHERRY_PICK_HEAD'))) out.midOp = 'cherry-pick'; } catch { /* ignore */ }
  try { if (!out.midOp && existsSync(path.join(repoRoot, '.git', 'MERGE_HEAD'))) out.midOp = 'merge'; } catch { /* ignore */ }
  out.corrupted = out.unmerged.length > 0 || out.staged.length > 0 || out.midOp !== null;
  return out;
}

// DONENESS GATE (anti-false-victory / anti-premature-quit root fix, 2026-07-02, operator-directed
// after two false-victory failures this session: (a) the CONDUCTOR proposed "wind down" on a
// render-check proxy while 26 commits sat unpushed and the chain hadn't verified e2e; (b) the CHAIN
// marked poi-tags/poi-services retros DONE while their commits sat on unmerged feature branches,
// never reaching the deployable HEAD). ROOT CAUSE: no MECHANICAL, receipt-checkable definition of
// "done" that verifies the deliverable actually reached the shipped ref — so everyone declares
// victory on a proxy (a DONE label, a rendering page, a stale branch). This computes the TRUE
// completion state from receipts so a conductor (esp. a local model) SEES it every beat and the
// stop-hook can BLOCK any wind-down framing until it is genuinely met (the hook reads THIS receipt,
// not the conductor's prose — so "done" cannot be uttered into existence).
//
// PURE: reads + git (a read) only; NEVER writes (the doneness.json write lives in main()/heal()).
// FAIL-CLOSED: any completion fact not determinable from receipts => a blocking entry (never assume done).
// gitFn(repo, argstr) -> {ok, out}: injected so the selftest runs offline.
const MT_REPO_DEFAULT = 'C:/Users/marka/code/mt-integration-2026-06-22';
export function computeDoneness(base, autorun, {
  targetRepo = MT_REPO_DEFAULT, mainlineRef = null, now = Date.now(), owed = [], patchScan = 300,
  gitFn = (repo, argstr) => { try { return { ok: true, out: execSync(`git -C "${repo}" ${argstr}`, { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).toString() }; } catch { return { ok: false, out: '' }; } },
} = {}) {
  const blocking = [];
  // AUDIT FIX 2026-07-02: leading \b on each keyword — without it "UNRESOLVED" matched /RESOLVED\b/
  // and a mission honestly annotated "still UNRESOLVED" was silently treated as closed (inverted meaning).
  const closed = (note) => /FIX:\s*none\b|\bSUPERSEDED\b|\bRESOLVED\b|\bDUPLICATE-RETIRED\b/i.test(String(note || ''));
  const done = autorun.done || [], failed = autorun.failed || [], pending = autorun.pending || [], running = autorun.running || [];
  const doneStems = new Set(done.map(stemOf));

  // ---- FRONTIER: any in-flight or unreconciled work => not done ----
  const unresolvedFailed = failed.filter((f) => !closed(autorun.notes?.[f]));
  let openIntegration = 0;
  for (const d of done) {
    const mfile = path.join(base, d.replace(/\//g, path.sep));
    if (!existsSync(mfile)) continue;
    for (const t of [...readText(mfile).matchAll(/^ON-DONE:\s*(missions\/\S+?\.mission\.txt)/gim)]) {
      if (!doneStems.has(stemOf(t[1]))) openIntegration++;
    }
  }

  // ---- L3 PUSHED: commits on the deployable HEAD not yet on the pushed mainline ----
  // ROOT FIX 2026-07-02: mainlineRef was hard-coded 'github/master', which turned out to be a STALE
  // side-branch (the worktree actually tracks github/main). A wrong ref made pushGap report a false
  // number AND hid a real main/master DIVERGENCE (27 commits looked unpushed vs master while main had
  // diverged separately). Detect the ACTUAL tracked upstream; and flag main/master divergence so it
  // can never silently recur.
  if (!mainlineRef) { const up = gitFn(targetRepo, 'rev-parse --abbrev-ref @{u}'); mainlineRef = (up.ok && up.out.trim()) ? up.out.trim() : 'github/master'; }
  let pushedGap = null;
  const rg = gitFn(targetRepo, `rev-list --count ${mainlineRef}..HEAD`);
  if (rg.ok && /^\d+$/.test(rg.out.trim())) pushedGap = parseInt(rg.out.trim(), 10);
  if (pushedGap === null) blocking.push({ layer: 'L3', mission: '(repo)', reason: `cannot determine pushed-gap vs ${mainlineRef} — fail-closed` });
  else if (pushedGap > 0) blocking.push({ layer: 'L3', mission: '(repo)', reason: `${pushedGap} commit(s) on HEAD are NOT pushed to ${mainlineRef}` });
  // DIVERGENCE GUARD: two mainline branches out of sync is the exact bug that stranded the 27 commits.
  // FAIL-CLOSED on git error (hunt-item #19, 2026-07-04): this guard used to fail OPEN -- a git
  // error left div.ok:false and the `if` simply never fired, so a broken/absent divergence check
  // silently reported nothing, unlike the pushedGap check 3 lines above which already fails closed
  // on the same class of error. Mirrors that exact pattern.
  const div = gitFn(targetRepo, 'rev-list --count github/main...github/master');
  let divergenceCount = null;
  if (div.ok && /^\d+$/.test(div.out.trim())) divergenceCount = parseInt(div.out.trim(), 10);
  if (divergenceCount === null) blocking.push({ layer: 'L3', mission: '(repo)', reason: 'cannot determine github/main vs github/master divergence — fail-closed' });
  else if (divergenceCount > 0) blocking.push({ layer: 'L3', mission: '(repo)', reason: `github/main and github/master DIVERGED by ${divergenceCount} commit(s) — reconcile to one canonical mainline` });

  // ---- L4 DEPLOY-FRESHNESS: landed+pushed is NOT live until deployed (muddytires ships via manual
  // `wrangler pages deploy`, not git auto-deploy). ROOT FIX 2026-07-02: the roadside_oddity popup fix
  // (the #1 user complaint) sat landed+pushed but UNDEPLOYED — invisible to users AND to this gate,
  // which stopped at L3. A last-deployed marker (missions/_logs/last-deployed.json, stamped by
  // `--record-deploy` right after a real deploy) makes "in repo but not live" a tracked frontier item.
  // Fail-closed when the marker is missing or its sha is unknown to the repo: unknown deploy state
  // is not done. This is the mechanical completion of "done = deployed", the twin of the L3 push check.
  let deployGap = null, deployedSha = null;
  const mkPath = path.join(base, 'missions', '_logs', 'last-deployed.json');
  if (existsSync(mkPath)) { try { deployedSha = String(JSON.parse(readText(mkPath)).sha || '').trim() || null; } catch { deployedSha = null; } }
  if (!deployedSha) blocking.push({ layer: 'L4', mission: '(repo)', reason: 'no last-deployed marker — production freshness UNKNOWN (fail-closed; run --record-deploy after a wrangler deploy)' });
  else {
    const rd = gitFn(targetRepo, `rev-list --count ${deployedSha}..HEAD`);
    if (rd.ok && /^\d+$/.test(rd.out.trim())) { deployGap = parseInt(rd.out.trim(), 10); if (deployGap > 0) blocking.push({ layer: 'L4', mission: '(repo)', reason: `${deployGap} commit(s) landed but NOT deployed to production (last deploy @ ${deployedSha.slice(0, 8)}) — run wrangler pages deploy` }); }
    else blocking.push({ layer: 'L4', mission: '(repo)', reason: `deploy marker sha ${deployedSha.slice(0, 8)} not found in repo — stale/invalid marker, fail-closed` });
  }

  // ---- L0/L1/L3 DEPTH: each DONE deliverable actually landed in the deployable tree ----
  // patch-id table of HEAD, computed ONCE (a cherry-picked deliverable lands under a NEW sha, so
  // is-ancestor of the source is always false — patch-id is what actually detects landing).
  const tbl = gitFn(targetRepo, `log -p -${patchScan} | git patch-id`);
  const headPids = new Set((tbl.ok ? tbl.out : '').split(/\r?\n/).map((l) => l.trim().split(/\s+/)[0]).filter(Boolean));
  const pidOf = (sha) => { const r = gitFn(targetRepo, `show ${sha} | git patch-id`); return r.ok ? (r.out.trim().split(/\s+/)[0] || null) : null; };

  let doneChecked = 0;
  for (const d of done) {
    const stem = stemOf(d);
    const mfile = path.join(base, d.replace(/\//g, path.sep));
    if (!existsSync(mfile)) continue;
    const mtext = readText(mfile);
    if (!(/MISSION-CLASS:\s*(code-repo|ops-deploy)/i.test(mtext) || /^mt-integrate-/.test(stem))) continue; // deliverable class only
    // CONDUCTOR-RESOLVED EXEMPTION (2026-07-02): a DONE mission the conductor RESOLVED out-of-band
    // (hand-apply / fix-ledger / superseded) has a STALE result.json — the earlier failed chain
    // attempt — so the AUTORUN note, not result.json, is the current truth. Reuse the same `closed`
    // regex the FAILED bucket trusts. The repo-level L3 (pushed) + divergence guard still apply
    // GLOBALLY, and any DONE mission WITHOUT such an annotation is still fully L0/L3-checked — so this
    // does not re-open "trust the label": only an explicit RESOLVED/SUPERSEDED/hand-apply note exempts.
    if (closed(autorun.notes?.[d])) continue;
    doneChecked++;
    const res = readJson(path.join(base, 'missions', stem + '.mission.result.json'));
    if (res && (res.phase === 'split' || res.split === true)) { blocking.push({ layer: 'L1', mission: stem, reason: 'DONE marks a SPLIT parent — its leaves are the deliverable' }); continue; }
    // LANDED = the declared ALLOW-FILES are present in the mission's OWN repo (ground truth). This is
    // the precision fix (2026-07-02): checking result.json + "any source sha in HEAD" false-flagged
    // missions whose deliverable FILES are present but whose result.json was stale (conductor-direct)
    // or which merely REFERENCE a sha (crown-legal.S2, engine-visual-capture) — while it still catches
    // genuine strands (lighthouse-post-indexes: 0 of 11 ALLOW-FILES present).
    const repoRoot = ((mtext.match(/REPO-ROOT:\s*(\S.*?)\s*$/im) || [])[1] || targetRepo).replace(/\\/g, '/');
    const afBlock = (mtext.match(/ALLOW-FILES:\s*\r?\n((?:[ \t]*-[ \t]+\S.*\r?\n?)+)/i) || [])[1] || '';
    const allowFiles = [...afBlock.matchAll(/^[ \t]*-[ \t]+(\S+)/gm)].map((x) => x[1]).filter((p) => /\.\w+$/.test(p));
    if (allowFiles.length) {
      const absent = allowFiles.filter((af) => { try { return !existsSync(path.join(repoRoot, af)); } catch { return true; } });
      if (absent.length > 0) {
        blocking.push({ layer: 'L3', mission: stem, reason: `DONE but ${absent.length}/${allowFiles.length} deliverable ALLOW-FILES absent (${absent.slice(0, 2).join(', ')}${absent.length > 2 ? '…' : ''}) — stranded / not integrated` });
        continue;
      }
      // AUDIT FIX 2026-07-02 (recall regression): presence alone used to short-circuit here — but a
      // mission that MODIFIES pre-existing files (the dominant class: map.html etc.) trivially has all
      // ALLOW-FILES "present" even when its change sits stranded on a feature branch — the EXACT
      // poi-tags false-DONE class this gate was built to catch. Presence AND landed: when the mission
      // names source shas, the patch must also be in the deployable tree. No shas => presence stands
      // (nothing more determinable mechanically).
      const presShas = extractSourceShas(mtext);
      if (presShas.length) {
        let anyDet = false, isLanded = false;
        for (const s of presShas) { const pid = pidOf(s); if (pid) { anyDet = true; if (headPids.has(pid)) { isLanded = true; break; } } }
        if (anyDet && !isLanded) { blocking.push({ layer: 'L3', mission: stem, reason: `DONE, ALLOW-FILES present, but deliverable patch [${presShas.map((x) => x.slice(0, 7)).join(',')}] NOT in the deployable tree — files pre-existed; the change is stranded` }); }
      }
      continue;
    }
    // no parseable ALLOW-FILES: fall back to result.json (L0) + patch-id (L3).
    if (!res) { blocking.push({ layer: 'L0', mission: stem, reason: 'DONE but no result.json + no ALLOW-FILES' }); continue; }
    if (!(res.ok === true && res.phase === 'done')) { blocking.push({ layer: 'L0', mission: stem, reason: `result not ok/done (ok=${res.ok} phase=${res.phase})` }); continue; }
    const shas = extractSourceShas(mtext);
    if (!shas.length) continue;
    let anyDeterminable = false, landed = false;
    for (const s of shas) { const pid = pidOf(s); if (pid) { anyDeterminable = true; if (headPids.has(pid)) { landed = true; break; } } }
    if (anyDeterminable && !landed) blocking.push({ layer: 'L3', mission: stem, reason: `DONE but deliverable patch [${shas.map((x) => x.slice(0, 7)).join(',')}] not in the deployable tree` });
  }

  const counts = { pending: pending.length, running: running.length, unresolvedFailed: unresolvedFailed.length, dammOwed: owed.length, openIntegration, pushedGap, divergenceCount, deployGap, doneDeliverablesChecked: doneChecked, blocking: blocking.length };
  const frontierClean = pending.length === 0 && running.length === 0 && unresolvedFailed.length === 0 && owed.length === 0 && openIntegration === 0;
  const barMet = frontierClean && blocking.length === 0;
  return { ts: new Date(now).toISOString(), barMet, counts, blocking: blocking.slice(0, 60), frontierClean };
}

export function sweep(base = HERE, now = Date.now(), routeFile = path.join(process.env.USERPROFILE || 'C:/Users/marka', '.claude', 'state', 'muezzin-route.json'), { sightFn = checkSearxngSight, cgAgeFn = () => checkCgFreshness(now), worktreeReposFn = () => WORKTREE_REPOS, gitFn = null, modelTagsFn = fetchOllamaTags } = {}) {
  const logs = path.join(base, 'missions', '_logs');
  const status = readJson(path.join(logs, 'daemon-status.json'));
  const pidfile = parseInt(readText(path.join(logs, 'daemon.pid')).trim(), 10);
  const autorun = parseAutorun(readText(path.join(base, 'missions', 'AUTORUN.md')));
  const hb = parseHeartbeats(readText(path.join(logs, 'dispatch-heartbeat.log')), now);
  const statusAge = status ? age(status.ts, now) : Infinity;
  const daemonAlive = Number.isInteger(pidfile) && pidfile > 0 && pidAlive(pidfile) && statusAge < T.STATUS_DEAD_MS;

  const report = [];
  const actions = [];

  report.push(`CONDUCT-CYCLE ${new Date(now).toISOString()}`);
  // QUEUE.md VISIBILITY (hunt-item #21, 2026-07-04): the sweep literally never read QUEUE.md
  // at all (grep confirmed zero references) despite STATE.md telling every conductor "the
  // script reads everything you need" -- deferred prose conditions written there (UNPARKS
  // triggers the operator and past conductors wrote down) were invisible to any conductor who
  // trusted the sweep over reading QUEUE.md by hand. Report-only, NOT a required action: an
  // UNPARKS condition being present does not mean it's currently MET (that needs the actual
  // check named in its own text, e.g. a real Test-Path on a drive letter) -- making every one
  // of these a blocking action regardless of whether its trigger fired would manufacture noise
  // every beat, the opposite of this session's own discipline. This closes the literal
  // complaint (the sweep is no longer BLIND to their existence) without overclaiming judgment
  // it cannot perform.
  try {
    const queueText = readText(path.join(base, 'missions', 'QUEUE.md'));
    const unparksCount = (queueText.match(/\bUNPARKS\b/g) || []).length;
    if (unparksCount > 0) report.push(`QUEUE.md: ${unparksCount} UNPARKS condition(s) on record — review missions/QUEUE.md for whether any have actually fired (not auto-checked here; conductor judgment)`);
  } catch { /* QUEUE.md read is best-effort visibility, never breaks the sweep */ }
  report.push(daemonAlive
    ? `daemon: UP (PID ${pidfile}, status ${mins(statusAge)}m fresh) — lanes ${status.lanes.length}, queued ${status.queued}`
    : `daemon: DEAD or HUNG (pidfile=${pidfile || 'none'}, pid-alive=${Number.isInteger(pidfile) ? pidAlive(pidfile) : false}, status age ${mins(statusAge)}m)`);
  if (!daemonAlive) {
    // SUPERVISOR-HALTED (hunt-item #3, 2026-07-04): daemon-supervisor.ps1 writes
    // supervisor-halted.txt and stops restarting after 5+ deaths in 10 minutes -- a silent
    // terminal state until now: no push, and this sweep never checked for it, so a dead
    // daemon from a halted supervisor looked identical to an ordinary single stale-heartbeat
    // death. Blindly restarting after a halt repeats whatever crash-looped it in the first
    // place; the right first move is diagnosing daemon-stderr.log, not restarting again.
    const haltMarker = path.join(logs, 'supervisor-halted.txt');
    const haltText = existsSync(haltMarker) ? readText(haltMarker).trim() : '';
    if (haltText) {
      report.push(`SUPERVISOR-HALTED: ${haltText}`);
      actions.push({
        id: 'SUPERVISOR-HALTED', class: 'judgment', approved_by_faith: true,
        why: `daemon-supervisor.ps1 gave up after repeated crash-looping and wrote ${haltMarker} -- read_first: missions/_logs/daemon-stderr.log (the death evidence, appended not truncated) before restarting; a blind restart repeats the same crash-loop the supervisor already tried 5+ times`,
        command: RESTART_CMD,
        verify: `daemon-status.json ts becomes fresh + 'daemon UP' line in ${path.join(logs, 'daemon-events.log')} + supervisor-halted.txt removed (the supervisor script clears it on next start)`,
      });
    } else {
      actions.push({
        id: 'RESTART-DAEMON', class: 'mechanical', approved_by_faith: true,
        why: `status heartbeat ${mins(statusAge)}m old (limit 5m) or PID dead — singleton makes restart safe; RUNNING lanes revert and refire`,
        command: RESTART_CMD,
        verify: `daemon-status.json ts becomes fresh + 'daemon UP' line in ${path.join(logs, 'daemon-events.log')}`,
      });
    }
  }

  // lanes + stall detection: a lane is stalled when the GLOBAL dispatch heartbeat has
  // gone quiet past the stall window while lanes claim to be running.
  if (daemonAlive && status.lanes.length) {
    for (const lane of status.lanes) report.push(`lane: ${typeof lane === 'string' ? lane : (lane?.path || String(lane))}`);
    if (hb.lastAgeMs > T.LANE_STALL_MS) {
      report.push(`STALL FLAG: last dispatch heartbeat ${mins(hb.lastAgeMs)}m ago with ${status.lanes.length} lanes running (limit ${mins(T.LANE_STALL_MS)}m)`);
      actions.push({
        id: 'DIAGNOSE-STALL', class: 'judgment', approved_by_faith: false,
        why: `lanes claim running but no dispatch attempt for ${mins(hb.lastAgeMs)}m — working and hung are indistinguishable without receipts`,
        read_first: [path.join(logs, 'dispatch-heartbeat.log'), path.join(logs, 'daemon-events.log')],
        rule: 'restart ONLY if heartbeat tail shows no in-flight attempt; an in-flight long call is work, not a hang',
      });
    }
  }

  // STUCK-TASK detection: a lane that has been RUNNING longer than TASK_STUCK_MS is
  // mechanically hung. The faith approves killing it and requeuing the task.
  // ROOT FIX 2026-07-02 (daemon suicide loop, live receipt: 33452 self-killed 18:09:36 mid-lane,
  // spot-share-card refired and headed for the same kill): legitimate plan-phase seat calls take
  // 14-16 min (heartbeat: 171s single calls, 4800s timeouts armed) — LONGER than TASK_STUCK_MS.
  // The STALL rule above already knew "an in-flight long call is work, not a hang"; STUCK-TASK
  // now honors the same heartbeat: a kill fires ONLY when the heartbeat is quiet past the
  // threshold AND no attempt is in flight. Otherwise the lane is WORKING and the kill would
  // destroy the seat's in-flight work, reset the attempt, and loop forever.
  const stuckLanes = detectStuckLanes(status, now);
  // exec-start with no exec-ok/exec-fail after it = an engine-exec is IN FLIGHT (2026-07-03,
  // LONG-RUN class: a legitimate 900s-cap exec goes heartbeat-quiet for up to 15m; it
  // self-terminates at its own cap, so it never needs a kill — same law as a long seat call).
  const hbInFlight = /attempt-start|exec-start/.test(hb.lastLine || '');
  const hbWorking = hb.lastAgeMs < T.TASK_STUCK_MS || hbInFlight;
  if (stuckLanes.length && hbWorking) {
    report.push(`STUCK-CANDIDATE suppressed: ${stuckLanes.length} lane(s) past ${mins(T.TASK_STUCK_MS)}m but heartbeat is ${hbInFlight ? 'IN-FLIGHT' : `${mins(hb.lastAgeMs)}m fresh`} — a long seat call/exec is work, not a hang (no kill)`);
  } else if (stuckLanes.length) {
    for (const sl of stuckLanes) report.push(`STUCK-TASK: ${sl.path} stuck for ${mins(sl.ageMs)}m (limit ${mins(T.TASK_STUCK_MS)}m)`);
    // KILL-SCOPE HONESTY (hunt-item #3's second half, GAP-CLOSURE-PLAYBOOK UNIT E4, 2026-07-04):
    // missions run IN-PROCESS (no per-mission subprocess to target), so this taskkill ALWAYS
    // hits the daemon's own whole PID -- with MAX_LANES=2 (the default), a stuck lane's kill
    // collaterally destroys any OTHER lane's genuinely healthy in-flight work too, silently,
    // with no warning that this is happening. Name the collateral lanes explicitly so a
    // conductor reading the action knows the real blast radius before approving it, rather
    // than assuming "STUCK-TASK" only touches the one stuck lane it names.
    const stuckPaths = new Set(stuckLanes.map((x) => x.path));
    const collateralLanes = (Array.isArray(status?.lanes) ? status.lanes : [])
      .map((l) => (typeof l === 'string' ? l : l?.path)).filter(Boolean)
      .filter((p) => !stuckPaths.has(p));
    actions.push({
      id: 'STUCK-TASK', class: 'mechanical', approved_by_faith: true,
      why: `${stuckLanes.length} lane(s) RUNNING over ${mins(T.TASK_STUCK_MS)}m with a dead-quiet heartbeat (${mins(hb.lastAgeMs)}m, no in-flight attempt) — hung, not working; kill and requeue. KILL SCOPE: missions run in-process, so this taskkill hits the WHOLE daemon PID${collateralLanes.length ? ` — ${collateralLanes.length} OTHER lane(s) currently running (${collateralLanes.join(', ')}) will ALSO be killed and requeued, even though they are not stuck` : ' — no other lanes are currently running, so this kill is scoped to just the stuck lane in practice'}`,
      command: `taskkill /PID ${status?.pid ?? pidfile} /F /T`,
      stuck_paths: stuckLanes.map((x) => x.path),
      collateral_paths: collateralLanes,
      rule: 'heal() will kill the process tree and bare the RUNNING lines so the daemon re-fires them; logged to daemon-events.log',
    });
  }

  // WORKTREE-HEAL: a shared code-repo worktree left unmerged/mid-pick blocks EVERY code-repo
  // mission's clean-worktree preflight. Surgical recovery only — abort any in-progress pick/
  // merge, then restore each TRACKED unmerged file from HEAD (discards uncommitted conflict
  // residue = failed-mission orphan, per the engine's commit-on-success model). NEVER reset
  // --hard, NEVER delete untracked (those are report-only). heal() runs it via exec().
  // LIVE-LANE SUPPRESSION (2026-07-03, same law as STUCK-CANDIDATE: work is not a hang):
  // porcelain cannot distinguish a RUNNING mission's own staged work (a step-1
  // `git checkout <sha> -- file` restore STAGES the file) from a failed-mission orphan.
  // Receipt: 13:48Z sweep flagged mt-mobile-qc-hardening.S1.S1's in-flight catalog restore
  // as "1 staged-orphan" and queued a reset that would have destroyed the live lane's work.
  // A repo that is any RUNNING lane's REPO-ROOT is never healed — reported suppressed,
  // re-checked next beat once the lane ends (orphans persist; live work does not).
  const liveRepoRoots = new Set();
  const laneMissions = new Set([
    ...(autorun.running || []),
    ...((status?.lanes || []).map((l) => (typeof l === 'string' ? l : l?.path)).filter(Boolean)),
  ]);
  for (const m of laneMissions) {
    const mtext = readText(path.join(base, String(m).replace(/\//g, path.sep)));
    const rr = (mtext.match(/^REPO-ROOT:\s*(\S.*?)\s*$/im) || [])[1];
    if (rr) liveRepoRoots.add(rr.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase());
  }
  for (const repoRoot of (worktreeReposFn() || [])) {
    const wt = detectWorktreeCorruption(repoRoot, gitFn ? (args) => gitFn(repoRoot, args) : null);
    if (!wt.corrupted) continue;
    if (liveRepoRoots.has(String(repoRoot).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase())) {
      report.push(`WORKTREE-HEAL suppressed: ${repoRoot} is a RUNNING lane's REPO-ROOT — staged/dirty state is the live mission's own in-flight work, not corruption (no heal while the lane runs; re-checked next beat)`);
      continue;
    }
    report.push(`WORKTREE-HEAL: ${repoRoot} is corrupted — ${wt.unmerged.length} unmerged, ${wt.staged.length} staged-orphan${wt.midOp ? `, mid-${wt.midOp}` : ''}${wt.untracked.length ? `, ${wt.untracked.length} untracked` : ''}`);
    const cmds = [];
    if (wt.midOp) cmds.push(`git -C "${repoRoot}" ${wt.midOp === 'merge' ? 'merge' : 'cherry-pick'} --abort`);
    for (const f of wt.unmerged) cmds.push(`git -C "${repoRoot}" checkout HEAD -- "${f}"`);
    for (const f of wt.staged) cmds.push(`git -C "${repoRoot}" reset -q -- "${f}"`);   // UNSTAGE only — file survives as untracked, never deleted
    actions.push({
      id: `WORKTREE-HEAL-${path.basename(repoRoot)}`, class: 'mechanical', approved_by_faith: true,
      why: `shared worktree ${repoRoot} left ${wt.midOp ? `mid-${wt.midOp} + ` : ''}${wt.unmerged.length} unmerged + ${wt.staged.length} staged-orphan file(s) — blocks every code-repo mission's clean-worktree preflight until restored`,
      repo_root: repoRoot,
      commands: cmds,                                   // surgical recovery, run in order by heal()
      staged_orphans: wt.staged,
      untracked_orphans: wt.untracked,                  // REPORT ONLY — heal() never deletes these
      rule: 'heal() aborts any in-progress pick/merge, restores each unmerged tracked file from HEAD (committed content preserved, conflict residue discarded), and UNSTAGES each staged orphan (git reset -- ; file kept as untracked, never deleted). Untracked orphans surfaced, never auto-deleted (needs operator ok).',
    });
  }

  // FAILED missions: never refire blind — diagnosis paths are pre-named.
  // SELF-HEAL RULE (operator, 2026-06-10 "why did you wait for me to ask"): a FAILED
  // annotation that NAMES a conductor-performable fix is an ORDER, not a label — the
  // sweep itself puts the fix in front of whatever model holds the seat. Diagnosed
  // blocks awaiting an ENGINE capability are the only legitimate parked state.
  for (const f of autorun.failed) {
    const stem = path.basename(f).replace(/\.mission\.txt$/i, '');
    const note = autorun.notes[f] || '';
    const namedFix = (note.match(/FIX:\s*([^.;]{5,200})/i) || note.match(/split into\s+([^.;]{5,160})/i) || [])[1];
    const parkedOnEngine = /engine batch|engine 0\.\d|pending .*(engine|batch)/i.test(note);
    // CLOSED state (2026-06-11 beat receipt: 'FIX: none needed — SUPERSEDED' was captured
    // as a performable fix and re-ordered every beat — the sweep had no way to say
    // "judged, resolved, nothing to perform". Third annotation-wording contortion in an
    // hour = the state was missing, not the wording — pattern-amortization canon.)
    const closed = /FIX:\s*none\b|\bSUPERSEDED\b|\bRESOLVED\b|\bDUPLICATE-RETIRED\b/i.test(note);  // \b-led: "UNRESOLVED" must not close (audit 2026-07-02)
    report.push(`FAILED on ledger: ${f}${note ? ` — ${note.slice(0, 90)}` : ''}`);
    if (closed) {
      report.push(`  closed (superseded/resolved, no action): ${stem}`);
    } else if (namedFix) {
      actions.push({
        id: `PERFORM-NAMED-FIX-${stem}`, class: 'judgment', approved_by_faith: true,
        why: `the block annotation NAMES the fix — performing it is REQUIRED this beat (self-heal rule, operator 2026-06-10); sitting on a named fix is the violation`,
        fix: namedFix.trim(),
        rule: 'perform the named fix (split/stage/restructure), then requeue the fixed shape; never wait for the operator to ask',
      });
    } else if (parkedOnEngine) {
      report.push(`  parked on engine capability (legitimate): ${stem}`);
    } else {
      actions.push({
        id: `DIAGNOSE-${stem}`, class: 'judgment', approved_by_faith: false,
        why: 'FAILED x2 needs diagnosis from receipts, never a blind relaunch (conductor faith)',
        // real on-disk names, not guesses: the result file is `<stem>.mission.result.json`
        // (not `.result.json`), and the retro file carries a timestamp suffix
        // (`<stem>-<stamp>.md`), not a fixed `.retro.md` -- fixed 2026-07-01 after
        // autorun-verdict-gate.mjs's own evidence-candidate logic caught this drift.
        read_first: [
          path.join(base, 'missions', stem + '.mission.result.json'),
          ...(() => {
            const retroDir = path.join(logs, 'retro');
            try {
              return readdirSync(retroDir)
                .filter((f) => f.startsWith(`${stem}-`))
                .map((f) => path.join(retroDir, f));
            } catch { return []; }
          })(),
          path.join(base, 'missions', stem, 'mission-events.jsonl'),
        ].filter(existsSync),
        rule: 'diagnose, then annotate with FIX: <conductor-performable fix> OR "pending engine batch" OR "SUPERSEDED/RESOLVED: <why>" — a bare FAILED mark is not a finished judgment',
      });
    }
  }

  // PARKED-REVIVAL sweep (2026-07-02): parks are conditions, not verdicts — see
  // parkedRevivalDue(). One consolidated judgment item; judging = annotating the line
  // with `REVISIT-JUDGED <date>: <verdict>` (REVIVE-NOW / RETIRE-SUPERSEDED / STILL-BLOCKED),
  // which silences the item until a newer fix lands or the age window re-opens.
  const parkedDue = parkedRevivalDue(autorun, readFixLedger(base).entries);
  const parkedCensus = (autorun.parked || []).length;
  if (parkedCensus) report.push(`parked census: ${parkedCensus} PARKED line(s) on ledger — ${parkedDue.length} due for revisit`);
  if (parkedDue.length) {
    actions.push({
      id: 'REVISIT-PARKED', class: 'judgment', approved_by_faith: true,
      why: `${parkedDue.length} parked/blocked mission(s) have engine fixes landed AFTER their park date, an expired age window, or no date at all — a park whose revival condition is never re-checked is a graveyard, not a hold (operator, 2026-07-02)`,
      due: parkedDue.map((d) => `${d.path} [${d.kind}${d.ageDays != null ? `, ${d.ageDays}d old` : ', NO DATE'}${d.fixesSince.length ? `, fixes since: ${d.fixesSince.slice(0, 4).join('|')}` : ''}]`),
      rule: 'for each: re-read its park annotation + receipts against the CURRENT engine; verdict REVIVE-NOW (un-park/requeue), RETIRE-SUPERSEDED (name successor), or STILL-BLOCKED (name the unpark event); then stamp the line REVISIT-JUDGED <ISO-date>: <verdict> — silence is the only invalid outcome',
    });
  }

  // FALSE-DEATH SCAN (#25): unresolved FAILED code-repo marks whose deliverables are
  // byte-identical-landed at HEAD surface as a judgment item instead of rotting on the board.
  try {
    const fdGit = gitFn || ((repo, argstr) => { try { return { ok: true, out: execSync(`git -C "${repo}" ${argstr}`, { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).toString() }; } catch { return { ok: false, out: '' }; } });
    const fdc = falseDeathScan(autorun, base, { gitFn: fdGit });
    if (fdc.length) {
      report.push(`false-death scan: ${fdc.length} candidate(s) — FAILED marks whose work appears landed at HEAD`);
      actions.push({
        id: 'FALSE-DEATH-CANDIDATES', class: 'judgment', approved_by_faith: true,
        why: `${fdc.length} unresolved FAILED code-repo mission(s) have ALLOW-FILES ${fdc.some((c) => c.verdict === 'FULL') ? 'byte-identical-landed' : 'partially landed'} at HEAD — a FAILED mark contradicted by the repo is a false death (receipt class: 9 of 13 sampled were false, 2026-07-02 hunt)`,
        candidates: fdc.map((c) => `${c.path} [${c.verdict}${c.srcSha ? ' vs ' + c.srcSha : ''}: ${Object.entries(c.files).map(([k, v]) => path.basename(k) + '=' + v).join(' ')}]`),
        rule: 'verify each candidate from the repo (merge-base/byte receipts), then annotate the line RESOLVED-LANDED (+ tartib-readable # RESOLVED twin) or FALSE-DEATH-JUDGED: GENUINE <why> — never leave a candidate bare (PARTIAL = check the wiring/hunk the sweep names as differing/absent before judging; S2/verify-class missions whose ALLOW-FILES mirror their S1 are EXECUTION work — file identity proves nothing, judge from their own Done-means)',
      });
    }
  } catch { /* scan is advisory — a git hiccup must never break the sweep */ }

  // BANKED-DELIVERABLES (#27): dead missions' sandboxes holding real artifacts surface as
  // judgment; stamped SALVAGE-JUDGED lines stay quiet.
  try {
    const banked = bankedDeliverables(autorun, base);
    if (banked.length) {
      report.push(`banked deliverables: ${banked.length} dead-mission sandbox(es) hold substantive unsurfaced artifacts`);
      actions.push({
        id: 'BANKED-DELIVERABLES', class: 'judgment', approved_by_faith: true,
        why: `${banked.length} unresolved FAILED/PARKED mission(s) carry >=5KB artifacts no mechanism will ever surface (receipt class: ~200KB verified buried incl. operator-focus research, hunt 2026-07-02)`,
        banked: banked.map((b) => `${b.stem}: ${b.artifacts.map((a) => `${a.name} (${Math.round(a.bytes / 1024)}KB)`).join(', ')}`),
        rule: 'for each: READ the top artifact; if operator-valuable, surface it (OPERATOR-REVIEW-QUEUE BANKED-SALVAGE row or notify with the path) and stamp the ledger line SALVAGE-JUDGED <ISO ts>: surfaced-at <where>; if not, stamp SALVAGE-JUDGED <ISO ts>: worthless-because <why> — an unjudged sandbox artifact is an unfinished FAILED judgment',
      });
    }
  } catch { /* advisory — never breaks the sweep */ }

  // LOOP-CAP detection: a mission stem that appears LOOP_CAP_REPEATS or more times
  // across all AUTORUN statuses is a quota-burn loop and must be mechanically capped.
  const loopCaps = detectLoopCaps(autorun);
  if (loopCaps.length) {
    for (const lp of loopCaps) report.push(`LOOP-CAP: ${lp.stem} appears ${lp.count} times in AUTORUN (cap ${T.LOOP_CAP_REPEATS})`);
    actions.push({
      id: 'LOOP-CAP', class: 'mechanical', approved_by_faith: true,
      why: `${loopCaps.length} mission(s) appear ${T.LOOP_CAP_REPEATS}+ times in the ledger — a looping task must be capped, not allowed to burn quota indefinitely`,
      loop_stems: loopCaps.map((x) => x.stem),
      rule: 'operator must diagnose the root cause before requeue; heal() may retire duplicate lines beyond the cap',
    });
  }

  // REQUEUE-ON-FIX-LANDED: the other half of the faith rule "healing a class must
  // requeue the healed". For every fix-ledger entry not yet requeued, any named mission
  // that is CURRENTLY on the FAILED ledger becomes a mechanical requeue (faith-approved:
  // the explicit entry is the diagnosis, and `heal()` flips it once so it never loops).
  const ledger = readFixLedger(base);
  const failedStems = new Set(autorun.failed.map(stemOf));
  for (const e of ledger.entries) {
    if (e.requeued) continue;
    for (const item of (e.requeue || [])) {
      if (typeof item === 'object' && item.requeued) continue;   // mt-c3-perstem: this stem already requeued in a prior beat
      const s = requeueStemOf(item);
      if (!failedStems.has(s)) continue;
      // 2026-07-01 real incident: 10 of 19 stems fed to --record/--requeue this session
      // had mission.txt files already deleted (retired long before, for an unrelated
      // reason) -- the requeue fired anyway and wasted a cycle on FAILED(missing file).
      // A dead stem is not silently dropped here (no-silent-caps) -- it's named on the
      // report so the conductor sees it, then skipped rather than requeued.
      if (!existsSync(path.join(base, 'missions', `${s}.mission.txt`))) {
        report.push(`REQUEUE SKIPPED (file missing): ${s} — ledger entry names this stem but its mission.txt does not exist on disk; regenerate the mission file before requeuing`);
        continue;
      }
      actions.push({
        id: `REQUEUE-${s}`, class: 'mechanical', approved_by_faith: true,
        why: `fix landed (${e.fix || e.class}) — class '${e.class}' is healed; the faith requires requeuing the healed, ONCE`,
        requeue_stem: s, ledger_class: e.class,
        rule: 'bare the FAILED AUTORUN line so the daemon re-fires it fresh; the ledger entry is then marked requeued (once-only, never a blind loop)',
      });
    }
  }

  // CHAIN-ON-DONE (operator 2026-06-12: "why wasn't it auto-queued?" — quirky's data
  // landed and its integration half had NO mechanical pull; the conductor noticing at a
  // beat is willpower, not structure). A mission text may declare `ON-DONE:
  // missions/<x>.mission.txt`; when the declaring mission is DONE, the target is a
  // mechanical queue action — once-only: a target already ANYWHERE in AUTORUN (any
  // status) is never re-queued. The target still faces the miqat at fire time.
  const queuedAnywhere = new Set([...autorun.done, ...autorun.failed, ...autorun.running, ...autorun.pending, ...(autorun.parked || []), ...(autorun.split || [])].map(stemOf));
  for (const d of autorun.done) {
    const mfile = path.join(base, d.replace(/\//g, path.sep));
    if (!existsSync(mfile)) continue;
    const mtext = readText(mfile);
    const onDone = [...mtext.matchAll(/^ON-DONE:\s*(missions\/\S+?\.mission\.txt)/gim)].map((m) => m[1]);
    for (const target of onDone) {
      const tstem = stemOf(target);
      if (queuedAnywhere.has(tstem)) continue;
      if (!existsSync(path.join(base, target.replace(/\//g, path.sep)))) {
        report.push(`ON-DONE target missing on disk (declared by ${stemOf(d)}): ${target}`);
        continue;
      }
      actions.push({
        id: `CHAIN-${tstem}`, class: 'mechanical', approved_by_faith: true,
        why: `${stemOf(d)} is DONE and declares ON-DONE: ${target} — the follow-on is pulled into the queue by structure, not conductor willpower`,
        chain_target: target,
        rule: 'append the target line to AUTORUN (once-only: skipped when the target is already present in any status); the miqat judges it at fire time',
      });
    }
  }

  // DAMM ENFORCEMENT (reviewer catch 2026-06-11: "the damm queue silently becomes a
  // graveyard — Fiqh works because the penalty is ENFORCED"). The expiation queue gets
  // its own Arafat: every beat, unrepaid+unwaived damm entries are REQUIRED ACTIONS, and
  // a DONE mission with outstanding damm is reported as NOT fully reconciled. An entry
  // leaves the queue only by repayment (a receipted follow-up) or an explicit waiver
  // with a reason — never by being forgotten.
  // CG-INCREMENT GATE (operator 2026-06-11: "I just feel like you are not working on
  // cg unless I ask" — receipts agreed: v3 commits clustered around his check-ins. The
  // standing order "idle = CG" was willpower; this makes it a CONDITION the beat
  // confronts the conductor with mechanically. Prompts steer; code stops.)
  const cgAge = cgAgeFn();
  if (cgAge.ok && cgAge.minutes > 45) {
    report.push(`CG STALE: last v3 commit ${cgAge.minutes}m ago — the standing order is idle=CG, and the queue running is not the conductor being busy`);
    actions.push({
      id: 'CG-INCREMENT-DUE', class: 'judgment', approved_by_faith: true,
      why: `N:\\CGSports last commit ${cgAge.minutes}m ago (gate: 45m) — operator standing order: between-beat conductor time belongs to CGSports v3`,
      read_first: ['N:\\CGSports\\V3-ARCHITECTURE.md (the §2.5 manifest names the next lift)'],
      rule: 'land the next manifest increment (port/adapt/test/commit/push) before closing the beat — or state the genuine blocker on the board; silence is the violation',
    });
  }

  // SEARXNG SIGHT-CHECK (operator audit 2026-06-11: "how did our auto heal not catch
  // the SOTA search issue" — answer: the wedge produced ZERO receipts; cloud seats
  // absorb 'search failed' as prose, the preflight was unwired, Claude-tier masked it.
  // The healer can't heal what nothing witnesses, so the BEAT now witnesses it: a
  // control query that cannot honestly return empty. Wedged/blind -> a required action
  // with the exact fix that worked at 14:05 today.)
  const searxng = sightFn();
  if (!searxng.ok) {
    report.push(`SEARXNG BLIND/WEDGED: ${searxng.reason} — cloud-seat research is sightless until fixed`);
    actions.push({
      id: 'RESTART-SEARXNG', class: 'mechanical', approved_by_faith: true,
      why: `control query failed (${searxng.reason}) — a search backend that cannot find 'github' is blind, and blind search produces confident wrong research`,
      command: 'docker restart searxng',
      verify: 'rerun: node conduct-cycle.mjs (this check) — or curl "http://localhost:8080/search?q=github&format=json" returns results',
    });
  }

  // mt-model-audit-fn wiring: a shared-digest, textually-unrelated model group is an
  // identity-fraud candidate — verify against model_rijal.mjs before trusting any name in
  // it; per STATE.md's promoted rule, do not assert a model's lab, size, or history from a
  // tag name without this receipt. Skip silently on fetch failure — never crash the sweep.
  const modelTags = modelTagsFn();
  if (modelTags.ok) {
    const { fraudGroups } = auditModelIdentities(modelTags.models);
    for (const g of fraudGroups) {
      report.push(`MODEL-IDENTITY FLAG: digest ${g.digest.slice(0, 12)} is served under ${g.names.length} textually-unrelated names (${g.names.join(', ')}) — verify against model_rijal.mjs before trusting any name in this group; do not assert lab/size/history from a tag name without this receipt.`);
    }
  } else {
    report.push(`model-identity audit SKIP: nxtbeast unreachable (${modelTags.reason})`);
  }

  // WAIVER HARDENING (reviewer 2026-06-11: "waivers are where graveyards go to
  // reincarnate — if waiving is cheaper than repaying, the queue drains through the
  // side door"). A waiver counts ONLY when witnessed like the downgrade rule: it must
  // carry waive_reason AND waive_witness (who/what stood for it). An unwitnessed waiver
  // is STILL OWED. The waive rate is surfaced so a waive-everything pattern is visible.
  const dammQ = readJson(path.join(base, 'missions', '_logs', 'damm-queue.json'));
  const entries = dammQ?.entries || [];
  const validWaiver = (e) => e.waived && String(e.waive_reason || '').trim() && String(e.waive_witness || '').trim();
  const owed = entries.filter((e) => !e.repaid && !validWaiver(e));
  const waived = entries.filter(validWaiver);
  if (entries.length) report.push(`damm ledger: ${entries.filter((e) => e.repaid).length} repaid · ${waived.length} waived (witnessed) · ${owed.length} OWED of ${entries.length} — waive rate ${(waived.length / entries.length * 100).toFixed(0)}%`);
  if (owed.length) {
    report.push(`DAMM OWED: ${owed.length} unrepaid expiation(s) — DONE-with-damm missions are NOT fully reconciled until these clear`);
    for (const e of owed.slice(0, 6)) report.push(`  damm: [${e.mission}] ${String(e.finding).slice(0, 90)}`);
    actions.push({
      id: 'REPAY-DAMM', class: 'judgment', approved_by_faith: true,
      why: `${owed.length} damm entr(ies) outstanding — an unenforced penalty is a graveyard, not an expiation (fiqh: the damm is OWED)`,
      read_first: [path.join(base, 'missions', '_logs', 'damm-queue.json')],
      rule: 'for each entry: queue the compensating micro-mission (then set repaid:true with the mission ref) OR waive with {waived:true, waive_reason, waive_witness} — an unwitnessed waiver is STILL OWED; silence is not an option',
    });
  }

  // DONE missions: verification is a deed — name the sandbox to check, never trust the mark.
  for (const d of autorun.done) {
    const stem = path.basename(d).replace(/\.mission\.txt$/i, '');
    const sandbox = path.join(base, 'missions', stem);
    if (existsSync(sandbox)) report.push(`DONE on ledger: ${d} (verify artifacts in ${sandbox})`);
  }

  // heartbeat pathology flags (2026-06-10 session receipts, frozen as checks)
  // route-preference awareness: claude-first is OPERATOR-ORDERED when the route file
  // declares a window or standing rule — not an anomaly (false-flag receipt 13:42).
  let routePreferred = false;
  try {
    const rt = JSON.parse(readFileSync(routeFile, 'utf8'));
    routePreferred = (rt.prefer === 'claude' && Date.parse(rt.until) > now) || (Array.isArray(rt.standing_prefer) && rt.standing_prefer.length > 0);
  } catch { /* no route file = no preference */ }
  if (hb.claudeTier.length && !hb.rateLimited.length && !routePreferred) {
    report.push(`FLAG: ${hb.claudeTier.length} claude-tier dispatch(es) in last ${mins(T.HB_WINDOW_MS)}m with NO rate-limit seen — claude fallback should only carry seats when the LOCAL lane is failing`);
    actions.push({ id: 'CHECK-CLAUDE-TIER', class: 'judgment', approved_by_faith: false, read_first: [path.join(logs, 'dispatch-heartbeat.log')], rule: 'persistent claude-tier lines = the LOCAL lane failing over — check nxtbeast Ollama health (api/ps, queue saturation, model 404s) before suspecting the Claude tier (de-clouded 2026-07-03: ollama.com is not a provider)' });
  }
  for (const row of HEARTBEAT_FLAG_TABLE) {   // mt-b2-flag-table: one iteration classifies + emits
    const count = (hb.flags[row.key] || []).length;
    if (count < row.threshold) continue;
    report.push(row.flagText(count));
    if (row.action) actions.push(row.action(logs));
  }

  report.push(`ledger: ${autorun.done.length} DONE / ${autorun.failed.length} FAILED / ${autorun.running.length} running / ${autorun.pending.length} pending / ${(autorun.parked || []).length} PARKED / ${(autorun.split || []).length} SPLIT`);
  // DONENESS GATE (2026-07-02): compute the TRUE completion state so the conductor consults it
  // instead of eyeballing the board (the map the 2026-07-02 conductor lacked). doneness.json is
  // written by main(); this surfaces it on the board + as a standing NOT-DONE action.
  let doneness = null;
  try {
    // AUDIT FIX 2026-07-02: thread the injected gitFn through — without it every fixture/selftest
    // sweep hit the REAL mt repo (doneness untestable in isolation; the suite went red silently).
    doneness = computeDoneness(base, autorun, { owed, ...(gitFn ? { gitFn } : {}) });
    report.push(`DONENESS: barMet=${doneness.barMet} — ${doneness.blocking.length} blocking · pending ${doneness.counts.pending} · unresolvedFAILED ${doneness.counts.unresolvedFailed} · pushGap ${doneness.counts.pushedGap} · openIntegration ${doneness.counts.openIntegration}`);
    if (!doneness.barMet) {
      for (const b of doneness.blocking.slice(0, 8)) report.push(`  NOT-DONE [${b.layer}] ${b.mission}: ${String(b.reason).slice(0, 90)}`);
      actions.push({
        id: 'DONENESS-NOT-MET', class: 'judgment', approved_by_faith: false,
        why: `integration NOT done: ${doneness.blocking.length} blocking, ${doneness.counts.pushedGap} unpushed, ${doneness.counts.unresolvedFailed} unresolved-FAILED — do NOT frame the work as done/wind-down until barMet (the stop-hook enforces this from doneness.json)`,
        blocking: doneness.blocking.slice(0, 20),
        rule: 'drain blocking[] (land + push + verify); barMet:true from doneness.json is the only honest done — never declare done on a proxy',
      });
    }
  } catch (e) { report.push(`DONENESS: compute failed — ${String(e.message).slice(0, 80)} (fail-closed: treat as NOT done)`); }
  if (!actions.length) report.push('required actions: none — "nothing needed from you" is a complete ending');
  // BEAT-COMPLETE BAR (operator correction 2026-07-03 ~17:0x: system gaps were ALWAYS first
  // priority, yet conductor beats kept ending "nothing needed from you" while this list sat
  // non-empty — the complete-ending license above only exists at ZERO actions, and the beat
  // prompt's blanket phrasing let the conductor override it by habit. A running lane is the
  // DAEMON's work, not the conductor's busyness — same law as the CG rule below.)
  else report.push(`BEAT-COMPLETE BAR: ${actions.length} required action(s) above are CONDUCTOR work this beat — "nothing needed from you" is EARNED only after at least one lands (or its blocker is receipted in the report); a running lane is the daemon's work, not yours`);
  return { daemonAlive, report, actions, autorun, doneness };
}

// HEAL — perform the mechanical, faith-approved actions the sweep found, so a beat
// genuinely self-heals instead of just printing orders. Two acts only:
//   1) requeue every healed-class mission (single batched, identity-safe AUTORUN write —
//      the same write-pattern the conductor uses to FIRE missions); mark each ledger
//      entry requeued so it fires exactly once.
//   2) restart a daemon the sweep judged DEAD — but NEVER while a lane is running
//      (defense in depth: a live mission is never killed by an auto-restart).
// Judgment-class actions (DIAGNOSE/CHECK/PERFORM-NAMED-FIX) are left as orders — heal
// performs only what the faith pre-approved as mechanical.
// stdio captures stderr only (both commands this runs -- taskkill, a detached
// Start-Process restart -- are short-lived, so buffering stderr is safe): a bare
// 'ignore' throws away the real reason on failure, leaving only Node's generic
// "Command failed: <cmd>" with nothing to diagnose (2026-07-01 real incident: every
// STUCK-TASK taskkill today failed silently, zero detail captured).
export function heal(base = HERE, now = Date.now(), { exec = (cmd) => execSync(cmd, { stdio: ['ignore', 'ignore', 'pipe'] }), sightFn, worktreeReposFn, gitFn } = {}) {
  // forward sight + worktree opts to the internal sweep; each defaults inside sweep() to the
  // real probe/repo when omitted (production), and is injectable for the offline selftest.
  const sweepOpts = {};
  if (sightFn) sweepOpts.sightFn = sightFn;
  if (worktreeReposFn) sweepOpts.worktreeReposFn = worktreeReposFn;
  if (gitFn) sweepOpts.gitFn = gitFn;
  const r = sweep(base, now, undefined, Object.keys(sweepOpts).length ? sweepOpts : undefined);
  const performed = [];

  const reqStems = new Set(r.actions.filter((a) => String(a.id).startsWith('REQUEUE-') && a.approved_by_faith).map((a) => a.requeue_stem));
  if (reqStems.size) {
    const apath = path.join(base, 'missions', 'AUTORUN.md');
    const lines = readText(apath).split(/\r?\n/);
    let changed = false;
    const bared = new Set();
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim().startsWith('#') || statusOfLine(l) !== 'FAILED') continue;
      const p = l.trim().replace(STATUS_RE, '').replace(/<!--.*?-->/g, '').trim();
      if (!p || !reqStems.has(stemOf(p))) continue;
      // DEDUPE GUARD (16:17 receipt: a heal double-requeue left TWO live lines for one
      // mission -> stealth attempt-counter reset, a x2-FAILED mission refired 5s later).
      // At most ONE line per stem is ever bared; extras are retired as comments.
      if (bared.has(stemOf(p))) { lines[i] = '# DUPLICATE-RETIRED (heal dedupe guard): ' + lines[i]; changed = true; continue; }
      bared.add(stemOf(p));
      lines[i] = `${p}  <!-- ${new Date(now).toISOString()} REQUEUE: fix landed, class healed (auto, once) -->`;
      performed.push({ action: 'requeue', stem: stemOf(p) });
      changed = true;
    }
    if (changed) writeFileSync(apath, lines.join('\n'));
    const ledger = readFixLedger(base);
    for (const e of ledger.entries) {
      if (e.requeued) continue;
      for (const item of (e.requeue || [])) {
        if (typeof item === 'object' && reqStems.has(item.stem)) item.requeued = true;
      }
      const items = e.requeue || [];
      // mt-c3-perstem: the entry-level flag flips true only when EVERY stem in it has
      // been requeued — a partial requeue (one stem done, one stem still FAILED-pending)
      // must leave the entry, and its still-open stem, live for a future beat.
      if (items.length && items.every((item) => typeof item === 'object' && item.requeued)) {
        e.requeued = true; e.requeued_ts = new Date(now).toISOString();
      }
    }
    writeFixLedger(base, ledger);
  }

  // CHAIN-ON-DONE performer: append each chain target as a bare pending line (once-only
  // is enforced at sweep — a target already anywhere in AUTORUN never reaches here).
  const chains = r.actions.filter((a) => a.id?.startsWith('CHAIN-') && a.chain_target);
  if (chains.length) {
    const apath = path.join(base, 'missions', 'AUTORUN.md');
    const cur = readText(apath);
    const add = chains.filter((c) => !cur.includes(c.chain_target));
    if (add.length) {
      writeFileSync(apath, cur.replace(/\n?$/, '\n') + add.map((c) => `${c.chain_target}  <!-- ${new Date(now).toISOString()} CHAIN-ON-DONE (auto, once) -->`).join('\n') + '\n');
      for (const c of add) performed.push({ action: 'chain-queue', stem: stemOf(c.chain_target) });
    }
  }

  const logs = path.join(base, 'missions', '_logs');

  // DEAD-STEM RETIREMENT (frontier-reconciliation, 2026-07-02): a FAILED line whose mission.txt no
  // longer exists on disk is a GHOST — it inflates the frontier + unresolvedFailed forever (the
  // doneness gate counts it, so barMet can never go true) yet can never be requeued or fixed (no
  // file). Sizing found ~70 of 114 unresolved-FAILED were such ghosts, hiding the real ~14 work.
  // Retire them as COMMENTS (reversible, auditable — never deleted). Conservative: ONLY a missing
  // mission.txt qualifies; a live mission is never touched. Idempotent (a retired line is a comment,
  // skipped next pass) + logged. Mechanical board-hygiene a local conductor gets for free.
  {
    const apath = path.join(base, 'missions', 'AUTORUN.md');
    const lines = readText(apath).split(/\r?\n/);
    let changed = false, retired = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim().startsWith('#') || statusOfLine(l) !== 'FAILED') continue;
      const p = l.trim().replace(STATUS_RE, '').replace(/<!--.*?-->/g, '').trim();
      if (!p || !/\.mission\.txt$/.test(p)) continue;
      if (existsSync(path.join(base, p.replace(/\//g, path.sep)))) continue;   // file exists => live mission, never touch
      lines[i] = `# DEAD-STEM-RETIRED ${new Date(now).toISOString()} (mission.txt absent — ghost FAILED line, reversible): ${l.trim()}`;
      retired++; changed = true;
    }
    if (changed) {
      writeFileSync(apath, lines.join('\n'));
      performed.push({ action: 'dead-stem-retire', count: retired });
      try { appendFileSync(path.join(logs, 'daemon-events.log'), `${new Date(now).toISOString()} DEAD-STEM-RETIRE: ${retired} ghost FAILED line(s) retired (mission.txt absent)\n`); } catch { /* logging never breaks heal */ }
    }
  }

  // WORKTREE-HEAL performer: run the surgical recovery commands in order (abort mid-op, then
  // checkout HEAD -- each unmerged tracked file). Each command is best-effort; a failure on one
  // never aborts the rest (a partial recovery still unblocks more than none). Untracked orphans
  // are logged, never deleted.
  for (const wh of r.actions.filter((a) => String(a.id).startsWith('WORKTREE-HEAL-'))) {
    let ran = 0;
    for (const cmd of (wh.commands || [])) { try { exec(cmd); ran++; } catch { /* best-effort; continue */ } }
    performed.push({ action: 'worktree-heal', repo: wh.repo_root, commands_run: ran, untracked_orphans: wh.untracked_orphans || [] });
    try {
      appendFileSync(path.join(logs, 'daemon-events.log'),
        `${new Date(now).toISOString()} WORKTREE-HEAL: ${wh.repo_root} — ran ${ran}/${(wh.commands || []).length} recovery cmds` +
        `${(wh.untracked_orphans || []).length ? `; untracked orphans left (report-only): ${wh.untracked_orphans.join(', ')}` : ''}\n`);
    } catch { /* logging must never break heal */ }
  }

  const restart = r.actions.find((a) => a.id === 'RESTART-DAEMON');
  if (restart) {
    const status = readJson(path.join(logs, 'daemon-status.json'));
    // NOTE: RESTART-DAEMON only ever exists when sweep() found !daemonAlive -- so
    // gating this on `r.daemonAlive` (as a prior version did) made the guard dead
    // code: it could never be true here, and heal() would ALWAYS force-restart even
    // with a live lane running. The guard must key on the lane claim alone, since a
    // dead-looking pid with a claimed lane is exactly the ambiguous case (zombie vs.
    // genuinely stuck) where killing blind risks a live mission.
    const lanesRunning = status && Array.isArray(status.lanes) && status.lanes.length > 0;
    if (lanesRunning) performed.push({ action: 'restart-skipped', why: 'lanes running — refusing to kill a live mission' });
    else { exec(restart.command); performed.push({ action: 'restart-daemon' }); }
  }

  // STUCK-TASK healer: kill the hung process tree and bare the RUNNING lines.
  const stuckAction = r.actions.find((a) => a.id === 'STUCK-TASK');
  if (stuckAction) {
    exec(stuckAction.command);
    const apath = path.join(base, 'missions', 'AUTORUN.md');
    const lines = readText(apath).split(/\r?\n/);
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (statusOfLine(l) !== 'RUNNING') continue;
      const p = l.trim().replace(STATUS_RE, '').replace(/<!--.*?-->/g, '').trim();
      if (!p || !stuckAction.stuck_paths.some((sp) => sp === p || stemOf(sp) === stemOf(p))) continue;
      lines[i] = `${p}  <!-- ${new Date(now).toISOString()} REQUEUE: stuck task killed (auto, once) -->`;
      performed.push({ action: 'stuck-requeue', stem: stemOf(p) });
      changed = true;
    }
    if (changed) writeFileSync(apath, lines.join('\n'));
    appendFileSync(path.join(logs, 'daemon-events.log'), `SWEEP-HEAL ${new Date(now).toISOString()} STUCK-TASK pid=${stuckAction.command.match(/\/PID\s+(\S+)/)?.[1] ?? '?'} paths=${stuckAction.stuck_paths.join(',')}\n`);
  }

  // LOOP-CAP healer (2026-07-01): sweep()'s own action comment has said "heal() may retire
  // duplicate lines beyond the cap" since this action was built -- but heal() never actually
  // did it (LOOP-CAP detection was real and tested; the remedy half was aspirational text,
  // an audit-flagged gap). Per the action's own `rule` field: "operator must diagnose the
  // root cause before requeue; heal() may retire duplicate lines beyond the cap" -- so this
  // NEVER requeues or fires anything (that needs a human diagnosis), it only STOPS a looping
  // stem from firing AGAIN by retiring its bare/pending lines. DONE/FAILED/RUNNING lines for
  // the same stem are left untouched -- they're history, not a live re-fire risk.
  const loopCapAction = r.actions.find((a) => a.id === 'LOOP-CAP');
  if (loopCapAction && Array.isArray(loopCapAction.loop_stems) && loopCapAction.loop_stems.length) {
    const apath = path.join(base, 'missions', 'AUTORUN.md');
    const lines = readText(apath).split(/\r?\n/);
    let changed = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim().startsWith('#')) continue;               // already retired/commented -- leave it
      if (statusOfLine(l)) continue;                          // only bare/pending lines are a re-fire risk
      const p = l.trim().replace(/<!--.*?-->/g, '').trim();
      if (!p) continue;
      const stem = stemOf(p);
      if (!loopCapAction.loop_stems.includes(stem)) continue;
      lines[i] = `# LOOP-CAP-RETIRED ${new Date(now).toISOString()} (${loopCapAction.why}): ${lines[i]}`;
      performed.push({ action: 'loop-cap-retire', stem });
      changed = true;
    }
    if (changed) {
      writeFileSync(apath, lines.join('\n'));
      appendFileSync(path.join(logs, 'daemon-events.log'), `SWEEP-HEAL ${new Date(now).toISOString()} LOOP-CAP stems=${loopCapAction.loop_stems.join(',')}\n`);
    }
  }

  // STRANDED-SPLIT-CHILD RECOVERY (hunt-item #16, 2026-07-04): mission_split.mjs's appendQueue
  // call is best-effort ("try { appendQueue(rel) } catch { /* best-effort */ }") -- a transient
  // failure silently drops a child from AUTORUN.md forever while its mission.txt file sits on
  // disk, real and fireable, just never queued. The _split-manifest.json handoff record ALWAYS
  // lists every child mission_split.mjs INTENDED to queue (manifest.children, built from
  // `files`, independent of whether that child's own appendQueue succeeded) -- but until now
  // nothing ever read it back to compare "intended" against "actually queued." Cross-referencing
  // the manifest against the live AUTORUN.md turns "write-only" into a real recovery mechanism:
  // a child present in the manifest, with its mission.txt file genuinely on disk, but absent
  // from EVERY AUTORUN.md line (bare/DONE/FAILED/RUNNING/SPLIT/PARKED) is stranded -- re-queue
  // it as a bare SPLIT-CHILD-tagged line (same marker orchestrate.mjs's insertQueueLineAfter
  // uses, so the QUEUE-DUP guard's hunt-item #13 exemption applies here too).
  {
    const missionsDir = path.join(base, 'missions');
    let manifestFiles = [];
    try { manifestFiles = readdirSync(missionsDir).filter((f) => f.endsWith('._split-manifest.json')); } catch { manifestFiles = []; }
    if (manifestFiles.length) {
      const apath = path.join(base, 'missions', 'AUTORUN.md');
      let autorunText = readText(apath);
      let changed = false;
      for (const mf of manifestFiles) {
        let manifest;
        try { manifest = JSON.parse(readFileSync(path.join(missionsDir, mf), 'utf8')); } catch { continue; }
        for (const child of (manifest.children || [])) {
          const rel = child.file;
          if (!rel || autorunText.includes(rel)) continue;                       // already queued in SOME form -- not stranded
          if (!existsSync(path.join(base, rel))) continue;                        // no mission.txt on disk either -- nothing to recover
          autorunText = `${autorunText.replace(/\n?$/, '\n')}${rel}  <!-- SPLIT-CHILD -->\n`;
          changed = true;
          performed.push({ action: 'stranded-split-recovery', stem: stemOf(rel), manifest: mf });
        }
      }
      if (changed) {
        writeFileSync(apath, autorunText);
        appendFileSync(path.join(logs, 'daemon-events.log'), `SWEEP-HEAL ${new Date(now).toISOString()} STRANDED-SPLIT-RECOVERY stems=${performed.filter((p) => p.action === 'stranded-split-recovery').map((p) => p.stem).join(',')}\n`);
      }
    }
  }

  return { performed, report: r.report, actions: r.actions };
}

// FIFTH-LAW REPORT-LINTER (hunt-item #23, 2026-07-04). conductor-core.md's fifth law (paid
// 2026-07-02, two wrong causal narratives caught the same day) says: a conductor causal claim
// ("X is why Y fails", "Z is gone/dead", "the root cause is...") ships only behind temporal
// coverage + exhaustive-probe evidence + a receipt or an explicit HYPOTHESIS tag -- and its own
// escalation clause says plainly: "if a future instance still ships an ungated causal claim,
// the escalation is a report-linter that blocks 'root cause' sentences lacking a receipt or
// HYPOTHESIS tag." That escalation fired (an ungated claim was made and operator-caught) and
// the linter was never built -- until now. PURE, standalone: flags causal-claim language with
// no receipt-like token (a commit sha, a file/path reference, or the literal word HYPOTHESIS)
// within a nearby window -- a heuristic, not full natural-language understanding (the same
// discipline as this session's other pattern-based checks: LARGE-DELETION's ratio, the
// UNPARKS counter). NOT wired into any automatic blocking gate yet -- deciding WHERE to hook
// it (every QUEUE.md write? every push?) and whether advisory-vs-blocking is right is a
// separate call; this beat builds the linter itself, which is what the law's escalation
// clause literally demanded and what was missing.
export function findUngatedCausalClaims(text, { windowChars = 400 } = {}) {
  const s = String(text || '');
  const claimRe = /\b(?:the )?root cause (?:is|was)\b|\bis why\b|\bis (?:dead|gone)\b|\bno longer exists?\b|\bthe reason (?:is|why|for)\b/gi;
  const receiptRe = /\b[0-9a-f]{7,40}\b|\bHYPOTHESIS\b|\b[\w-]+\.(?:mjs|md|json|ps1|html|js)\b|missions\/\S+/i;
  const flagged = [];
  let m;
  while ((m = claimRe.exec(s))) {
    const start = Math.max(0, m.index - windowChars);
    const end = Math.min(s.length, m.index + m[0].length + windowChars);
    const window = s.slice(start, end);
    if (!receiptRe.test(window)) {
      const lineStart = s.lastIndexOf('\n', m.index) + 1;
      const lineEnd = (() => { const i = s.indexOf('\n', m.index); return i === -1 ? s.length : i; })();
      flagged.push({ match: m[0], context: s.slice(lineStart, lineEnd).trim().slice(0, 200) });
    }
  }
  return flagged;
}

function main() {
  if (process.argv.includes('--record')) {
    const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
    const cls = arg('--class'), fix = arg('--fix'), requeue = (arg('--requeue') || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!cls) { console.error('usage: --record --class <c> --fix <text> --requeue a,b'); process.exit(2); }
    recordFix(HERE, { cls, fix, requeue });
    console.log(`fix-ledger += {class:'${cls}', requeue:[${requeue.join(', ')}]}`);
    return;
  }
  if (process.argv.includes('--record-deploy')) {
    // Stamp the deploy marker AFTER a real `wrangler pages deploy` succeeds — WITNESSED, not declared.
    // AUDIT FIX 2026-07-02: the first version recorded `git rev-parse HEAD` and nothing else — an
    // honor-system marker that let L4-"done" be uttered into existence by one command (the exact
    // anti-pattern the doneness gate exists to kill). Now the verb (1) refuses a dirty tree (wrangler
    // deploys the WORKING TREE — a dirty deploy is not HEAD and must not be recorded as HEAD), and
    // (2) fetches the LIVE production /map and requires it to byte-match HEAD's committed map.html
    // before stamping. Fail-closed: no live match, no marker.
    (async () => {
      const repo = MT_REPO_DEFAULT;
      let sha = '';
      try { sha = execSync(`git -C "${repo}" rev-parse HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* visible failure below */ }
      if (!/^[0-9a-f]{40}$/.test(sha)) { console.error(`--record-deploy: could not read ${repo} HEAD (got "${sha}")`); process.exit(2); }
      const dirty = (() => { try { return execSync(`git -C "${repo}" status --porcelain`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'status-unreadable'; } })();
      if (dirty) { console.error(`--record-deploy REFUSED: worktree is DIRTY — what wrangler deployed is not HEAD, so recording HEAD as deployed would be a lie.\n${dirty.split('\n').slice(0, 5).join('\n')}`); process.exit(2); }
      const committed = execSync(`git -C "${repo}" show HEAD:map.html`, { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 }).toString();
      let live = '';
      try { const res = await fetch('https://muddytires.ca/map', { headers: { 'cache-control': 'no-cache' } }); live = await res.text(); } catch (e) { console.error(`--record-deploy REFUSED: cannot fetch live /map (${e.message}) — deploy state unverifiable, fail-closed`); process.exit(2); }
      // norm also strips the sentry-dsn meta functions/_middleware.js INJECTS at serve time (live
      // receipt 2026-07-02: clean tree, current deploy, yet live = HEAD + injected tag -> false REFUSE).
      // Only that one known injection is stripped — anything else different still refuses.
      const norm = (s) => s.replace(/\r\n/g, '\n').replace(/<meta\s+name="sentry-dsn"[^>]*>/gi, '').trim();
      if (norm(live) !== norm(committed)) { console.error(`--record-deploy REFUSED: live /map does NOT match HEAD's map.html (live ${live.length}B vs committed ${committed.length}B) — the deploy either did not happen, hit a different tree, or is still propagating. Not stamping.`); process.exit(1); }
      // L5 OUTCOME WITNESS (judge system-ruling, 2026-07-02): byte-match proves the CODE shipped;
      // the e2e verifier proves users SEE REAL DATA (fetches the served page + real production
      // pois.json, renders through the served logic, refuses generic fallbacks). When the target
      // repo carries the verifier, a deploy that fails it is NOT recordable as deployed-done.
      let e2e = { ran: false };
      const vf = path.join(repo, 'scripts', 'verify-popups-e2e.mjs');
      if (existsSync(vf)) {
        try { execSync(`node "${vf}"`, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 }); e2e = { ran: true, ok: true }; }
        catch (err) { console.error(`--record-deploy REFUSED: code is live (byte-match OK) but the E2E OUTCOME VERIFIER FAILED — users are not seeing real data. Fix the outcome, not the marker.\n${String(err.stdout || err.message).slice(0, 400)}`); process.exit(1); }
      }
      const mk = path.join(HERE, 'missions', '_logs', 'last-deployed.json');
      writeFileSync(mk, JSON.stringify({ sha, ts: new Date().toISOString(), repo, witness: `live /map byte-matches HEAD:map.html (clean tree)${e2e.ran ? ' + e2e outcome verifier PASS' : ''}`, e2e, note: 'wrangler pages deploy --project-name=muddytires' }, null, 2));
      console.log(`deploy marker stamped (WITNESSED): ${sha.slice(0, 8)} — live /map == HEAD:map.html, tree clean${e2e.ran ? ', e2e outcome PASS' : ''}`);
    })();
    return;
  }
  if (process.argv.includes('--deploy-preview')) {
    // PREVIEW DEPLOY + E2E (SOTA gap #2, 2026-07-02): deploy the worktree to a Cloudflare Pages
    // PREVIEW (non-production alias — users never see it), then run the e2e outcome verifier
    // AGAINST THE PREVIEW URL. Verification happens BEFORE any production risk; promotion to
    // production stays an operator-authorized act, but it is now a pre-verified one. This is the
    // serial answer to "landed but invisible for hours": the chain can prove user-visible outcomes
    // continuously without touching prod.
    (async () => {
      const repo = MT_REPO_DEFAULT;
      let out = '';
      try {
        out = execSync('wrangler pages deploy . --project-name=muddytires --branch=preview --commit-dirty=true',
          { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000, maxBuffer: 8 * 1024 * 1024 }).toString();
      } catch (e) { console.error(`--deploy-preview FAILED at wrangler: ${String(e.stderr || e.message).slice(0, 300)}`); process.exit(2); }
      const url = (out.match(/https:\/\/[a-z0-9-]+\.muddytires\.pages\.dev/i) || [])[0];
      if (!url) { console.error(`--deploy-preview: wrangler succeeded but no preview URL parsed from output:\n${out.slice(-400)}`); process.exit(2); }
      console.log(`preview deployed: ${url}`);
      // SETTLE: a fresh preview alias 404s for a few seconds while Cloudflare propagates routes +
      // functions (live receipt: verifier ran 2s post-deploy and hit /map -> 404; 20s later it was 200).
      let settled = false;
      for (let i = 0; i < 10 && !settled; i++) {
        try { const r = await fetch(url + '/map'); settled = r.ok; } catch { /* not yet */ }
        if (!settled) await new Promise((res) => setTimeout(res, 5000));
      }
      if (!settled) { console.error(`--deploy-preview: preview never became reachable at ${url}/map within 50s — cannot verify`); process.exit(2); }
      try {
        execSync(`node scripts/verify-popups-e2e.mjs`, { cwd: repo, stdio: 'inherit', timeout: 180000, env: { ...process.env, MT_BASE_URL: url } });
        console.log(`\nPREVIEW E2E PASS — ${url} serves real data. Promotion to production is pre-verified (operator word promotes).`);
      } catch { console.error(`\nPREVIEW E2E FAIL — the preview at ${url} does NOT serve real user-visible data. Fix before any production promotion.`); process.exit(1); }
    })();
    return;
  }
  if (process.argv.includes('--request-reload')) {
    // Graceful daemon reload (2026-07-02): write the flag the daemon honors between missions, so it
    // exits cleanly and daemon-supervisor.ps1 respawns with fresh code — the classifier-safe way to
    // activate an engine fix without a force-kill (which the harness blocks on a running workload).
    const flag = path.join(HERE, 'missions', '_logs', 'RELOAD-REQUEST');
    writeFileSync(flag, `${new Date().toISOString()} reload requested by conductor (activate committed engine fix)\n`);
    console.log(`reload requested: ${flag}\n  the daemon exits between missions (no mission interrupted) + supervisor respawns with fresh code.\n  NOTE: only works once the daemon is already running code that contains the graceful-reload check.`);
    return;
  }
  if (process.argv.includes('--heal')) {
    const h = heal();
    console.log(h.report.join('\n'));
    console.log('\nHEAL performed:');
    if (!h.performed.length) console.log('  (nothing mechanical to heal this beat)');
    for (const p of h.performed) console.log(`  - ${p.action}${p.stem ? ` ${p.stem}` : ''}${p.why ? ` (${p.why})` : ''}`);
    return;
  }
  const r = sweep();
  // DONENESS RECEIPT: the stop-hook + next beat read this. Write must never break the sweep.
  try { if (r.doneness) writeFileSync(path.join(HERE, 'missions', '_logs', 'doneness.json'), JSON.stringify(r.doneness, null, 2)); } catch { /* receipt best-effort */ }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); return; }
  console.log(r.report.join('\n'));
  if (r.actions.length) {
    console.log('\nREQUIRED ACTIONS (mechanical = run as given; judgment = read the named files FIRST, then apply the rule):');
    for (const a of r.actions) {
      console.log(`- [${a.class}] ${a.id}: ${a.why || ''}`);
      if (a.command) console.log(`    run: ${a.command}`);
      if (a.read_first?.length) console.log(`    read first: ${a.read_first.join(' | ')}`);
      if (a.rule) console.log(`    rule: ${a.rule}`);
      if (a.verify) console.log(`    verify: ${a.verify}`);
    }
  }
}

// ---- offline selftest: fixtures on a temp base, no daemon, no model ----
function selftest() {
  let fails = 0; const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
  const tmp = path.join(HERE, '_selftest-conduct');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(path.join(tmp, 'missions', '_logs'), { recursive: true });
  const logs = path.join(tmp, 'missions', '_logs');
  const now = Date.now();

  // ---- findUngatedCausalClaims (hunt-item #23, fifth-law report-linter) ----
  {
    // shapes quoted directly from conductor-core.md's fifth law ("X is why Y fails",
    // "Z is gone/dead", "the root cause is...") -- the two real incidents the law names
    // ("failing because cloud models", "minimax lab gone") were prose ABOUT these shapes,
    // not literal instances of them; these fixtures test the actual quoted templates.
    ck(findUngatedCausalClaims('cloud models is why the chain keeps failing').length === 1, 'causal-linter: "X is why Y fails"-shaped ungated prose is flagged (no receipt nearby)');
    ck(findUngatedCausalClaims('the minimax lab is gone, restore cloud seats').length === 1, 'causal-linter: "Z is gone" ungated is flagged');
    ck(findUngatedCausalClaims('The root cause is the witness cap truncating at 48000 chars, fixed in commit 854b31a.').length === 0, 'causal-linter: a root-cause claim WITH a commit sha nearby is not flagged (gated)');
    ck(findUngatedCausalClaims('The root cause is X (HYPOTHESIS, not yet verified).').length === 0, 'causal-linter: an explicit HYPOTHESIS tag gates the claim');
    ck(findUngatedCausalClaims('The root cause is documented in self_witness.mjs.').length === 0, 'causal-linter: a file-reference receipt gates the claim');
    ck(findUngatedCausalClaims('This mission landed cleanly with all tests passing.').length === 0, 'causal-linter: ordinary prose with no causal-claim language is never flagged');
    const flagged = findUngatedCausalClaims('the reason for the crash is unknown right now, still investigating');
    ck(flagged.length === 1 && flagged[0].context.includes('the reason for the crash'), 'causal-linter: flagged entries carry the surrounding line as context, not just the bare match');
    ck(findUngatedCausalClaims('').length === 0, 'causal-linter: empty text -> no findings, never throws');
  }

  // fixture 1: dead daemon (stale status, dead pid) + one FAILED mission + claude-tier-without-429
  writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: 999999999, state: 'running', lanes: ['missions/x.mission.txt'], queued: 0, ts: new Date(now - 10 * 60000).toISOString() }));
  writeFileSync(path.join(logs, 'daemon.pid'), '999999999');
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/broken.mission.txt  <!-- t -->\nmissions/next.mission.txt\n');
  writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), `${new Date(now - 2 * 60000).toISOString()} attempt-start provider=claude-opus (claude tier for kimi-k2.6)\n`);
  const noRoute = path.join(tmp, 'no-route.json');  // fixture isolation: never read the real route file
  // fixture isolation: never curl the real backend, never git the real worktree. gitFn stub added
  // 2026-07-02 (audit): without it every sweep's computeDoneness silently hit the REAL mt repo —
  // fixtures depended on live repo state and the suite went red when L4 landed.
  const stubGit = (repo, argstr) => {
    if (/rev-parse --abbrev-ref/.test(argstr)) return { ok: true, out: 'github/main\n' };
    if (/^rev-list --count/.test(argstr)) return { ok: true, out: '0\n' };
    if (/log -p/.test(argstr) || /patch-id/.test(argstr)) return { ok: true, out: '' };
    return { ok: true, out: '' };
  };
  const sightOk = { sightFn: () => ({ ok: true, results: 10 }), cgAgeFn: () => ({ ok: true, minutes: 5 }), worktreeReposFn: () => [], gitFn: stubGit, modelTagsFn: () => ({ ok: false, reason: 'selftest fixture — no network' }) };
  let r = sweep(tmp, now, noRoute, sightOk);
  ck(r.daemonAlive === false, 'dead daemon detected (stale status + dead pid)');
  ck(r.actions.some((a) => a.id === 'RESTART-DAEMON' && a.command.includes('muezzin-daemon.mjs')), 'restart action with exact command emitted');
  ck(r.actions.some((a) => a.id === 'DIAGNOSE-broken' && a.class === 'judgment'), 'FAILED mission gets diagnose action, not a refire');
  ck(r.report.some((l) => l.includes('claude-tier') && l.includes('NO rate-limit')), 'claude-without-rate-limit flag raised (wording de-clouded 2026-07-03)');
  ck(r.autorun.pending.length === 1, 'pending parse correct');

  // fixture: SUPERVISOR-HALTED (hunt-item #3, 2026-07-04) -- daemon-supervisor.ps1's
  // silent halt marker must be surfaced distinctly from an ordinary dead-daemon restart,
  // with a read_first pointing at the crash evidence instead of a blind restart.
  {
    const haltMarker = path.join(logs, 'supervisor-halted.txt');
    writeFileSync(haltMarker, 'Halted 2026-07-04T20:50:00 -- daemon died 6 times in 10 minutes. Diagnose before restarting manually.');
    const rHalted = sweep(tmp, now, noRoute, sightOk);
    ck(rHalted.report.some((l) => l.startsWith('SUPERVISOR-HALTED:') && l.includes('died 6 times')), 'SUPERVISOR-HALTED: halt marker text surfaced verbatim in the report, not silently skipped');
    ck(rHalted.actions.some((a) => a.id === 'SUPERVISOR-HALTED' && a.class === 'judgment' && /daemon-stderr\.log/.test(a.why)), 'SUPERVISOR-HALTED: action points at daemon-stderr.log as read_first, not a blind restart');
    ck(!rHalted.actions.some((a) => a.id === 'RESTART-DAEMON'), 'SUPERVISOR-HALTED: the generic RESTART-DAEMON action is replaced, not duplicated alongside it');
    rmSync(haltMarker, { force: true });
    const rClean = sweep(tmp, now, noRoute, sightOk);
    ck(rClean.actions.some((a) => a.id === 'RESTART-DAEMON'), 'SUPERVISOR-HALTED: with the marker gone, an ordinary dead-daemon death goes back to the plain RESTART-DAEMON action (zero behavior change for the common case)');
  }

  // fixture 1a: DIAGNOSE-<stem> read_first must use the REAL on-disk names (2026-07-01
  // fix — was `<stem>.result.json`/fixed `.retro.md`, neither of which ever exists on
  // disk; real names are `<stem>.mission.result.json` and a timestamp-suffixed retro file).
  mkdirSync(path.join(logs, 'retro'), { recursive: true });
  writeFileSync(path.join(tmp, 'missions', 'broken.mission.result.json'), '{"ok":false}');
  writeFileSync(path.join(logs, 'retro', 'broken-2026-07-01T00-00-00-000Z.md'), '# retro');
  r = sweep(tmp, now, noRoute, sightOk);
  const diagBroken = r.actions.find((a) => a.id === 'DIAGNOSE-broken');
  ck(!!diagBroken?.read_first?.some((p) => p.endsWith('broken.mission.result.json')), 'DIAGNOSE read_first finds the real .mission.result.json name');
  ck(!!diagBroken?.read_first?.some((p) => p.endsWith('broken-2026-07-01T00-00-00-000Z.md')), 'DIAGNOSE read_first finds the real timestamp-suffixed retro file');
  rmSync(path.join(tmp, 'missions', 'broken.mission.result.json'), { force: true });
  rmSync(path.join(logs, 'retro', 'broken-2026-07-01T00-00-00-000Z.md'), { force: true });

  // fixture 1b: SELF-HEAL — a FAILED annotation NAMING a fix becomes a PERFORM order;
  // one parked on the engine batch is report-only (legitimate); a bare one still diagnoses.
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'),
    '# q\nFAILED missions/fixable.mission.txt  <!-- diagnosed: too big. FIX: split into Half A + Half B then requeue -->\n' +
    'FAILED missions/parked.mission.txt  <!-- blocked pending engine batch 0.3 -->\n' +
    'FAILED missions/bare.mission.txt  <!-- t -->\n' +
    'FAILED missions/done-elsewhere.mission.txt  <!-- FIX: none needed — SUPERSEDED by conductor survey -->\n');
  r = sweep(tmp, now, noRoute, sightOk);
  ck(r.actions.some((a) => a.id === 'PERFORM-NAMED-FIX-fixable' && /split into Half A/.test(a.fix)), 'named fix becomes a PERFORM order, not a parked label');
  // CONTRACT UPDATED 2026-07-02 (parked-graveyard fix): an engine-parked block gets NO refire
  // and NO per-mission PERFORM action — but it is NO LONGER permanently invisible: it surfaces
  // in the consolidated REVISIT-PARKED judgment (a READ/judge order, never a relaunch).
  ck(!r.actions.some((a) => a.id === 'PERFORM-NAMED-FIX-parked' || a.id === 'DIAGNOSE-parked'), 'engine-parked block: no refire/perform action (park respected)');
  ck(r.actions.some((a) => a.id === 'REVISIT-PARKED' && a.due.some((d) => d.includes('missions/parked.mission.txt'))), 'engine-parked block IS surfaced in REVISIT-PARKED (dateless park = always due) — parks no longer die silently');
  ck(r.actions.some((a) => a.id === 'DIAGNOSE-bare'), 'bare FAILED still gets diagnose');
  ck(!r.actions.some((a) => a.id && a.id.includes('done-elsewhere')), 'CLOSED (FIX: none/SUPERSEDED) is report-only — no PERFORM loop, no re-diagnose');

  // fixture 1c: parkedRevivalDue unit contract (the operator's "do they go there to die" fix).
  {
    const au = parseAutorun(
      'PARKED missions/pk-old.mission.txt  <!-- 2026-06-25 senior: revisit after engine fixes -->\n' +
      'PARKED missions/pk-fresh.mission.txt  <!-- 2026-07-01 parked pending X -->\n' +
      'PARKED missions/pk-judged.mission.txt  <!-- 2026-06-25 parked. REVISIT-JUDGED 2026-07-02: STILL-BLOCKED needs windowed-edit -->\n' +
      'FAILED missions/pk-superseded.mission.txt  <!-- pending engine batch. SUPERSEDED by pk-b -->\n');
    const nowMs = Date.parse('2026-07-02T22:00:00Z');
    const fixes = [{ class: 'claude-launch', landed_ts: '2026-06-30T00:00:00Z' }];
    const due = parkedRevivalDue(au, fixes, { maxAgeDays: 7, now: nowMs });
    ck(due.some((d) => d.path === 'missions/pk-old.mission.txt' && d.fixesSince.includes('claude-launch')), 'revival: park older than a landed fix -> DUE, names the fix class');
    ck(!due.some((d) => d.path === 'missions/pk-fresh.mission.txt'), 'revival: park NEWER than every fix, inside age window -> quiet');
    ck(!due.some((d) => d.path === 'missions/pk-judged.mission.txt'), 'revival: REVISIT-JUDGED after the fix -> silenced (judgment is the new anchor)');
    // production stamp format: full ISO timestamp immediately followed by the verdict colon —
    // the exact shape whose trailing colon broke Date.parse on the first live stamping pass.
    const auColon = parseAutorun('PARKED missions/pk-colon.mission.txt  <!-- 2026-06-25 parked. REVISIT-JUDGED 2026-07-02T23:10:00Z: RETIRE-SUPERSEDED (audit) -->\n');
    ck(!parkedRevivalDue(auColon, fixes, { maxAgeDays: 7, now: nowMs }).length, 'revival: full-ISO stamp with trailing verdict colon parses (the live-caught regex bug stays dead)');
    // LATEST-MATCH regression (2026-07-05 live catch): a note with TWO REVISIT-JUDGED
    // stamps (re-judged once already) must anchor on the LATEST one, not the first —
    // otherwise a re-judgment can never silence its own re-open trigger.
    const auReJudged = parseAutorun(
      'PARKED missions/pk-rejudged.mission.txt  <!-- 2026-06-25 parked. REVISIT-JUDGED 2026-07-02T23:10:00Z: STILL-BLOCKED REVISIT-JUDGED 2026-07-05T00:31:00Z: STILL-BLOCKED (unchanged) -->\n');
    const fixesBetween = [{ class: 'mid-fix', landed_ts: '2026-07-03T00:00:00Z', requeue: [] }];
    ck(!parkedRevivalDue(auReJudged, fixesBetween, { maxAgeDays: 7, now: nowMs }).some((d) => d.path === 'missions/pk-rejudged.mission.txt'),
      'revival: SECOND REVISIT-JUDGED stamp is the anchor — a fix landed BEFORE it does not re-open it (the bug: only the FIRST stamp was ever read)');
    const fixesAfter = [{ class: 'late-fix', landed_ts: '2026-07-05T12:00:00Z', requeue: [] }];
    ck(parkedRevivalDue(auReJudged, fixesAfter, { maxAgeDays: 7, now: Date.parse('2026-07-06T00:00:00Z') }).some((d) => d.path === 'missions/pk-rejudged.mission.txt'),
      'revival: a fix landed AFTER the SECOND stamp still correctly re-opens it');
    ck(!due.some((d) => d.path === 'missions/pk-superseded.mission.txt'), 'revival: SUPERSEDED park is judged-closed, never resurfaces');
    const due2 = parkedRevivalDue(au, [...fixes, { class: 'newer-fix', landed_ts: '2026-07-02T12:00:00Z' }], { maxAgeDays: 7, now: nowMs });
    ck(due2.some((d) => d.path === 'missions/pk-judged.mission.txt' && d.fixesSince.includes('newer-fix')), 'revival: a fix landing AFTER the judgment re-opens the judged park');
    const due3 = parkedRevivalDue(au, [], { maxAgeDays: 7, now: Date.parse('2026-07-09T00:00:00Z') });
    ck(due3.some((d) => d.path === 'missions/pk-fresh.mission.txt'), 'revival: age window alone (7d, no fixes) re-surfaces a park — the standing weekly graveyard look');
    // targeted-heal filter (2026-07-03 churn receipt): a fix entry requeue-targeted at OTHER
    // missions must NOT re-open a judged park; a class-level entry (empty requeue) MUST.
    const targeted = [{ class: 'other-heal', landed_ts: '2026-07-02T23:50:00Z', requeue: ['some-other-mission'] }];
    ck(!parkedRevivalDue(au, targeted, { maxAgeDays: 7, now: nowMs }).some((d) => d.path === 'missions/pk-judged.mission.txt'),
      'revival: mission-TARGETED fix (requeue names another mission) does NOT re-open a judged park');
    const classLevel = [{ class: 'engine-capability', landed_ts: '2026-07-02T23:50:00Z', requeue: [] }];
    ck(parkedRevivalDue(au, classLevel, { maxAgeDays: 7, now: nowMs }).some((d) => d.path === 'missions/pk-judged.mission.txt'),
      'revival: CLASS-level fix (empty requeue) still re-opens the judged park');
    const selfTargeted = [{ class: 'own-heal', landed_ts: '2026-07-02T23:50:00Z', requeue: ['pk-judged'] }];
    ck(parkedRevivalDue(au, selfTargeted, { maxAgeDays: 7, now: nowMs }).some((d) => d.path === 'missions/pk-judged.mission.txt'),
      'revival: fix targeted AT the parked mission itself re-opens it');
    // parser: PARKED/SPLIT are first-class, never phantom-pending (pre-fix: "PARKED missions/x" polluted pending)
    ck(au.parked.length === 3 && au.pending.length === 0, 'parser: PARKED lines land in autorun.parked, pending stays clean');
    // FALSE-DEATH SCAN (#25): byte-identity keyed, never presence-keyed.
    {
      const fdAu = parseAutorun('FAILED missions/fd-landed.mission.txt  <!-- t -->\nFAILED missions/fd-wiring.mission.txt  <!-- t -->\nFAILED missions/fd-gone.mission.txt  <!-- t -->\nFAILED missions/fd-judged.mission.txt  <!-- RESOLVED-LANDED earlier -->\n');
      const mtexts = {
        'missions/fd-landed.mission.txt': 'MISSION-CLASS: code-repo\nREPO-ROOT: C:/r\nALLOW-FILES:\n  - js/a.js\n  - css/b.css\nMaqsad: land abc1234 feature',
        'missions/fd-wiring.mission.txt': 'MISSION-CLASS: code-repo\nREPO-ROOT: C:/r\nALLOW-FILES:\n  - js/w.js\n  - map.html\nMaqsad: land abc1234 feature',
        'missions/fd-gone.mission.txt': 'MISSION-CLASS: code-repo\nREPO-ROOT: C:/r\nALLOW-FILES:\n  - js/gone.js\nMaqsad: land abc1234 feature',
        'missions/fd-judged.mission.txt': 'MISSION-CLASS: code-repo\nREPO-ROOT: C:/r\nALLOW-FILES:\n  - js/a.js\nMaqsad: land abc1234 feature',
      };
      const fdGitStub = (repo, argstr) => {
        if (/ls-tree HEAD -- "js\/gone.js"/.test(argstr)) return { ok: true, out: '' };            // absent
        if (/ls-tree/.test(argstr)) return { ok: true, out: '100644 blob x\tfile' };               // present
        if (/diff --quiet abc1234:"map.html"/.test(argstr)) return { ok: false, out: '' };         // differs (wiring dropped)
        if (/diff --quiet/.test(argstr)) return { ok: true, out: '' };                             // identical
        return { ok: true, out: '' };
      };
      const fd = falseDeathScan(fdAu, tmp, { gitFn: fdGitStub, readTextFn: (p) => mtexts[Object.keys(mtexts).find((k) => p.includes(path.basename(k)))] || '' });
      ck(fd.find((c) => c.path.includes('fd-landed'))?.verdict === 'FULL', 'false-death: all files byte-identical at HEAD -> FULL candidate');
      ck(fd.find((c) => c.path.includes('fd-wiring'))?.verdict === 'PARTIAL', 'false-death: file present but DIFFERS (b13-aria wiring control) -> PARTIAL, never FULL');
      ck(!fd.some((c) => c.path.includes('fd-gone')), 'false-death: deliverable absent -> GENUINE death, not surfaced');
      ck(!fd.some((c) => c.path.includes('fd-judged')), 'false-death: already-annotated line skipped (no churn)');
      const fdAu2 = parseAutorun('FAILED missions/fd-nosha.mission.txt  <!-- t -->\n');
      const fd2 = falseDeathScan(fdAu2, tmp, { gitFn: fdGitStub, readTextFn: () => 'MISSION-CLASS: code-repo\nREPO-ROOT: C:/r\nALLOW-FILES:\n  - js/a.js\nMaqsad: no sha named here' });
      ck(fd2.find((c) => c.path.includes('fd-nosha'))?.verdict === 'PARTIAL', 'false-death: NO source sha -> presence-only evidence caps at PARTIAL, never FULL (first-live-pass hole, pinned)');
    }
    const auSplit = parseAutorun('SPLIT missions/parent.mission.txt  <!-- ts -->\nmissions/live.mission.txt\n');
    ck(auSplit.split.length === 1 && auSplit.pending.length === 1, 'parser: SPLIT is first-class; live line still pending');
    // BANKED-DELIVERABLES (#27) contracts: real artifacts surface; judged/numbered/underscore noise stays silent.
    {
      const bAu = parseAutorun('FAILED missions/bk-rich.mission.txt  <!-- t -->\nFAILED missions/bk-judged.mission.txt  <!-- SALVAGE-JUDGED 2026-07-03T04:00Z: surfaced-at review-queue -->\nPARKED missions/bk-empty.mission.txt  <!-- t -->\n');
      const files = {
        'bk-rich': ['part-1.md', 'notes.numbered.md', '_prior-attempt', 'small.md', 'data.json'],
        'bk-judged': ['gold.md'],
        'bk-empty': ['tiny.md'],
      };
      const sizes = { 'part-1.md': 21000, 'small.md': 800, 'gold.md': 90000, 'tiny.md': 400, 'data.json': 99999, 'notes.numbered.md': 30000 };
      const bd = bankedDeliverables(bAu, tmp, {
        readdirFn: (d) => files[path.basename(d)] || null,
        statFn: (p) => ({ isFile: () => true, size: sizes[path.basename(p)] || 0 }),
      });
      ck(bd.length === 1 && bd[0].stem === 'bk-rich' && bd[0].artifacts.length === 1 && bd[0].artifacts[0].name === 'part-1.md',
        'banked: >=5KB md surfaces; numbered/underscore/json/small excluded; SALVAGE-JUDGED and artifact-free sandboxes stay quiet');
      // REAL-FS smoke (2026-07-03: the injected-statFn test above passed while the live scan
      // returned ZERO — statSync was never imported and the default statFn swallowed its own
      // ReferenceError. Injection-only tests cannot catch missing default deps; this one runs
      // the REAL default readdir/stat path against a real temp sandbox.)
      mkdirSync(path.join(tmp, 'missions', 'bk-real'), { recursive: true });
      writeFileSync(path.join(tmp, 'missions', 'bk-real', 'real-artifact.md'), 'x'.repeat(6000));
      const bdReal = bankedDeliverables(parseAutorun('FAILED missions/bk-real.mission.txt  <!-- t -->\n'), tmp);
      ck(bdReal.length === 1 && bdReal[0].artifacts[0].name === 'real-artifact.md',
        'banked REAL-FS smoke: the default readdir/stat path actually works (no injected fns — catches missing imports)');
    }
  }

  // fixture 1c: REQUEUE-ON-FIX-LANDED — a fix-ledger entry naming a FAILED mission makes
  // a mechanical requeue; heal() bares the line (daemon re-fires) + flips it ONCE.
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'),
    '# q\nFAILED missions/healed.mission.txt  <!-- pending engine batch -->\nFAILED missions/other.mission.txt  <!-- t -->\n');
  writeFileSync(path.join(tmp, 'missions', 'healed.mission.txt'), 'MISSION-CLASS: test\n');
  // AUDIT FIX 2026-07-02: 'other' must exist on disk — "untouched" means a LIVE unrelated mission
  // survives heal; a ghost line is CORRECTLY dead-stem-retired (that behavior has its own invariant).
  writeFileSync(path.join(tmp, 'missions', 'other.mission.txt'), 'MISSION-CLASS: test\n');
  recordFix(tmp, { cls: 'fabricated-citation', fix: 'citation_guard gate', requeue: ['healed'] }, now);
  r = sweep(tmp, now, noRoute, sightOk);
  ck(r.actions.some((a) => a.id === 'REQUEUE-healed' && a.class === 'mechanical' && a.approved_by_faith), 'fix-landed: a FAILED mission in the ledger becomes a mechanical requeue');
  ck(!r.actions.some((a) => a.id === 'REQUEUE-other'), 'a FAILED mission NOT in the ledger is not requeued (no blind relaunch)');
  // this fixture tests the ledger-requeue path, not restart behavior -- reset the daemon
  // to healthy (fixture 1's dead-pid/stale/lanes-nonempty status otherwise leaks forward
  // and would spuriously demand a restart the exec stub below is not expecting). Both
  // daemon-status.json AND daemon.pid must be reset -- sweep()'s daemonAlive check reads
  // the pidfile independently of the status blob.
  writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: process.pid, state: 'running', lanes: [], queued: 0, ts: new Date(now).toISOString() }));
  writeFileSync(path.join(logs, 'daemon.pid'), String(process.pid));
  const healed = heal(tmp, now, { exec: () => { throw new Error('must not restart a healthy daemon'); } });
  ck(healed.performed.some((p) => p.action === 'requeue' && p.stem === 'healed'), 'heal(): requeue performed');
  const after = parseAutorun(readText(path.join(tmp, 'missions', 'AUTORUN.md')));
  ck(after.pending.includes('missions/healed.mission.txt'), 'heal(): the healed mission line is now bare (pending → daemon re-fires)');
  ck(after.failed.includes('missions/other.mission.txt'), 'heal(): the unrelated FAILED line is untouched');
  // once-only: a second sweep sees the entry requeued and emits NO requeue action.
  r = sweep(tmp, now, noRoute, sightOk);
  ck(!r.actions.some((a) => String(a.id).startsWith('REQUEUE-')), 'once-only: a requeued ledger entry never fires again (no auto-loop)');

  // fixture 1c-perstem (mt-c3-perstem): legacy bare-string requeue migrates transparently on
  // read; a partial requeue (one stem fireable, one not yet FAILED) leaves the entry open and
  // the still-pending stem live; the entry closes only once EVERY stem has been requeued.
  writeFixLedger(tmp, { entries: [{ class: 'legacy-class', fix: 'legacy fix', landed_ts: new Date(now).toISOString(), requeue: ['legacy-stem'], requeued: false }] });
  const migratedLedger = readFixLedger(tmp);
  ck(migratedLedger.entries[0].requeue[0]?.stem === 'legacy-stem' && migratedLedger.entries[0].requeue[0]?.requeued === false,
    'mt-c3-perstem: readFixLedger migrates a legacy bare-string requeue entry into {stem, requeued:false}');

  writeFileSync(path.join(tmp, 'missions', 'perstem-a.mission.txt'), 'MISSION-CLASS: test\n');
  writeFileSync(path.join(tmp, 'missions', 'perstem-b.mission.txt'), 'MISSION-CLASS: test\n');
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/perstem-a.mission.txt  <!-- t -->\n');
  writeFixLedger(tmp, { entries: [] });
  recordFix(tmp, { cls: 'perstem-class', fix: 'perstem fix', requeue: ['perstem-a', 'perstem-b'] }, now);
  const healPartial = heal(tmp, now, { exec: () => { throw new Error('no restart expected'); } });
  ck(healPartial.performed.some((p) => p.action === 'requeue' && p.stem === 'perstem-a'), 'mt-c3-perstem partial: the currently-FAILED stem (perstem-a) is requeued');
  const ledgerAfterPartial = readFixLedger(tmp);
  const entryPartial = ledgerAfterPartial.entries.find((e) => e.class === 'perstem-class');
  ck(entryPartial.requeued === false, 'mt-c3-perstem partial: the ENTRY stays open — perstem-b has not requeued yet');
  ck(entryPartial.requeue.find((it) => it.stem === 'perstem-a').requeued === true, 'mt-c3-perstem partial: perstem-a is individually marked requeued:true');
  ck(entryPartial.requeue.find((it) => it.stem === 'perstem-b').requeued === false, 'mt-c3-perstem partial: perstem-b is left live (requeued:false)');
  const afterPartialAutorun = parseAutorun(readText(path.join(tmp, 'missions', 'AUTORUN.md')));
  ck(afterPartialAutorun.pending.includes('missions/perstem-a.mission.txt'), 'mt-c3-perstem partial: perstem-a line bared to pending (daemon re-fires)');

  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/perstem-b.mission.txt  <!-- t -->\n');
  const healFull = heal(tmp, now, { exec: () => { throw new Error('no restart expected'); } });
  ck(healFull.performed.some((p) => p.action === 'requeue' && p.stem === 'perstem-b'), 'mt-c3-perstem full: perstem-b requeues once it too is FAILED');
  const ledgerAfterFull = readFixLedger(tmp);
  const entryFull = ledgerAfterFull.entries.find((e) => e.class === 'perstem-class');
  ck(entryFull.requeued === true, 'mt-c3-perstem full: the entry closes (requeued:true) only once EVERY stem has been requeued');
  writeFixLedger(tmp, { entries: [] });

  // fixture 1c-missing: REQUEUE-ON-FIX-LANDED must NOT requeue a stem whose mission.txt
  // was deleted (2026-07-01 real incident: 10 of 19 stems fed to --record/--heal this
  // session had already-retired mission files; the requeue fired anyway and wasted a
  // cycle on FAILED(missing file)). The skip must be reported, not silently dropped.
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/ghost.mission.txt  <!-- t -->\n');
  recordFix(tmp, { cls: 'test-class', fix: 'test fix', requeue: ['ghost'] }, now);
  r = sweep(tmp, now, noRoute, sightOk);
  ck(!r.actions.some((a) => a.id === 'REQUEUE-ghost'), 'REQUEUE is skipped when the mission.txt file does not exist on disk');
  ck(r.report.some((l) => l.includes('REQUEUE SKIPPED') && l.includes('ghost')), 'the skip is named on the report, not silently dropped');

  // fixture 1c2: CHAIN-ON-DONE — a DONE mission declaring ON-DONE pulls its follow-on
  // into the queue mechanically; once-only; missing target file is report-only.
  writeFileSync(path.join(tmp, 'missions', 'producer.mission.txt'), 'Maqsad: data.\nON-DONE: missions/follow-on.mission.txt\nDone means: data exists.');
  writeFileSync(path.join(tmp, 'missions', 'follow-on.mission.txt'), 'Maqsad: integrate the data. Done means: integrated.');
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nDONE missions/producer.mission.txt  <!-- t -->\n');
  r = sweep(tmp, now, noRoute, sightOk);
  ck(r.actions.some((a) => a.id === 'CHAIN-follow-on' && a.class === 'mechanical' && a.approved_by_faith), 'ON-DONE: a DONE producer pulls its follow-on as a mechanical queue action');
  const h1c2 = heal(tmp, now, { exec: () => { throw new Error('no restart expected'); } });
  ck(h1c2.performed.some((p) => p.action === 'chain-queue' && p.stem === 'follow-on'), 'heal(): chain target appended to AUTORUN');
  const after1c2 = parseAutorun(readText(path.join(tmp, 'missions', 'AUTORUN.md')));
  ck(after1c2.pending.includes('missions/follow-on.mission.txt'), 'chain target is pending (daemon will fire it)');
  r = sweep(tmp, now, noRoute, sightOk);
  ck(!r.actions.some((a) => a.id === 'CHAIN-follow-on'), 'once-only: a queued chain target never re-fires (any status counts as present)');
  writeFileSync(path.join(tmp, 'missions', 'producer2.mission.txt'), 'Maqsad: x.\nON-DONE: missions/ghost.mission.txt\nDone means: x.');
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nDONE missions/producer2.mission.txt  <!-- t -->\n');
  r = sweep(tmp, now, noRoute, sightOk);
  ck(!r.actions.some((a) => String(a.id).startsWith('CHAIN-')) && r.report.some((l) => l.includes('ON-DONE target missing')), 'missing chain-target file is REPORT-only, never a broken queue line');

  // fixture 1d: heal() REFUSES to restart a dead daemon while a lane is running.
  writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: 999999999, state: 'running', lanes: ['missions/live.mission.txt'], queued: 0, ts: new Date(now - 10 * 60000).toISOString() }));
  writeFileSync(path.join(logs, 'daemon.pid'), '999999999');
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nRUNNING missions/live.mission.txt  <!-- t -->\n');
  const h2 = heal(tmp, now, { exec: () => { throw new Error('RESTART FIRED WHILE A LANE WAS RUNNING'); } });
  ck(h2.performed.some((p) => p.action === 'restart-skipped'), 'heal(): never restarts while a lane runs (a live mission is never killed)');

  // fixture 1e: DAMM + WAIVER HARDENING — unrepaid damm is a required action; a waiver
  // without reason+witness is STILL OWED; a witnessed waiver clears.
  writeFileSync(path.join(logs, 'damm-queue.json'), JSON.stringify({ entries: [
    { mission: 'm1', finding: 'gap A', repaid: false },
    { mission: 'm2', finding: 'gap B', repaid: false, waived: true },                                              // side-door waiver: no reason/witness
    { mission: 'm3', finding: 'gap C', repaid: false, waived: true, waive_reason: 'superseded by redesign', waive_witness: 'laguna 2026-06-11' },
  ] }));
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\n');
  r = sweep(tmp, now, noRoute, sightOk);
  ck(r.actions.some((a) => a.id === 'REPAY-DAMM'), 'unrepaid damm -> REQUIRED ACTION every beat (no graveyard)');
  ck(r.report.some((l) => /2 OWED of 3/.test(l)), 'unwitnessed waiver is STILL OWED (side-door closed); witnessed waiver clears');
  writeFileSync(path.join(logs, 'damm-queue.json'), JSON.stringify({ entries: [] }));

  // fixture 1f: SEARXNG SIGHT-CHECK — a blind backend is a receipted, mechanical action.
  {
    const blind = sweep(tmp, now, noRoute, { sightFn: () => ({ ok: false, reason: 'zero results on control query' }), modelTagsFn: sightOk.modelTagsFn });
    ck(blind.actions.some((a) => a.id === 'RESTART-SEARXNG' && a.class === 'mechanical'), 'blind searxng -> RESTART-SEARXNG mechanical action (the wedge can never again pass unwitnessed)');
    ck(blind.report.some((l) => /SEARXNG BLIND/.test(l)), 'blind searxng surfaces on the report');
  }

  // fixture 1g: CG-INCREMENT GATE — stale v3 repo demands an increment; fresh stays silent.
  {
    const stale = sweep(tmp, now, noRoute, { sightFn: () => ({ ok: true, results: 9 }), cgAgeFn: () => ({ ok: true, minutes: 120 }), modelTagsFn: sightOk.modelTagsFn });
    ck(stale.actions.some((a) => a.id === 'CG-INCREMENT-DUE'), 'stale CG repo -> CG-INCREMENT-DUE on the beat (idle=CG is now a condition, not willpower)');
    const fresh = sweep(tmp, now, noRoute, { sightFn: () => ({ ok: true, results: 9 }), cgAgeFn: () => ({ ok: true, minutes: 10 }), modelTagsFn: sightOk.modelTagsFn });
    ck(!fresh.actions.some((a) => a.id === 'CG-INCREMENT-DUE'), 'fresh CG repo -> no nag (the gate has a dead-band, not a drumbeat)');
  }

  // fixture 1g2: mt-model-audit-fn — auditModelIdentities() unit contract + sweep wiring.
  // Synthetic 5-model array: one fraud group (3 textually-unrelated names, same digest) +
  // one benign :latest-alias group (2 names sharing the same pre-colon prefix, same digest).
  {
    const synthetic = [
      { name: 'qwen3-coder-next', digest: 'abc111' },
      { name: 'kimi-k2.7-code', digest: 'abc111' },
      { name: 'north-mini-code-toolcall', digest: 'abc111' },
      { name: 'llama4:scout', digest: 'def222' },
      { name: 'llama4:latest', digest: 'def222' },
    ];
    const auditResult = auditModelIdentities(synthetic);
    ck(auditResult.fraudGroups.length === 1 && auditResult.fraudGroups[0].digest === 'abc111', 'exactly one fraud group detected, keyed on the shared digest');
    ck(auditResult.fraudGroups[0].names.length === 3, 'fraud group carries all 3 textually-unrelated aliases');
    ck(auditResult.benignGroups.length === 1 && auditResult.benignGroups[0].digest === 'def222', 'the :latest-alias group is classified benign, not flagged as fraud');
    ck(!auditModelIdentities([{ name: 'solo:latest', digest: 'ghi333' }]).fraudGroups.length, 'a single-name digest group is neither fraud nor benign (nothing to compare)');

    const flagged = sweep(tmp, now, noRoute, { ...sightOk, modelTagsFn: () => ({ ok: true, models: synthetic }) });
    ck(flagged.report.some((l) => /MODEL-IDENTITY FLAG/.test(l) && l.includes('qwen3-coder-next') && l.includes('north-mini-code-toolcall')), 'sweep surfaces the fraud group as a MODEL-IDENTITY FLAG line naming all its aliases');
    ck(!flagged.report.some((l) => /MODEL-IDENTITY FLAG/.test(l) && l.includes('llama4:scout')), 'the benign :latest group never appears in a FLAG line');

    const skipped = sweep(tmp, now, noRoute, { ...sightOk, modelTagsFn: () => ({ ok: false, reason: 'nxtbeast unreachable (test)' }) });
    ck(skipped.report.some((l) => /model-identity audit SKIP/.test(l)), 'unreachable nxtbeast skips the audit with a named reason, never crashes the sweep');
  }

  // fixture 1h: STUCK-TASK detection + heal() kills and requeues.
  // ROOT FIX 2026-07-02: a stuck VERDICT now requires BOTH an old lane AND a dead-quiet heartbeat
  // with no in-flight attempt — a fresh/in-flight heartbeat means a long seat call (work, not hang).
  writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: 77777, state: 'running', lanes: [{ path: 'missions/stuck.mission.txt', start_ts: new Date(now - 16 * 60000).toISOString() }], queued: 0, ts: new Date(now).toISOString() }));
  writeFileSync(path.join(logs, 'daemon.pid'), '77777');
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nRUNNING missions/stuck.mission.txt  <!-- t -->\n');
  // suppress case A: FRESH heartbeat (1m old) -> no kill, suppressed line on report
  writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), `${new Date(now - 1 * 60000).toISOString()} attempt-ok provider=ollama-cloud model=kimi-k2.6 heal=0 ms=1 chars=10\n`);
  r = sweep(tmp, now, noRoute, sightOk);
  ck(!r.actions.some((a) => a.id === 'STUCK-TASK'), 'old lane + FRESH heartbeat -> STUCK-TASK suppressed (long seat call is work, not a hang)');
  ck(r.report.some((l) => /STUCK-CANDIDATE suppressed/.test(l)), 'suppression is reported, never silent');
  // suppress case B: old heartbeat but last line is an IN-FLIGHT attempt-start -> no kill
  writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), `${new Date(now - 20 * 60000).toISOString()} attempt-start provider=claude-claude-sonnet-5 (NAMED claude seat) timeout=4800\n`);
  r = sweep(tmp, now, noRoute, sightOk);
  ck(!r.actions.some((a) => a.id === 'STUCK-TASK'), 'old lane + IN-FLIGHT attempt-start -> STUCK-TASK suppressed (seat still working)');
  // genuine hang: old lane AND dead-quiet heartbeat (20m, last event a completion) -> KILL
  writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), `${new Date(now - 20 * 60000).toISOString()} attempt-ok provider=ollama-cloud model=kimi-k2.6 heal=0 ms=1 chars=10\n`);
  r = sweep(tmp, now, noRoute, sightOk);
  ck(r.actions.some((a) => a.id === 'STUCK-TASK' && a.class === 'mechanical' && a.approved_by_faith && /77777/.test(a.command)), 'stuck lane -> STUCK-TASK mechanical action with taskkill command');
  ck(r.report.some((l) => /STUCK-TASK.*stuck.mission.txt/.test(l)), 'stuck lane surfaces on report');
  const killed = [];
  const hStuck = heal(tmp, now, { exec: (cmd) => { killed.push(cmd); } });
  ck(hStuck.performed.some((p) => p.action === 'stuck-requeue' && p.stem === 'stuck'), 'heal(): stuck task bared and marked for requeue');
  ck(killed.some((cmd) => /taskkill.*\/PID\s+77777.*\/F.*\/T/.test(cmd)), 'heal(): taskkill issued for stuck lane');
  const afterStuck = parseAutorun(readText(path.join(tmp, 'missions', 'AUTORUN.md')));
  ck(afterStuck.pending.includes('missions/stuck.mission.txt'), 'heal(): RUNNING line bared to pending');
  const events = readText(path.join(logs, 'daemon-events.log'));
  ck(events.includes('SWEEP-HEAL') && events.includes('STUCK-TASK') && events.includes('stuck.mission.txt'), 'heal(): SWEEP-HEAL event logged to daemon-events.log');

  // fixture: STUCK-TASK kill-scope honesty (hunt-item #3's second half, GAP-CLOSURE-PLAYBOOK
  // UNIT E4, 2026-07-04) -- with a SECOND, genuinely healthy lane also running (MAX_LANES=2
  // default), the taskkill on the whole daemon PID collaterally kills it too. The action must
  // name that lane explicitly, not silently expand its own blast radius.
  {
    writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({
      pid: 77777, state: 'running',
      lanes: [
        { path: 'missions/stuck.mission.txt', start_ts: new Date(now - 16 * 60000).toISOString() },
        { path: 'missions/healthy-other.mission.txt', start_ts: new Date(now - 2 * 60000).toISOString() },
      ],
      queued: 0, ts: new Date(now).toISOString(),
    }));
    writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nRUNNING missions/stuck.mission.txt  <!-- t -->\nRUNNING missions/healthy-other.mission.txt  <!-- t -->\n');
    writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), `${new Date(now - 20 * 60000).toISOString()} attempt-ok provider=ollama-cloud model=kimi-k2.6 heal=0 ms=1 chars=10\n`);
    const rCollateral = sweep(tmp, now, noRoute, sightOk);
    const stuckAction2 = rCollateral.actions.find((a) => a.id === 'STUCK-TASK');
    ck(!!stuckAction2 && stuckAction2.collateral_paths.includes('missions/healthy-other.mission.txt'), 'STUCK-TASK: the genuinely healthy second lane is named in collateral_paths, not silently dropped');
    ck(/healthy-other\.mission\.txt.*ALSO be killed/.test(stuckAction2.why), 'STUCK-TASK: the why text explicitly warns the healthy lane will ALSO be killed (real blast radius, not assumed single-lane scope)');
    ck(!stuckAction2.stuck_paths.includes('missions/healthy-other.mission.txt'), 'STUCK-TASK: the healthy lane is in collateral_paths, never misclassified as stuck_paths');
  }

  // fixture 1i: detectStuckLanes and detectLoopCaps direct checks + LOOP-CAP sweep.
  const dl = detectStuckLanes({ pid: 1, lanes: [{ path: 'missions/a.mission.txt', start_ts: new Date(now - 16 * 60000).toISOString() }, { path: 'missions/b.mission.txt', start_ts: new Date(now - 2 * 60000).toISOString() }, 'missions/c.mission.txt'] }, now);
  ck(dl.length === 1 && dl[0].path === 'missions/a.mission.txt' && dl[0].stuck, 'detectStuckLanes flags only lanes over TASK_STUCK_MS');
  const lc = detectLoopCaps(parseAutorun('DONE missions/loop.mission.txt\nFAILED missions/loop.mission.txt\nRUNNING missions/loop.mission.txt\n'));
  ck(lc.length === 1 && lc[0].stem === 'loop' && lc[0].count === 3, 'detectLoopCaps caps a stem appearing LOOP_CAP_REPEATS times');
  const lc2 = detectLoopCaps(parseAutorun('DONE missions/once.mission.txt\nFAILED missions/twice.mission.txt\n'));
  ck(lc2.length === 0, 'detectLoopCaps ignores stems below cap');

  // fixture 1w: WORKTREE-HEAL (succession build) — detection + sweep action + heal performer,
  // gitFn/exec injected so no real repo or git is touched.
  const cleanPorcelain = () => '';
  const unmergedPorcelain = () => 'UU map.html\nA  js/onboarding.js\n?? aurora-render-witness.html\n';
  const w1 = detectWorktreeCorruption('C:/fake/repo', () => cleanPorcelain());
  ck(!w1.corrupted && w1.unmerged.length === 0, 'detectWorktreeCorruption: clean tree -> not corrupted');
  const w2 = detectWorktreeCorruption('C:/fake/repo', () => unmergedPorcelain());
  ck(w2.corrupted && w2.unmerged.includes('map.html') && w2.untracked.includes('aurora-render-witness.html'), 'detectWorktreeCorruption: UU map.html -> corrupted, unmerged+untracked classified');
  ck(w2.staged.includes('js/onboarding.js'), 'detectWorktreeCorruption: staged-orphan (A ) classified as staged (the photo-upload-ux gap)');
  // staged-only tree (no unmerged, no mid-op) is STILL corrupted — blocks the containment preflight
  const w3 = detectWorktreeCorruption('C:/fake/repo', () => 'A  js/photo-upload-ux.js\n');
  ck(w3.corrupted && w3.staged.includes('js/photo-upload-ux.js') && w3.unmerged.length === 0, 'detectWorktreeCorruption: staged-only orphan -> corrupted via staged (not unmerged)');
  // sweep emits a WORKTREE-HEAL action with a checkout-HEAD command for the unmerged file
  const wtGit = (repoRoot, args) => (args === 'status --porcelain' ? unmergedPorcelain() : '');
  const rw = sweep(tmp, now, noRoute, { ...sightOk, worktreeReposFn: () => ['C:/fake/repo'], gitFn: wtGit });
  const wha = rw.actions.find((a) => String(a.id).startsWith('WORKTREE-HEAL-'));
  ck(!!wha && wha.class === 'mechanical' && wha.approved_by_faith, 'sweep: corrupted worktree -> WORKTREE-HEAL mechanical action');
  ck(wha.commands.some((c) => /checkout HEAD -- "map.html"/.test(c)), 'WORKTREE-HEAL: command restores the unmerged file from HEAD');
  ck(wha.untracked_orphans.includes('aurora-render-witness.html') && !wha.commands.some((c) => /aurora-render-witness/.test(c)), 'WORKTREE-HEAL: untracked orphan is report-only, never in a command');
  ck(wha.commands.some((c) => /reset -q -- "js\/onboarding\.js"/.test(c)), 'WORKTREE-HEAL: staged orphan gets an UNSTAGE (git reset --) command');
  ck(!wha.commands.some((c) => /checkout HEAD -- "js\/onboarding\.js"|rm .*onboarding/.test(c)), 'WORKTREE-HEAL: staged orphan is UNSTAGED only, never checkout/rm (non-destructive)');
  // LIVE-LANE suppression (2026-07-03): a repo that is a RUNNING lane's REPO-ROOT is never
  // healed — porcelain cannot tell the mission's OWN in-flight staged work (a step-1
  // checkout-restore stages the file) from an orphan. Receipt: 13:48Z sweep queued an
  // unstage against S1.S1's live catalog restore. Fixture uses backslash + case-mangled
  // REPO-ROOT to prove path normalization.
  writeFileSync(path.join(tmp, 'missions', 'live-wt.mission.txt'), 'MISSION-ID: live-wt\nMISSION-CLASS: code-repo\nREPO-ROOT: C:\\FAKE\\repo\nMaqsad: t\n');
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nRUNNING missions/live-wt.mission.txt  <!-- t -->\n');
  const rLive = sweep(tmp, now, noRoute, { ...sightOk, worktreeReposFn: () => ['C:/fake/repo'], gitFn: wtGit });
  ck(!rLive.actions.some((a) => String(a.id).startsWith('WORKTREE-HEAL-')), 'WORKTREE-HEAL: repo with a RUNNING lane -> NO heal action (live mission staged work protected)');
  ck(rLive.report.some((l) => /WORKTREE-HEAL suppressed/.test(l)), 'WORKTREE-HEAL: live-lane suppression is reported, never silent');
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nRUNNING missions/stuck.mission.txt  <!-- t -->\n');   // restore: heal-performer fixture below needs the heal UNsuppressed
  // heal() runs the recovery commands via exec()
  const wtRan = [];
  const rwHeal = sweep(tmp, now, noRoute, { ...sightOk, worktreeReposFn: () => ['C:/fake/repo'], gitFn: wtGit });
  // reset daemon healthy so heal() doesn't try to restart in this fixture
  writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: process.pid, state: 'running', lanes: [], queued: 0, ts: new Date(now).toISOString() }));
  writeFileSync(path.join(logs, 'daemon.pid'), String(process.pid));
  const hw = heal(tmp, now, { exec: (cmd) => { wtRan.push(cmd); }, sightFn: sightOk.sightFn, worktreeReposFn: () => ['C:/fake/repo'], gitFn: wtGit });
  ck(wtRan.some((c) => /checkout HEAD -- "map.html"/.test(c)), 'heal(): WORKTREE-HEAL runs the checkout-HEAD recovery via exec');
  ck(hw.performed.some((p) => p.action === 'worktree-heal' && p.repo === 'C:/fake/repo'), 'heal(): worktree-heal recorded in performed with repo');
  writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: process.pid, state: 'running', lanes: [], queued: 0, ts: new Date(now).toISOString() }));
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nDONE missions/loop.mission.txt\nFAILED missions/loop.mission.txt\nRUNNING missions/loop.mission.txt\n');
  r = sweep(tmp, now, noRoute, sightOk);
  ck(r.actions.some((a) => a.id === 'LOOP-CAP' && a.class === 'mechanical' && a.approved_by_faith), 'sweep emits LOOP-CAP mechanical action for looping stem');

  // fixture 1i2: heal() actually RETIRES a bare/pending line for a capped stem (the remedy
  // half of LOOP-CAP -- detection existed and was tested; heal() never acted on it until now).
  // A 4th bare occurrence is exactly "about to fire again" -- the case the action's own why-text
  // ("must be capped, not allowed to burn quota indefinitely") warns about.
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'),
    '# q\nDONE missions/loop.mission.txt\nFAILED missions/loop.mission.txt\nRUNNING missions/loop.mission.txt\nmissions/loop.mission.txt  <!-- would fire a 4th time -->\nmissions/other.mission.txt  <!-- unrelated, must survive -->\n');
  const rLoop = sweep(tmp, now, noRoute, sightOk);
  const healedLoop = heal(tmp, now, { exec: () => {} });
  ck(healedLoop.performed.some((p) => p.action === 'loop-cap-retire' && p.stem === 'loop'), 'heal(): LOOP-CAP retires the bare re-fire-risk line');
  const afterLoop = readText(path.join(tmp, 'missions', 'AUTORUN.md'));
  ck(/^# LOOP-CAP-RETIRED.*missions\/loop\.mission\.txt/m.test(afterLoop), 'heal(): the retired line is commented out with a named LOOP-CAP-RETIRED annotation');
  ck(afterLoop.includes('DONE missions/loop.mission.txt') && afterLoop.includes('FAILED missions/loop.mission.txt') && afterLoop.includes('RUNNING missions/loop.mission.txt'), 'heal(): DONE/FAILED/RUNNING history lines for the same stem are left untouched (not a re-fire risk)');
  ck(/^missions\/other\.mission\.txt/m.test(afterLoop), 'heal(): an unrelated bare mission is never touched by LOOP-CAP retirement');
  // NOTE: sweep() still REPORTS LOOP-CAP after retirement -- DONE+FAILED+RUNNING alone (3
  // permanent history lines) already sit at the cap forever, and that's correct: the report
  // is honest history ("this stem looped 3x"), not a live re-fire warning. What must NOT
  // happen is heal() finding MORE to retire on a second pass (idempotent -- nothing bare left).
  const healedLoop2 = heal(tmp, now, { exec: () => {} });
  ck(!healedLoop2.performed.some((p) => p.action === 'loop-cap-retire'), 'heal(): idempotent -- a second heal() pass retires nothing further (no bare line remains for this stem)');

  // fixture: STRANDED-SPLIT-CHILD RECOVERY (hunt-item #16, 2026-07-04) -- a manifest naming
  // TWO children, one genuinely stranded (file on disk, no AUTORUN line at all) and one already
  // properly queued; a THIRD manifest entry whose file was never actually created (nothing to
  // recover, must not fabricate a queue line for a mission that doesn't exist).
  {
    writeFileSync(path.join(tmp, 'missions', 'splitpar.S1.mission.txt'), 'MISSION-ID: x\nMaqsad: stranded child\n');
    writeFileSync(path.join(tmp, 'missions', 'splitpar.S2.mission.txt'), 'MISSION-ID: x\nMaqsad: already-queued child\n');
    // deliberately do NOT create splitpar.S3.mission.txt -- it's in the manifest but never landed
    writeFileSync(path.join(tmp, 'missions', 'splitpar._split-manifest.json'), JSON.stringify({
      parentId: 'splitpar', ceiling: 8, originalStepCount: 20, groupCount: 3,
      children: [
        { id: 'splitpar.S1', file: 'missions/splitpar.S1.mission.txt', steps: 5, requires: null },
        { id: 'splitpar.S2', file: 'missions/splitpar.S2.mission.txt', steps: 6, requires: 'splitpar.S1' },
        { id: 'splitpar.S3', file: 'missions/splitpar.S3.mission.txt', steps: 4, requires: 'splitpar.S2' },
      ],
      ts: new Date(now).toISOString(),
    }));
    writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nmissions/splitpar.S2.mission.txt  <!-- already queued, untouched -->\n');
    const healedStranded = heal(tmp, now, { exec: () => {} });
    ck(healedStranded.performed.some((p) => p.action === 'stranded-split-recovery' && p.stem === 'splitpar.S1'), 'heal(): a manifest child with NO AUTORUN line at all, but a real mission.txt on disk, is recovered');
    ck(!healedStranded.performed.some((p) => p.action === 'stranded-split-recovery' && p.stem === 'splitpar.S2'), 'heal(): an already-queued manifest child is left alone -- not re-added as a duplicate');
    ck(!healedStranded.performed.some((p) => p.action === 'stranded-split-recovery' && p.stem === 'splitpar.S3'), 'heal(): a manifest child whose mission.txt was never actually created is NOT recovered -- nothing to fabricate a queue line for');
    const afterStranded = readText(path.join(tmp, 'missions', 'AUTORUN.md'));
    ck(/^missions\/splitpar\.S1\.mission\.txt\s+<!-- SPLIT-CHILD -->$/m.test(afterStranded), 'heal(): the recovered line is tagged SPLIT-CHILD -- the QUEUE-DUP guard exemption (hunt-item #13) applies to it too');
    ck(afterStranded.includes('missions/splitpar.S2.mission.txt  <!-- already queued, untouched -->'), 'heal(): the already-queued line is byte-unchanged, not duplicated or rewritten');
    const healedStranded2 = heal(tmp, now, { exec: () => {} });
    ck(!healedStranded2.performed.some((p) => p.action === 'stranded-split-recovery'), 'heal(): idempotent -- a second pass recovers nothing further (the S1 line now satisfies the manifest check)');
    rmSync(path.join(tmp, 'missions', 'splitpar._split-manifest.json'), { force: true });
    rmSync(path.join(tmp, 'missions', 'splitpar.S1.mission.txt'), { force: true });
    rmSync(path.join(tmp, 'missions', 'splitpar.S2.mission.txt'), { force: true });
  }

  // fixture 1j: HEARTBEAT FLAG TABLE (mt-b2-flag-table, step B2) — EMPTY_CONTENT_THINKING and
  // CUDA are byte-equivalent migrations off the old hand-written if-blocks; LOCAL_TIMEOUT and
  // LOCAL_NETWORK are new local-lane rows riding the same iteration.
  {
    const mkLine = (mn, text) => `${new Date(now - mn * 60000).toISOString()} ${text}`;
    // old EMPTY_CONTENT_THINKING fixture: byte-identical flag line at threshold (3)
    writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), [
      mkLine(3, 'attempt-fail provider=ollama-cloud model=kimi-k2.6 EMPTY_CONTENT_THINKING'),
      mkLine(2, 'attempt-fail provider=ollama-cloud model=kimi-k2.6 EMPTY_CONTENT_THINKING'),
      mkLine(1, 'attempt-fail provider=ollama-cloud model=kimi-k2.6 EMPTY_CONTENT_THINKING'),
    ].join('\n') + '\n');
    let rf = sweep(tmp, now, noRoute, sightOk);
    ck(rf.report.includes('FLAG: 3 EMPTY_CONTENT_THINKING failures in window — known quota-burn class (QUEUE: KIMI THINKING-BURN FIX)'), 'mt-b2-flag-table: EMPTY_CONTENT_THINKING row is byte-identical to the old hand-written flag line');

    // old CUDA fixture: byte-identical flag line + action at threshold (1)
    writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), mkLine(1, 'attempt-fail provider=ollama-cloud model=gemma4:31b CUDA error: illegal memory access') + '\n');
    rf = sweep(tmp, now, noRoute, sightOk);
    ck(rf.report.includes('FLAG: 1 CUDA error(s) in window — GPU-runner crash class; heals mask chronic degradation (155-over-4-days receipt 2026-07-03). Name the model, check the census (grep CUDA dispatch-heartbeat.log | count by model), escalate per the QUEUE watch-item conditions'), 'mt-b2-flag-table: CUDA row is byte-identical to the old hand-written flag line');
    ck(rf.actions.some((a) => a.id === 'CUDA-CRASH-CLASS'), 'mt-b2-flag-table: CUDA row still emits its CUDA-CRASH-CLASS action');

    // new LOCAL_TIMEOUT row: fires exactly at its threshold (3)
    writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), [
      mkLine(3, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000'),
      mkLine(2, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000'),
      mkLine(1, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000'),
    ].join('\n') + '\n');
    rf = sweep(tmp, now, noRoute, sightOk);
    ck(rf.report.some((l) => l.includes('FLAG: 3') && l.includes('local TIMEOUT')), 'mt-b2-flag-table: new local-TIMEOUT row fires its flag line at threshold');

    // new LOCAL_NETWORK row: fires exactly at its threshold (3)
    writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), [
      mkLine(3, 'attempt-fail provider=ollama-local model=qwen3.6 kind=NETWORK ms=100'),
      mkLine(2, 'attempt-fail provider=ollama-local model=qwen3.6 kind=NETWORK ms=100'),
      mkLine(1, 'attempt-fail provider=ollama-local model=qwen3.6 kind=NETWORK ms=100'),
    ].join('\n') + '\n');
    rf = sweep(tmp, now, noRoute, sightOk);
    ck(rf.report.some((l) => l.includes('FLAG: 3') && l.includes('local NETWORK')), 'mt-b2-flag-table: new local-NETWORK row fires its flag line at threshold');

    // below threshold (2 of 3) for either new row stays silent
    writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), [
      mkLine(2, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000'),
      mkLine(1, 'attempt-fail provider=ollama-local model=qwen3.6 kind=TIMEOUT ms=9000'),
    ].join('\n') + '\n');
    rf = sweep(tmp, now, noRoute, sightOk);
    ck(!rf.report.some((l) => l.includes('local TIMEOUT')), 'mt-b2-flag-table: local-TIMEOUT below threshold stays silent');

    writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), [
      mkLine(2, 'attempt-fail provider=ollama-local model=qwen3.6 kind=NETWORK ms=100'),
      mkLine(1, 'attempt-fail provider=ollama-local model=qwen3.6 kind=NETWORK ms=100'),
    ].join('\n') + '\n');
    rf = sweep(tmp, now, noRoute, sightOk);
    ck(!rf.report.some((l) => l.includes('local NETWORK')), 'mt-b2-flag-table: local-NETWORK below threshold stays silent');
  }

  // fixture 2: healthy daemon (our own pid alive, fresh status), clean ledger. A healthy state now
  // INCLUDES a current deploy marker (L4): healthy means deployed-current, not merely committed.
  writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: process.pid, state: 'running', lanes: [], queued: 0, ts: new Date(now).toISOString() }));
  writeFileSync(path.join(logs, 'daemon.pid'), String(process.pid));
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nDONE missions/good.mission.txt  <!-- t -->\n');
  writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), `${new Date(now - 60000).toISOString()} attempt-ok provider=ollama-cloud model=kimi-k2.6 heal=0 ms=1 chars=10\n`);
  writeFileSync(path.join(logs, 'last-deployed.json'), JSON.stringify({ sha: 'a'.repeat(40), ts: new Date(now).toISOString() }));
  r = sweep(tmp, now, noRoute, sightOk);
  ck(r.daemonAlive === true, 'healthy daemon detected');
  ck(r.actions.length === 0, 'healthy state -> zero required actions');
  ck(r.report.some((l) => l.includes('nothing needed')), 'complete-ending line present');
  ck(!r.report.some((l) => l.includes('BEAT-COMPLETE BAR')), 'healthy zero-action state does NOT print the beat-complete bar');
  ck(r.doneness && r.doneness.barMet === true, 'healthy fixture reaches barMet (frontier clean + deployed-current)');
  // BEAT-COMPLETE BAR fires whenever required actions exist (operator correction 2026-07-03:
  // the conductor kept saying "nothing needed" over a non-empty action list)
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/bar1.mission.txt  <!-- t -->\nFAILED missions/bar1.mission.txt  <!-- t -->\n');
  const rBar = sweep(tmp, now, noRoute, sightOk);
  ck(rBar.actions.length > 0 && rBar.report.some((l) => l.includes('BEAT-COMPLETE BAR') && l.includes("daemon's work, not yours")), 'non-empty actions -> BEAT-COMPLETE BAR counter-license printed (complete ending must be EARNED)');
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nDONE missions/good.mission.txt  <!-- t -->\n');   // restore healthy fixture for downstream checks

  // QUEUE.md VISIBILITY (hunt-item #21, 2026-07-04): the sweep used to never read QUEUE.md at
  // all -- now it counts UNPARKS conditions and reports them (never as a blocking action).
  {
    ck(!r.report.some((l) => l.startsWith('QUEUE.md:')), 'QUEUE.md-visibility: no QUEUE.md file present (the ordinary fixture case) -> no report line, never an error');
    writeFileSync(path.join(tmp, 'missions', 'QUEUE.md'), '- some parked item. UNPARKS when the drive returns.\n- another one. UNPARKS on key rotation.\n');
    const rQueue = sweep(tmp, now, noRoute, sightOk);
    ck(rQueue.report.some((l) => l === 'QUEUE.md: 2 UNPARKS condition(s) on record — review missions/QUEUE.md for whether any have actually fired (not auto-checked here; conductor judgment)'), 'QUEUE.md-visibility: 2 UNPARKS conditions in QUEUE.md are counted and surfaced in the report');
    ck(!rQueue.actions.some((a) => /UNPARKS|QUEUE\.md/i.test(JSON.stringify(a))), 'QUEUE.md-visibility: report-only, never a blocking action -- a present-but-unfired UNPARKS condition must not manufacture required-action noise every beat');
    rmSync(path.join(tmp, 'missions', 'QUEUE.md'), { force: true });
  }

  // AUDIT REGRESSION TESTS 2026-07-02 (each encodes a live-confirmed audit finding):
  // (a) closed(): "UNRESOLVED" must NOT read as resolved (the missing-\b inversion).
  {
    const arun = { done: [], failed: ['missions/x.mission.txt'], pending: [], running: [], notes: { 'missions/x.mission.txt': 'still UNRESOLVED — investigating' } };
    const dn = computeDoneness(tmp, arun, { gitFn: stubGit });
    ck(dn.counts.unresolvedFailed === 1, 'closed(): a note saying UNRESOLVED does NOT close the FAILED (leading-\\b fix)');
    const arun2 = { done: [], failed: ['missions/x.mission.txt'], pending: [], running: [], notes: { 'missions/x.mission.txt': 'RESOLVED 2026-07-02: landed' } };
    ck(computeDoneness(tmp, arun2, { gitFn: stubGit }).counts.unresolvedFailed === 0, 'closed(): an explicit RESOLVED note still closes');
  }
  // (b) presence != landed: a DONE mission whose ALLOW-FILES all pre-exist but whose named source
  // patch is NOT in the deployable tree must BLOCK (the poi-tags stranded-on-feature-branch class).
  {
    writeFileSync(path.join(tmp, 'missions', 'mt-integrate-strand.mission.txt'),
      `MISSION-CLASS: code-repo\nREPO-ROOT: ${tmp.replace(/\\/g, '/')}\nALLOW-FILES:\n  - missions/AUTORUN.md\n\ncherry-pick abc1234 from the feature branch.\n`);
    const strandGit = (repo, argstr) => {
      if (/show .*abc1234/.test(argstr) || (/patch-id/.test(argstr) && /show/.test(argstr))) return { ok: true, out: 'feedfeedfeedfeed abc1234\n' }; // pid NOT in head table
      if (/log -p/.test(argstr)) return { ok: true, out: 'otherpid othersha\n' };
      return stubGit(repo, argstr);
    };
    const arun3 = { done: ['missions/mt-integrate-strand.mission.txt'], failed: [], pending: [], running: [], notes: {} };
    const dn3 = computeDoneness(tmp, arun3, { gitFn: strandGit });
    ck(dn3.blocking.some((b) => b.mission === 'mt-integrate-strand' && /NOT in the deployable tree/.test(b.reason)), 'presence-AND-landed: all ALLOW-FILES present but patch not in tree -> L3 BLOCK (recall restored)');
  }

  // (c) divergence guard fails CLOSED on git error (hunt-item #19, 2026-07-04): a git error on
  // the main/master rev-list used to leave div.ok:false with NO blocking entry at all -- silent
  // fail-OPEN, the same class the pushedGap check 3 lines above it already guards against.
  {
    const divErrGit = (repo, argstr) => {
      if (/^rev-list --count github\/main\.\.\.github\/master/.test(argstr)) return { ok: false, out: '' };
      return stubGit(repo, argstr);
    };
    const arun4 = { done: [], failed: [], pending: [], running: [], notes: {} };
    const dn4 = computeDoneness(tmp, arun4, { gitFn: divErrGit });
    ck(dn4.counts.divergenceCount === null, 'divergence guard: git error -> divergenceCount null (never a false zero)');
    ck(dn4.blocking.some((b) => /cannot determine github\/main vs github\/master divergence — fail-closed/.test(b.reason)), 'divergence guard: git error -> explicit fail-closed BLOCK, not silent fail-open');
    const dnOk = computeDoneness(tmp, arun4, { gitFn: stubGit });
    ck(dnOk.counts.divergenceCount === 0 && !dnOk.blocking.some((b) => /divergence/.test(b.reason)), 'divergence guard: clean git (0 commits diverged) -> no blocking, zero behavior change for the healthy path');
  }

  rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--selftest')) selftest();
  else main();
}
