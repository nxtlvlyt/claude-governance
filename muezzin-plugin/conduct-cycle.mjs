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

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const T = {
  STATUS_DEAD_MS: 5 * 60 * 1000,
  LANE_STALL_MS: 20 * 60 * 1000,
  HB_WINDOW_MS: 30 * 60 * 1000,
  THINKING_BURN_COUNT: 3,
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
    const _searxngBase = (process.env.SEARXNG_URL || 'http://nxtbeast:8080').replace(/\/+$/, '');
    const body = probe ? probe() : _execSyncSight(
      `curl -s -m 8 "${_searxngBase}/search?q=github&format=json"`,
      { timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    if (!body || !body.trim()) return { ok: false, reason: 'empty response (wedged or down)' };
    const j = JSON.parse(body);
    const n = Array.isArray(j?.results) ? j.results.length : 0;
    return n > 0 ? { ok: true, results: n } : { ok: false, reason: 'zero results on a control query that cannot honestly be empty' };
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

export function sweep(base = HERE, now = Date.now(), routeFile = path.join(process.env.USERPROFILE || 'C:/Users/marka', '.claude', 'state', 'muezzin-route.json'), { sightFn = checkSearxngSight, cgAgeFn = () => checkCgFreshness(now) } = {}) {
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
    for (const lane of status.lanes) report.push(`lane: ${lane}`);
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
        read_first: [
          path.join(base, 'missions', stem + '.result.json'),
          path.join(logs, 'retro', stem + '.retro.md'),
          path.join(base, 'missions', stem, 'mission-events.jsonl'),
        ].filter(existsSync),
        rule: 'diagnose, then annotate with FIX: <conductor-performable fix> OR "pending engine batch" OR "SUPERSEDED/RESOLVED: <why>" — a bare FAILED mark is not a finished judgment',
      });
    }
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
  if (!actions.length) report.push('required actions: none — "nothing needed from you" is a complete ending');
  return { daemonAlive, report, actions, autorun };
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
export function heal(base = HERE, now = Date.now(), { exec = (cmd) => execSync(cmd, { stdio: 'ignore' }), sightFn } = {}) {
  const r = sweep(base, now, undefined, sightFn ? { sightFn } : undefined);
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

  const restart = r.actions.find((a) => a.id === 'RESTART-DAEMON');
  if (restart) {
    const status = readJson(path.join(base, 'missions', '_logs', 'daemon-status.json'));
    const lanesRunning = status && Array.isArray(status.lanes) && status.lanes.length > 0;
    if (lanesRunning) performed.push({ action: 'restart-skipped', why: 'lanes running — refusing to kill a live mission' });
    else { exec(restart.command); performed.push({ action: 'restart-daemon' }); }
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
  const sightOk = { sightFn: () => ({ ok: true, results: 10 }), cgAgeFn: () => ({ ok: true, minutes: 5 }) };  // fixture isolation: never curl the real backend
  let r = sweep(tmp, now, noRoute, sightOk);
  ck(r.daemonAlive === false, 'dead daemon detected (stale status + dead pid)');
  ck(r.actions.some((a) => a.id === 'RESTART-DAEMON' && a.command.includes('muezzin-daemon.mjs')), 'restart action with exact command emitted');
  ck(r.actions.some((a) => a.id === 'DIAGNOSE-broken' && a.class === 'judgment'), 'FAILED mission gets diagnose action, not a refire');
  ck(r.report.some((l) => l.includes('claude-tier') && l.includes('NO 429')), 'claude-without-429 flag raised');
  ck(r.autorun.pending.length === 1, 'pending parse correct');

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
  recordFix(tmp, { cls: 'fabricated-citation', fix: 'citation_guard gate', requeue: ['healed'] }, now);
  r = sweep(tmp, now, noRoute, sightOk);
  ck(r.actions.some((a) => a.id === 'REQUEUE-healed' && a.class === 'mechanical' && a.approved_by_faith), 'fix-landed: a FAILED mission in the ledger becomes a mechanical requeue');
  ck(!r.actions.some((a) => a.id === 'REQUEUE-other'), 'a FAILED mission NOT in the ledger is not requeued (no blind relaunch)');
  const healed = heal(tmp, now, { exec: () => { throw new Error('must not restart a healthy daemon'); } });
  ck(healed.performed.some((p) => p.action === 'requeue' && p.stem === 'healed'), 'heal(): requeue performed');
  const after = parseAutorun(readText(path.join(tmp, 'missions', 'AUTORUN.md')));
  ck(after.pending.includes('missions/healed.mission.txt'), 'heal(): the healed mission line is now bare (pending → daemon re-fires)');
  ck(after.failed.includes('missions/other.mission.txt'), 'heal(): the unrelated FAILED line is untouched');
  // once-only: a second sweep sees the entry requeued and emits NO requeue action.
  r = sweep(tmp, now, noRoute, sightOk);
  ck(!r.actions.some((a) => String(a.id).startsWith('REQUEUE-')), 'once-only: a requeued ledger entry never fires again (no auto-loop)');

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
