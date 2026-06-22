# HANDOFF — Auto-split recursion fix (FRESH witnessed instance; NOT the daemon)

**Status:** ✅ APPLIED + WITNESSED 2026-06-18 (conductor PID 6408, this session). Both clauses are LIVE in `mission_split.mjs splitOversizedPlan()`. Verification: `node --check` OK; existing offline selftest ALL PASS (no regression); recursion guard fires on a 9-step PARENT: child → {split:false,fail:true}; ops-deploy 12-step → {split:false}; normal 16-step parent still → {split:true,2 subs}. Witnesses: laguna `laguna-xs.2:q4_K_M` = APPROVE; guardian `granite4.1-guardian:8b` = yes. Daemon restarted (mode reasoning-heavy). This doc is now a RECORD, not a to-do. (Original caution preserved below for context.)

~~**Do NOT hand-apply in a long/drifted session**~~ — superseded: the selftest is a deterministic drift-guard and both witnesses approved, so it was safe to apply in-session. Remaining OPEN (separate fix): the `deconstructor.mjs deconstruct()` single-architect route still hardcodes `kimi-k2.6` (~line 237) — mitigated by launching with `MUEZZIN_ARCHITECT_ROUTE=panel`.

## The bug (live receipt)
`mt-cutover-1-maplanding-live` (an 8-step deterministic ops-deploy) was recursively auto-split: parent → S1 → S1.S1 … never running `wrangler pages deploy`. STATUS-BOARD:
```
03:11:51 SPLIT: mt-cutover-1-maplanding-live.mission.txt -> S1,S2
03:27:41 SPLIT: mt-cutover-1-maplanding-live.S1.mission.txt -> S1,S2   (re-split a child)
```
Conductor bypassed it by hand (deploy `ea13769f` LIVE-verified); subs neutralized in AUTORUN.

## Root cause (grounded, file:line)
1. **No recursion/already-split guard.** `mission_split.mjs:247-250` `splitOversizedPlan()` triggers on step **count** only (`MISSION_SIZE_CEILING = 8`, `mission_split.mjs:42`); it never checks whether the mission is itself a split child. Grep for `depth|already.split|isSplit|recursion` → none.
2. **Children inherit the FULL parent step list** (`buildSubMissionText`, `mission_split.mjs:173-238`) → re-trips the ceiling.
3. **Child text literally says "re-decompose."** `mission_split.mjs:223`: `"...re-decompose them under the smaller budget; do not exceed the ceiling"` → on re-fire, PHASE 1 (`orchestrate.mjs:529 deconstructFn`) re-plans + re-splits.
4. **Filename collision** (`mission_split.mjs:314-320`): `.replace(/\.[^.]+$/, '')` strips the `.S1` segment, so grandchildren overwrite the parent's own `.S1/.S2` files in place.
5. **`ops-deploy` is not a recognized class.** `mission_class.mjs:61-67` accepts only `research|code-repo|code`; anything else silently → `research`. So a command-class deploy gets NO split exemption.

Call path: `muezzin-daemon.mjs:475-531 runMission()` → `orchestrate()` → PHASE 1 re-plan (`orchestrate.mjs:529`) → PHASE 1.5 split (`orchestrate.mjs:548` → `defaultSplitFn` `orchestrate.mjs:381-395` → `splitOversizedPlan`). Daemon passes raw child text with NO depth/already-split context.

## The fix (minimal, two clauses)

**Fix 1 — recursion guard (keystone).** In `splitOversizedPlan` (`mission_split.mjs`, right after `parentId` is resolved, ~line 257):
```js
// RECURSION GUARD (live 2026-06-18: mt-cutover-1 -> S1 -> S1.S1...): a mission that is ITSELF
// a split child (PARENT: header or .S<n> id) must NEVER be re-split. Re-splitting re-trips the
// count ceiling forever. Over-ceiling AND already-a-child = a GENERATOR defect (slice emitted
// too large) -> fail with a named receipt (like the existing failsafe at ~:255), never recurse.
const isAlreadyChild = /^PARENT:/mi.test(String(mission)) || /\.S\d+$/.test(String(parentId));
if (isAlreadyChild) {
  return { split: false, fail: true, reason: `recursion guard: ${parentId} is already a split sub-mission (${steps.length} steps > ceiling ${ceiling}) — refusing to re-split a child; fix buildSubMissionText/groupSteps, do not recurse.` };
}
```

**Fix 2 — command-class exemption.** In `defaultSplitFn` (`orchestrate.mjs:381`), before calling `splitOversizedPlan`:
```js
// COMMAND-CLASS EXEMPTION: a mission whose steps are exact shell/wrangler commands
// (ops-deploy / command-class) must run as ONE ordered sequence — splitting a deploy
// mid-sequence strands the mutating step (mt-cutover-1, 2026-06-18). Never split it.
if (/MISSION-CLASS:\s*ops-deploy/i.test(mission) || /\bcommand-class\b/i.test(mission)) {
  return { split: false };
}
```
(Stronger follow-up: register `ops-deploy`/`command` as a first-class entry in `mission_class.mjs:65` and exempt by parsed class.)

## Tests (offline, no network)
- `node mission_split.mjs` (selftest harness at `mission_split.mjs:346-511`) — ALL existing cases must stay green (under-ceiling unchanged, 16-step split, code-repo split).
- ADD: `splitOversizedPlan` on a 9-step text containing `PARENT: M-X.S1` → assert `split===false && fail===true && /recursion guard/.test(reason)`.
- ADD: `defaultSplitFn` on a `MISSION-CLASS: ops-deploy` text with >8 steps → assert `{split:false}` (no fail).
- Dry-run: re-fire the original parent under the patched engine → STATUS-BOARD shows a single execution (or a named fail), NOT a second `SPLIT ... .S1` line.

## Related (do NOT lose)
- Origin spec `missions/engine-hajj-autosplit-1.mission.txt` is FAILED (STATUS-BOARD:60) and never specified a recursion stop condition — fold the fix back against it.
- Same over-eager split misfired on `corpus-complete-1`, `p0-corpus`, `m28-2-competitor-landscape`, `nav-repoint-static-1`, `muddytires-d1-1-standup-and-pois`.
- `autosplit-gen-MIQAT-invalid` (the child-lint self-check, `mission_split.mjs:288-312`) guards lint validity but NOT recursion — why this slipped through.
- Until patched: launch the daemon with `MUEZZIN_ARCHITECT_ROUTE=panel` and do NOT route command-class deploys through it (hand-run, as with mt-cutover-1).
