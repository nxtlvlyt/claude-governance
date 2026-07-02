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

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, appendFileSync, readdirSync } from 'fs';
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
const STATUS_RE = /^(DONE|FAILED|RUNNING)\b/;
function parseAutorun(text) {
  const out = { done: [], failed: [], running: [], pending: [], notes: {} };
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
  for (const p of [...autorun.done, ...autorun.failed, ...autorun.running, ...autorun.pending]) {
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
function readFixLedger(base) { const o = readJson(fixLedgerPath(base)); return (o && Array.isArray(o.entries)) ? o : { entries: [] }; }
function writeFixLedger(base, obj) { writeFileSync(fixLedgerPath(base), JSON.stringify(obj, null, 2)); }

// conductor records a landed fix (called from code or `--record`). cls=failure class,
// fix=what closed it, requeue=mission stems it unblocks.
export function recordFix(base, { cls, fix, requeue = [] }, now = Date.now()) {
  const ledger = readFixLedger(base);
  ledger.entries.push({ class: cls, fix, landed_ts: new Date(now).toISOString(), requeue, requeued: false });
  writeFixLedger(base, ledger);
  return ledger;
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

// heartbeat tail parsing: timestamped attempt lines from seat_dispatch.
function parseHeartbeats(text, now) {
  const lines = text.split(/\r?\n/).filter(Boolean).slice(-300);
  const within = [];
  for (const l of lines) {
    const ts = Date.parse(l.slice(0, 24));
    if (Number.isFinite(ts) && now - ts <= T.HB_WINDOW_MS) within.push({ ts, l });
  }
  const last = lines.length ? lines[lines.length - 1] : '';
  return {
    lastLine: last,
    lastAgeMs: last ? age(last.slice(0, 24), now) : Infinity,
    claudeTier: within.filter((x) => /provider=claude-/.test(x.l)),
    rateLimited: within.filter((x) => /HTTP_429/.test(x.l)),
    thinkingBurn: within.filter((x) => /EMPTY_CONTENT_THINKING/.test(x.l) && /attempt-fail/.test(x.l)),
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
  const closed = (note) => /FIX:\s*none\b|SUPERSEDED\b|RESOLVED\b|DUPLICATE-RETIRED\b/i.test(String(note || ''));
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
  const div = gitFn(targetRepo, 'rev-list --count github/main...github/master');
  if (div.ok && /^\d+$/.test(div.out.trim()) && parseInt(div.out.trim(), 10) > 0) blocking.push({ layer: 'L3', mission: '(repo)', reason: `github/main and github/master DIVERGED by ${div.out.trim()} commit(s) — reconcile to one canonical mainline` });

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
    doneChecked++;
    const res = readJson(path.join(base, 'missions', stem + '.mission.result.json'));
    if (!res) { blocking.push({ layer: 'L0', mission: stem, reason: 'DONE but no result.json' }); continue; }
    if (res.phase === 'split' || res.split === true) { blocking.push({ layer: 'L1', mission: stem, reason: 'DONE marks a SPLIT parent — its leaves are the deliverable' }); continue; }
    if (!(res.ok === true && res.phase === 'done')) { blocking.push({ layer: 'L0', mission: stem, reason: `result not ok/done (ok=${res.ok} phase=${res.phase})` }); continue; }
    // L3 landed: the deliverable's source patch is present in HEAD (patch-id).
    const shas = extractSourceShas(mtext);
    if (!shas.length) continue; // authored-not-picked deliverable: L0 verdict is the floor
    let anyDeterminable = false, landed = false;
    for (const s of shas) { const pid = pidOf(s); if (pid) { anyDeterminable = true; if (headPids.has(pid)) { landed = true; break; } } }
    if (anyDeterminable && !landed) blocking.push({ layer: 'L3', mission: stem, reason: `DONE but deliverable patch [${shas.map((x) => x.slice(0, 7)).join(',')}] is NOT in the deployable tree (on a feature branch / never integrated) — the poi-tags false-DONE class` });
  }

  const counts = { pending: pending.length, running: running.length, unresolvedFailed: unresolvedFailed.length, dammOwed: owed.length, openIntegration, pushedGap, doneDeliverablesChecked: doneChecked, blocking: blocking.length };
  const frontierClean = pending.length === 0 && running.length === 0 && unresolvedFailed.length === 0 && owed.length === 0 && openIntegration === 0;
  const barMet = frontierClean && blocking.length === 0;
  return { ts: new Date(now).toISOString(), barMet, counts, blocking: blocking.slice(0, 60), frontierClean };
}

export function sweep(base = HERE, now = Date.now(), routeFile = path.join(process.env.USERPROFILE || 'C:/Users/marka', '.claude', 'state', 'muezzin-route.json'), { sightFn = checkSearxngSight, cgAgeFn = () => checkCgFreshness(now), worktreeReposFn = () => WORKTREE_REPOS, gitFn = null } = {}) {
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
  report.push(daemonAlive
    ? `daemon: UP (PID ${pidfile}, status ${mins(statusAge)}m fresh) — lanes ${status.lanes.length}, queued ${status.queued}`
    : `daemon: DEAD or HUNG (pidfile=${pidfile || 'none'}, pid-alive=${Number.isInteger(pidfile) ? pidAlive(pidfile) : false}, status age ${mins(statusAge)}m)`);
  if (!daemonAlive) {
    actions.push({
      id: 'RESTART-DAEMON', class: 'mechanical', approved_by_faith: true,
      why: `status heartbeat ${mins(statusAge)}m old (limit 5m) or PID dead — singleton makes restart safe; RUNNING lanes revert and refire`,
      command: RESTART_CMD,
      verify: `daemon-status.json ts becomes fresh + 'daemon UP' line in ${path.join(logs, 'daemon-events.log')}`,
    });
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
  const stuckLanes = detectStuckLanes(status, now);
  if (stuckLanes.length) {
    for (const sl of stuckLanes) report.push(`STUCK-TASK: ${sl.path} stuck for ${mins(sl.ageMs)}m (limit ${mins(T.TASK_STUCK_MS)}m)`);
    actions.push({
      id: 'STUCK-TASK', class: 'mechanical', approved_by_faith: true,
      why: `${stuckLanes.length} lane(s) have been RUNNING for over ${mins(T.TASK_STUCK_MS)}m — a task that cannot finish in 5 min is hung and must be killed`,
      command: `taskkill /PID ${status?.pid ?? pidfile} /F /T`,
      stuck_paths: stuckLanes.map((x) => x.path),
      rule: 'heal() will kill the process tree and bare the RUNNING lines so the daemon re-fires them; logged to daemon-events.log',
    });
  }

  // WORKTREE-HEAL: a shared code-repo worktree left unmerged/mid-pick blocks EVERY code-repo
  // mission's clean-worktree preflight. Surgical recovery only — abort any in-progress pick/
  // merge, then restore each TRACKED unmerged file from HEAD (discards uncommitted conflict
  // residue = failed-mission orphan, per the engine's commit-on-success model). NEVER reset
  // --hard, NEVER delete untracked (those are report-only). heal() runs it via exec().
  for (const repoRoot of (worktreeReposFn() || [])) {
    const wt = detectWorktreeCorruption(repoRoot, gitFn ? (args) => gitFn(repoRoot, args) : null);
    if (!wt.corrupted) continue;
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
    const closed = /FIX:\s*none\b|SUPERSEDED\b|RESOLVED\b|DUPLICATE-RETIRED\b/i.test(note);
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
    for (const s of (e.requeue || [])) {
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
  const queuedAnywhere = new Set([...autorun.done, ...autorun.failed, ...autorun.running, ...autorun.pending].map(stemOf));
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
    report.push(`FLAG: ${hb.claudeTier.length} claude-tier dispatch(es) in last ${mins(T.HB_WINDOW_MS)}m with NO 429 seen — claude should only carry seats during cloud limits`);
    actions.push({ id: 'CHECK-CLAUDE-TIER', class: 'judgment', approved_by_faith: false, read_first: [path.join(logs, 'dispatch-heartbeat.log')], rule: 'persistent claude lines after quota reset = cloud auth/endpoint problem, not quota — check OLLAMA_API_KEY and ollama.com status before suspecting the tier' });
  }
  if (hb.thinkingBurn.length >= T.THINKING_BURN_COUNT) {
    report.push(`FLAG: ${hb.thinkingBurn.length} EMPTY_CONTENT_THINKING failures in window — known quota-burn class (QUEUE: KIMI THINKING-BURN FIX)`);
  }

  report.push(`ledger: ${autorun.done.length} DONE / ${autorun.failed.length} FAILED / ${autorun.running.length} running / ${autorun.pending.length} pending`);
  // DONENESS GATE (2026-07-02): compute the TRUE completion state so the conductor consults it
  // instead of eyeballing the board (the map the 2026-07-02 conductor lacked). doneness.json is
  // written by main(); this surfaces it on the board + as a standing NOT-DONE action.
  let doneness = null;
  try {
    doneness = computeDoneness(base, autorun, { owed });
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
      if ((e.requeue || []).some((s) => reqStems.has(s))) { e.requeued = true; e.requeued_ts = new Date(now).toISOString(); }
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

  return { performed, report: r.report, actions: r.actions };
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

  // fixture 1: dead daemon (stale status, dead pid) + one FAILED mission + claude-tier-without-429
  writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: 999999999, state: 'running', lanes: ['missions/x.mission.txt'], queued: 0, ts: new Date(now - 10 * 60000).toISOString() }));
  writeFileSync(path.join(logs, 'daemon.pid'), '999999999');
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nFAILED missions/broken.mission.txt  <!-- t -->\nmissions/next.mission.txt\n');
  writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), `${new Date(now - 2 * 60000).toISOString()} attempt-start provider=claude-opus (claude tier for kimi-k2.6)\n`);
  const noRoute = path.join(tmp, 'no-route.json');  // fixture isolation: never read the real route file
  const sightOk = { sightFn: () => ({ ok: true, results: 10 }), cgAgeFn: () => ({ ok: true, minutes: 5 }), worktreeReposFn: () => [] };  // fixture isolation: never curl the real backend, never git the real worktree
  let r = sweep(tmp, now, noRoute, sightOk);
  ck(r.daemonAlive === false, 'dead daemon detected (stale status + dead pid)');
  ck(r.actions.some((a) => a.id === 'RESTART-DAEMON' && a.command.includes('muezzin-daemon.mjs')), 'restart action with exact command emitted');
  ck(r.actions.some((a) => a.id === 'DIAGNOSE-broken' && a.class === 'judgment'), 'FAILED mission gets diagnose action, not a refire');
  ck(r.report.some((l) => l.includes('claude-tier') && l.includes('NO 429')), 'claude-without-429 flag raised');
  ck(r.autorun.pending.length === 1, 'pending parse correct');

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
  ck(!r.actions.some((a) => a.id && a.id.includes('parked')), 'engine-parked block is report-only (no action)');
  ck(r.actions.some((a) => a.id === 'DIAGNOSE-bare'), 'bare FAILED still gets diagnose');
  ck(!r.actions.some((a) => a.id && a.id.includes('done-elsewhere')), 'CLOSED (FIX: none/SUPERSEDED) is report-only — no PERFORM loop, no re-diagnose');

  // fixture 1c: REQUEUE-ON-FIX-LANDED — a fix-ledger entry naming a FAILED mission makes
  // a mechanical requeue; heal() bares the line (daemon re-fires) + flips it ONCE.
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'),
    '# q\nFAILED missions/healed.mission.txt  <!-- pending engine batch -->\nFAILED missions/other.mission.txt  <!-- t -->\n');
  writeFileSync(path.join(tmp, 'missions', 'healed.mission.txt'), 'MISSION-CLASS: test\n');
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
    const blind = sweep(tmp, now, noRoute, { sightFn: () => ({ ok: false, reason: 'zero results on control query' }) });
    ck(blind.actions.some((a) => a.id === 'RESTART-SEARXNG' && a.class === 'mechanical'), 'blind searxng -> RESTART-SEARXNG mechanical action (the wedge can never again pass unwitnessed)');
    ck(blind.report.some((l) => /SEARXNG BLIND/.test(l)), 'blind searxng surfaces on the report');
  }

  // fixture 1g: CG-INCREMENT GATE — stale v3 repo demands an increment; fresh stays silent.
  {
    const stale = sweep(tmp, now, noRoute, { sightFn: () => ({ ok: true, results: 9 }), cgAgeFn: () => ({ ok: true, minutes: 120 }) });
    ck(stale.actions.some((a) => a.id === 'CG-INCREMENT-DUE'), 'stale CG repo -> CG-INCREMENT-DUE on the beat (idle=CG is now a condition, not willpower)');
    const fresh = sweep(tmp, now, noRoute, { sightFn: () => ({ ok: true, results: 9 }), cgAgeFn: () => ({ ok: true, minutes: 10 }) });
    ck(!fresh.actions.some((a) => a.id === 'CG-INCREMENT-DUE'), 'fresh CG repo -> no nag (the gate has a dead-band, not a drumbeat)');
  }

  // fixture 1h: STUCK-TASK detection + heal() kills and requeues.
  writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: 77777, state: 'running', lanes: [{ path: 'missions/stuck.mission.txt', start_ts: new Date(now - 16 * 60000).toISOString() }], queued: 0, ts: new Date(now).toISOString() }));
  writeFileSync(path.join(logs, 'daemon.pid'), '77777');
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nRUNNING missions/stuck.mission.txt  <!-- t -->\n');
  writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), `${new Date(now - 1 * 60000).toISOString()} attempt-ok provider=ollama-cloud model=kimi-k2.6 heal=0 ms=1 chars=10\n`);
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

  // fixture 2: healthy daemon (our own pid alive, fresh status), clean ledger
  writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: process.pid, state: 'running', lanes: [], queued: 0, ts: new Date(now).toISOString() }));
  writeFileSync(path.join(logs, 'daemon.pid'), String(process.pid));
  writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nDONE missions/good.mission.txt  <!-- t -->\n');
  writeFileSync(path.join(logs, 'dispatch-heartbeat.log'), `${new Date(now - 60000).toISOString()} attempt-ok provider=ollama-cloud model=kimi-k2.6 heal=0 ms=1 chars=10\n`);
  r = sweep(tmp, now, noRoute, sightOk);
  ck(r.daemonAlive === true, 'healthy daemon detected');
  ck(r.actions.length === 0, 'healthy state -> zero required actions');
  ck(r.report.some((l) => l.includes('nothing needed')), 'complete-ending line present');

  rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--selftest')) selftest();
  else main();
}
