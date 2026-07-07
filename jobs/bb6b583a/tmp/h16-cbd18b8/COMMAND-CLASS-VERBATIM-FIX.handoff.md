# HANDOFF — Command-class missions must run VERBATIM (skip LLM re-planning)

**Status:** ✅ APPLIED + WITNESSED 2026-06-18 (conductor PID 6408, this session). LIVE in `command_queue.mjs` (new) + `orchestrate.mjs` (import + writeRoot + plan-entry). Verification: `node --check` OK; **command_queue selftest 13/13** (incl the abs-path regression guard); **orchestrate full selftest ALL PASS** (normal path byte-unchanged); mission_split selftest ALL PASS. Witnesses: laguna `laguna-xs.2:q4_K_M` = APPROVE (detailed); guardian `granite4.1-guardian:8b` = NO CONCRETE OBJECTION (bare "no" retracted when pressed).

⚠️ **ACTIVATION CONTRACT (required for the fix to engage):** command-class missions must put their commands in a fenced ```sh / ```pwsh block (one command per line). `buildLiteralCommandQueue` is FAIL-OPEN — a mission with commands in inline-backtick prose (like the original mt-accounts-deploy-1) finds no fenced block and falls back to the panel. **TODO (mechanical):** update the ops-deploy mission template + existing deploy missions to use fenced ```sh blocks so they take the verbatim path. Until a mission uses the convention, the fix is dormant for it (safely — it just uses the old panel path).

**End-to-end proof — DONE** (orchestrate selftest teeth tests, 2026-06-18): (1) a command-class mission with a fenced block + an injected deconstructFn that THROWS still completes → the architect PANEL is provably bypassed; (2) the verbatim fenced command actually RAN from REPO-ROOT; (3) a command-class mission with NO fenced block falls back to the panel (deconstructFn IS called) → fail-open proven. Only remaining (optional) validation: a real command-class deploy fired through the live daemon end-to-end — but the orchestrate-level e2e above already proves the bypass + verbatim execution + fail-open.

(Original spec below preserved as the implementation record.)

## The bug (live receipt, mt-accounts-deploy-1, 2026-06-18)
A `MISSION-CLASS: ops-deploy` mission with EXACT wrangler commands was fired 3×; each attempt the architect panel re-planned it (~5min Opus) and **rewrote the operator's verbatim commands** — turning `--file "E:\AI_Storage\muddytires-frontend-wt\d1\schema-users.sql"` into relative `--file d1/schema-users.sql`, which failed to resolve ("Unable to read SQL text file"). Conductor had to stop the daemon and hand-run the 4 commands (worked first try). Root = the engine paraphrases verbatim commands through an LLM instead of running them literally.

## Root cause (code-grounded, file:line)
1. **No verbatim path exists.** `orchestrate.mjs:529` `const plan = await deconstructFn(mission, ...)` — EVERY mission goes through `deconstructPanel` (3 architects + integrator). Grep for `literalQueue|verbatimQueue|skipPlan|deterministicQueue` → zero matches.
2. **The panel WRITES the command.** A step's executed command IS the LLM-authored `step.validation_command` (`orchestrate.mjs:713` `execReceipt(step.validation_command, writeRoot)`). The planning prompt `QUEUE_INSTRUCTION` (`deconstructor.mjs:169`) EXPLICITLY says: "ALL paths cwd-RELATIVE — never absolute" → the abs→rel corruption is *instructed*.
3. **The split exemption is too late + too narrow.** `mission_split.mjs:255-257` exempts command-class from SPLITTING only, and runs at `orchestrate.mjs:548` — AFTER planning (529) already mangled the commands.
4. **Wrong CWD.** `writeRoot = codeRepo ? repoRoot : cwd` (`orchestrate.mjs:428`); `ops-deploy` is NOT recognized by `parseMissionClass` (`mission_class.mjs:56-117` only knows research/code-repo/code) → defaults to `research` → `writeRoot = sandbox cwd` → relative `d1/...` unresolvable. `execReceipt(cmd, cwd)` runs in that cwd (`seat_dispatch.mjs:120-129`).

## The fix (minimal, normal path byte-unchanged)
**New module `command_queue.mjs`** (pure, with inline selftest, mirrors mission_split.mjs style):
- `isCommandClassMission(text)` — same predicate as mission_split.mjs:255 (`/MISSION-CLASS:\s*ops-deploy/i` or `/\bcommand-class\b/i`).
- `buildLiteralCommandQueue(mission)` → `{ok, queue}` | `{ok:false, reason}`. Parses the mission's explicit command/STEPS block and emits ONE `action_type:'command'` step per command line with `validation_command = the line VERBATIM` (absolute paths PRESERVED, no rewrite). `mission_id` from `missionIdOf(mission)`. Fail-CLOSED if no parseable command block (→ falls through to the panel, never silently mis-plans).

**Wire into `orchestrate.mjs`** (after the `emit({phase:'plan',event:'start'})` ~line 528, replacing the bare `const plan = await deconstructFn(...)` at 529):
```js
let plan;
if (isCommandClassMission(mission)) {
  const lit = buildLiteralCommandQueue(mission);
  if (lit.ok) { emit({phase:'plan',event:'literal-command-queue',step_count:lit.queue.steps.length});
    plan = { ok:true, queue:lit.queue, _panel:false, _literal:true, attempts:1 }; }
}
if (!plan) plan = await deconstructFn(mission, { diagDir: cwd });
```
Add import at top: `import { isCommandClassMission, buildLiteralCommandQueue } from './command_queue.mjs';`
- Do NOT run literal queues through `validateMicroQueue` (deconstructor.mjs:173) — that polices LLM-authored witnesses; operator verbatim commands are the contract.

**CWD fix:** make `ops-deploy` repo-rooted. `buildLiteralCommandQueue` should fail-closed if an ops-deploy mission has no `REPO-ROOT:` (no safe CWD).

⚠️ **CRITICAL — do NOT just remap `ops-deploy` → `code-repo` (probed + rejected 2026-06-18, conductor PID 6408).** The `code-repo` class drags in the CONTAINMENT MACHINERY (orchestrate.mjs:443-474): `assertRepoRoot` + `assertCleanOutsideAllowlist` + `resetAllowFiles`. On a deploy mission that is wrong and DESTRUCTIVE — `assertCleanOutsideAllowlist` FAILS on a dirty repo, and `resetAllowFiles` would RESET tracked files to HEAD, discarding uncommitted work (it would have wiped this session's hand-edits to auth-accounts.js + wrangler.auth.toml). So `ops-deploy` needs its OWN handling: set `writeRoot = repoRoot` (CWD) for the verbatim command run, but SKIP the containment reset/commit/allowlist flow entirely (a deploy runs commands, it does not edit+commit tracked files). Implement this as a distinct branch keyed on `isCommandClassMission` — NOT by routing ops-deploy through the code-repo class. This is the one non-obvious integration point; everything else in this spec is mechanical.

## Tests (offline, extend existing harnesses)
- `node command_queue.mjs`: (1) isCommandClassMission true for the markers, false otherwise; (2) buildLiteralCommandQueue on a body containing `wrangler d1 execute db --file "E:\x\d1\schema.sql"` yields a step whose validation_command STILL contains the absolute `E:\x\d1\schema.sql` (the regression guard — verbatim, not rewritten); (3) unparseable → {ok:false}.
- `node orchestrate.mjs` (selftest ~line 1071): add a case — a `MISSION-CLASS: ops-deploy` mission + an injected `deconstructFn` that THROWS; assert the run completes and the panel was never called (the throw proves the literal path bypassed it). That's the teeth.

## Why this is the high-value fix
It removes BOTH the ~5min/attempt Opus re-planning cost (the budget sink) AND the command corruption (the correctness hazard) for command-class deploys — the exact double-failure that took mt-accounts-deploy-1 three attempts + a hand-run. After this, a command-class deploy mission runs its operator-verbatim commands once, from repo-root, no LLM in the loop.

## Files (absolute)
orchestrate.mjs (529 plan entry, 428 writeRoot, 713 exec, 695-728 command branch, 1071 selftest) · deconstructor.mjs (169 abs→rel instruction, 326-334 route default, 364 panel) · seat_dispatch.mjs (120-133 execReceipt) · mission_split.mjs (255 split exemption, missionIdOf) · mission_class.mjs (56-117 parseMissionClass) · NEW command_queue.mjs
