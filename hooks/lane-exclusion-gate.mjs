#!/usr/bin/env node
// ~/.claude/hooks/lane-exclusion-gate.mjs
// PreToolUse hook -- mechanical enforcement of LANE-EXCLUSION (GAP-HUNT-2026-07-03 item #7;
// GAP-CLOSURE-PLAYBOOK.md UNIT E1, which assigns this "conductor-direct": "E1. LANE-EXCLUSION
// mechanical guard (hooks): block conductor writes into a RUNNING lane's REPO-ROOT unless the
// heartbeat shows plan-phase (the receipted exception)").
//
// Real incident this closes: a conductor pre-flight side-wrote files (e2e-report-*.json,
// e2e-shots) into plan-mode-mobile's live repo while a lane was RUNNING against that same
// REPO-ROOT, tripping containment-drift and burning the mission's OWN attempt 1 (STATE.md
// :115-123, 2026-07-03). The fix shipped as PROSE ONLY. Verified absent machinery (hunt,
// refute-checked): no hook enforced it; conduct-cycle.mjs's live-lane logic only suppresses
// the SWEEP's own worktree-heal; orchestrate.mjs's containment-drift check has no notion of
// WHO dirtied a file -- an external side-write during a live lane is structurally
// indistinguishable from the mission's own overreach, so the damage attributes to the MISSION.
//
// SCOPE: registered at the USER level, so it gates only interactive conductor sessions.
// Dispatched mission executors (seat_dispatch.mjs attemptClaude(), `claude.exe -p ...
// --setting-sources project`) exclude user-level settings -- confirmed by reading
// seat_dispatch.mjs's governance-isolation comment (root-cause 2026-06-11 19:30) -- so a
// mission's own legitimate step edits never see this gate. Correct: the gap is conductor
// side-writes, not mission work.
//
// Dependency-free from app code (the convention autorun-verdict-gate.mjs states): reads
// daemon-status.json + a lane's mission-events.jsonl directly, imports nothing from the
// muezzin-plugin modules.

import { readFileSync, existsSync } from 'fs';
import path from 'path';

const MUEZZIN_BASE = 'C:\\Users\\marka\\.claude\\muezzin-plugin';

function readJsonSafe(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
function readTextSafe(p) { try { return readFileSync(p, 'utf8'); } catch { return ''; } }
function stemOf(missionLine) { return path.basename(String(missionLine)).replace(/\.mission\.txt$/i, ''); }

// Ground truth for "RUNNING now": daemon-status.json's lanes array, written by the daemon
// on every status tick -- fresher than AUTORUN.md's RUNNING lines between sweeps. A stale
// status file (daemon dead > STATUS_DEAD_MS) means no lanes are actually running; the
// daemon's own sweep flags dead-status separately, so staleness here fails OPEN by design:
// this gate protects live lanes, and a dead daemon has none.
export function liveLanes(base) {
  const status = readJsonSafe(path.join(base, 'missions', '_logs', 'daemon-status.json'));
  const lanes = Array.isArray(status?.lanes) ? status.lanes : [];
  return lanes.map((l) => (typeof l === 'string' ? l : l?.path)).filter(Boolean);
}

export function repoRootOf(base, missionLine) {
  const mtext = readTextSafe(path.join(base, String(missionLine).replace(/\//g, path.sep)));
  const m = mtext.match(/^REPO-ROOT:\s*(\S.*?)\s*$/im);
  return m ? m[1].replace(/\\/g, '/').replace(/\/+$/, '') : null;
}

// Per-lane phase from its OWN mission-events.jsonl (last event's .phase) -- mirrors
// muezzin-daemon.mjs's lanePhase() derivation, copied not imported per the dependency-free
// convention above.
export function lanePhaseOf(base, missionLine) {
  const evPath = path.join(base, 'missions', stemOf(missionLine), 'mission-events.jsonl');
  if (!existsSync(evPath)) return null;
  try {
    const lines = readFileSync(evPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return null;
    return JSON.parse(lines[lines.length - 1])?.phase || null;
  } catch { return null; }
}

// Core decision -- pure, injectable for the selftest. targetText is a file_path (Edit/Write/
// NotebookEdit) or a raw command string (Bash/PowerShell, best-effort substring match; see
// the entrypoint note on why that cannot be a full shell parse). The REPO-ROOT match is
// boundary-aware: "some-repo" must not swallow writes aimed at "some-repo2".
export function checkLaneExclusion(targetText, base, { lanesFn = liveLanes, rootFn = repoRootOf, phaseFn = lanePhaseOf } = {}) {
  if (!targetText) return { blocked: false };
  const norm = String(targetText).replace(/\\/g, '/').toLowerCase();
  for (const mission of lanesFn(base)) {
    const repoRoot = rootFn(base, mission);
    if (!repoRoot) continue;
    const rrNorm = repoRoot.toLowerCase();
    const idx = norm.indexOf(rrNorm);
    if (idx === -1) continue;
    const after = norm[idx + rrNorm.length];
    if (after !== undefined && after !== '/' && after !== '"' && after !== "'" && after !== ' ' && after !== '\n') continue; // some-repo2 is not some-repo
    const phase = phaseFn(base, mission);
    if (phase === 'plan') continue; // the receipted exception -- plan-phase writes nothing of its own yet
    return {
      blocked: true, mission: stemOf(mission), repoRoot, phase,
      reason: `LANE-EXCLUSION (~/.claude/hooks/lane-exclusion-gate.mjs; GAP-CLOSURE-PLAYBOOK UNIT E1): ${repoRoot} is mission ${stemOf(mission)}'s REPO-ROOT and that lane is RUNNING right now, past plan-phase (phase=${phase || 'undeterminable -- fail-closed'}). A write here risks the containment-drift class that burned mt-mobile-qc-hardening.S1.S1's attempt 1 (2026-07-03, STATE.md:115-123): the mission's clean-worktree check cannot tell this write apart from its own work, and the failure would attribute to the MISSION, not to this action. Wait for the lane to finish (missions/_logs/daemon-status.json), then act.`,
    };
  }
  return { blocked: false };
}

// --------------------------------------------------------------------------- self-test
if (process.argv[2] === '--selftest') {
  let fails = 0;
  const check = (got, want, msg) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
    if (!ok) fails++;
  };

  const fx = {
    lanesFn: () => ['missions/live-lane.mission.txt'],
    rootFn: (base, m) => (m === 'missions/live-lane.mission.txt' ? 'C:/Users/marka/code/some-repo' : null),
    phaseFn: () => 'step',
  };

  check(checkLaneExclusion(null, 'b', fx).blocked, false, 'no target text -> never blocked');
  check(checkLaneExclusion('C:\\Users\\marka\\code\\other-repo\\f.js', 'b', fx).blocked, false, 'target outside any live REPO-ROOT -> allowed');
  check(checkLaneExclusion('C:\\Users\\marka\\code\\some-repo\\js\\f.js', 'b', fx).blocked, true, 'target inside a RUNNING lane REPO-ROOT, phase=step -> BLOCKED');
  check(checkLaneExclusion('C:\\Users\\marka\\code\\some-repo\\js\\f.js', 'b', { ...fx, phaseFn: () => 'plan' }).blocked, false, 'same target, phase=plan -> ALLOWED (the receipted exception)');
  check(checkLaneExclusion('C:\\Users\\marka\\code\\some-repo\\js\\f.js', 'b', { ...fx, phaseFn: () => null }).blocked, true, 'undeterminable phase for a known-RUNNING lane -> fail-CLOSED');
  check(checkLaneExclusion('git -C "C:/Users/marka/code/some-repo" add f.js && git commit', 'b', fx).blocked, true, 'Bash command string referencing the live REPO-ROOT -> BLOCKED');
  check(checkLaneExclusion('C:\\Users\\marka\\code\\some-repo2\\f.js', 'b', fx).blocked, false, 'boundary-aware: some-repo2 does NOT match live root some-repo');
  check(checkLaneExclusion('C:\\Users\\marka\\code\\some-repo\\f.js', 'b', { ...fx, lanesFn: () => [] }).blocked, false, 'no live lanes -> fail-open (nothing running to protect)');
  check(checkLaneExclusion('C:\\Users\\marka\\code\\some-repo\\f.js', 'b', { ...fx, rootFn: () => null }).blocked, false, 'lane mission text unreadable/no REPO-ROOT -> that lane cannot be matched (fail-open per-lane)');

  console.log(`\n${fails === 0 ? 'ALL PASS -- LANE-EXCLUSION gate sound' : fails + ' FAIL'}`);
  process.exit(fails === 0 ? 0 : 1);
}

// --------------------------------------------------------------------------- hook entrypoint
let inp;
try { inp = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (!inp) process.exit(0);

const toolName = inp.tool_name;
let targetText = null;
if (toolName === 'Edit' || toolName === 'Write' || toolName === 'NotebookEdit') {
  targetText = inp.tool_input?.file_path || inp.tool_input?.notebook_path || null;
} else if (toolName === 'Bash' || toolName === 'PowerShell') {
  // Best-effort: no shell parser here, so a command is checked as a boundary-aware substring
  // match against each live lane's REPO-ROOT. Catches the realistic shapes (cd / git -C /
  // redirects / Set-Content naming the repo path); an arbitrarily obfuscated command can
  // evade it -- a named limitation, not an assumed-complete guard. Edit/Write stay the
  // exact-path-checked primary coverage.
  targetText = inp.tool_input?.command || null;
}
if (!targetText) process.exit(0);
if (!existsSync(MUEZZIN_BASE)) process.exit(0); // not a muezzin host -> nothing to protect

const result = checkLaneExclusion(targetText, MUEZZIN_BASE);
if (!result.blocked) process.exit(0);

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: result.reason,
  },
}));
process.exit(2);
