# Engine-Reliability Diagnosis — the false-green (and the containment-drift dirt gate)

Authored 2026-06-16 against open substrate (orchestrate.mjs, git_steps.mjs, deconstructor.mjs,
mission_lint.mjs, mission_class.mjs, seat_dispatch.mjs, verdict_merge.mjs) and the d1-1 receipts.
Confidence on the mechanism: 0.95 (grounded in the mission's own event log + result json).

---

## 1. The false green — precise mechanism (file:line + receipts)

### How a step reports `ok:true`
1. The architect authors each step's `validation_command` at plan time. The ONLY floor the
   plan validator applies to it is "is a non-empty string":
   `deconstructor.mjs:52-53` (`validateMicroAction`) —
   `if (!step.validation_command || typeof step.validation_command !== 'string') errs.push(... missing validation_command ...)`.
   There was **no check on what the command actually proves.**
2. For `command`/`verify` steps the engine runs that command itself via `execReceipt`:
   `orchestrate.mjs:577` -> `seat_dispatch.mjs:120-134`. `execReceipt` shells the command
   under pwsh and returns `{ ok: true }` **iff the process exits 0** (`seat_dispatch.mjs:130`);
   any non-zero exit -> `{ ok:false }` (`seat_dispatch.mjs:131-133`).
3. `orchestrate.mjs:578` decides the step purely on `receipt.ok`. On success it pushes
   `{ step, ok:true, engineExec:true }` (`orchestrate.mjs:586`).

So **a step's `ok` is exactly "the planner-authored command exited 0."** The engine has no
independent knowledge of the real-world outcome — it can only run the command it was given.

### The d1-1 receipt (the hollow green, verbatim)
Mission `muddytires-d1-1-standup-and-pois.S1` reported all 8 steps `ok:true engineExec:true`
(`muddytires-d1-1-standup-and-pois.S1.mission.result.json` lines 6-49) while the remote D1 had
0 tables. The final run's events
(`missions/muddytires-d1-1-standup-and-pois/mission-events.jsonl`) show:

- **Step 1** `wrangler d1 list --json` -> exit 0, out includes literally `"num_tables": 0`.
  The hollowness was provable *inside a green receipt* — but nothing read the body, only the exit code.
- **Step 8** `wrangler d1 execute muddytires-pois --remote --json --command "SELECT name FROM
  sqlite_master WHERE type='table' AND name='pois'"` -> exit 0, **out = `True\r\n`**.
  The remote query returned **zero rows** (no `pois` table), yet the command's final expression
  evaluated to a boolean `True` and the process exited 0. `execReceipt` saw exit 0 -> `ok:true`.

`wrangler` (and most tools) **exit 0 when the QUERY succeeds, regardless of row count.** A witness
that prints `True`/exits 0 on an empty result set is a hollow witness. The deed (table landed on
the edge) never happened; the receipt said it did.

The phase-3 verdict panel **correctly caught it**: `verdict event done consensus BLOCK
dispositions [validator:BLOCK, auditor:BLOCK]`, twice (events log; result json `reason: "verify
consensus BLOCK"`). That is the system working — but only after 8 green steps and a full
plan+execute+panel cycle.

---

## 2. Verdict — engine-bug vs mission-authoring: **BOTH, primarily mission-authoring**

- **Mission-authoring (primary).** The architect authored a `validation_command` whose exit code
  did not reflect the real outcome (step 8 printed `True` instead of asserting `COUNT(*) > 0`).
  The engine faithfully ran exactly what it was told. Whether `SELECT name ...` "proves the table
  exists" vs "returns a boolean that's always true" is **semantic** — it depends on the command's
  full shape and the tool's exit semantics, which the engine cannot evaluate deterministically.
  This is exactly why the phase-3 LLM verdict panel exists, and why it (not a deterministic gate)
  is the correct catch for the general case.
- **Engine (secondary, and partly fixable).** The plan validator placed **no floor at all** on
  `validation_command` strength (`deconstructor.mjs:52-53`). One narrow, unambiguous slice of the
  failure class IS mechanically catchable at plan time: a step whose *description claims a
  remote/external outcome* but whose *command is a pure local presence check* (`Test-Path`) can
  only ever witness "a local file exists" — never the remote deed. That slice is now floored
  (section 3). The residual — a command that DOES reach the resource but masks an empty result
  (the exact step-8 case) — is **not cleanly engine-fixable** (section 4).

---

## 3. What was implemented (conservative engine floor + selftests)

**File: `deconstructor.mjs`.** A new plan-time floor in `validateMicroAction`, **code-repo only**,
threaded through `validateMicroQueue` -> `runQueueLoop` -> both `deconstruct()` and the panel
integrator (so it gates whichever planner path runs), plus a one-line planner-framing note
(`codeRepoNoteFor`) so the architect is told the rule up front.

The rule: a step whose **description** matches `EXTERNAL_OUTCOME_RE` (remote / edge / live db /
sqlite_master / workers.dev / responds / returns json|geojson|rows / status 200 ...) while its
`validation_command` is a **trivially-local witness** (`isTriviallyLocalWitness` — starts with
`Test-Path`/`Get-Item`/`Get-ChildItem`/`Resolve-Path`/`[System.IO.File]::Exists`, or a
`Select-String ... -Quiet`, AND contains no external-reaching command) is **REJECTED** at plan
time with a named reason directing the architect to witness the real outcome.

Precision guards (each has a selftest):
- A tool name must appear as a **command invocation** (followed by whitespace+arg) to count as
  reaching the resource, so the filename `wrangler.d1.toml` used as a `Test-Path`/`Select-String`
  argument does NOT falsely count as "reaches remote" (`REACHES_EXTERNAL_RE`).
- Removed a bare `D1` token from the external-outcome detector because it collides with `.d1.`
  inside that same legitimate local filename.
- **code-repo only**: research/sandbox missions produce LOCAL deliverables where a `Test-Path`
  witness is correct by design — the floor never fires there.
- A code-repo step whose description is LOCAL ("witness wrangler.d1.toml carries a UUID") is NOT
  flagged even though it uses `Select-String`/`Test-Path` — only *remote-claiming* steps are gated.

**Selftest results (all green, run 2026-06-16):**
- `node --check deconstructor.mjs` -> OK
- `node deconstructor.mjs` -> ALL PASS (7 new FG-unit + 5 new FALSE-GREEN-FLOOR cases, incl. the
  exact d1-1 step-8 description rejected with a bare `Test-Path`, and the same step PASSING with a
  real `wrangler --remote` query).
- Regression — no existing mission broken: `orchestrate.mjs` ALL PASS, `mission_lint.mjs` ALL PASS,
  `mission_class.mjs` ALL PASS, `verdict_merge.mjs` ALL PASS, `git_steps.mjs` ALL PASS.

This raises the floor at cost zero (plan-time refusal) for the most common hollow-witness shape
without false-positiving on legitimate plans.

---

## 4. What is NOT cleanly engine-fixable — recommendation

The **residual and deepest** slice — the exact d1-1 step-8 failure — is a command that genuinely
reaches the resource (`wrangler ... --remote ... SELECT ...`) but whose **exit code / final
expression masks an empty result** (`True`, exit 0, zero rows). The new floor does NOT catch this
(by design: the command DOES reach remote, so it is not "trivially local"). Catching it
deterministically would require the engine to:
- parse arbitrary pwsh/SQL/CLI to know whether the command **asserts a non-empty / positive
  outcome** (e.g. `COUNT(*) > 0`, `$rows.Count -gt 0`, HTTP 200 AND non-empty body), and
- know each tool's exit semantics (wrangler exits 0 on a 0-row query).

That is semantic verification, not a regex, and any heuristic strong enough to catch it would
false-positive on legitimate plans. **It should NOT be forced into the engine.** It is correctly
the job of the phase-3 verdict panel (which DID catch d1-1, BLOCK x2) and of mission authoring.

**Recommended (non-engine) fixes, in priority order:**

1. **Planner rule already half-shipped — strengthen the framing, not the gate.** The
   `codeRepoNoteFor` note now tells the architect to assert the real outcome. Extend the QUEUE
   instruction (`deconstructor.mjs:158-166`, the `VALIDATION COMMANDS` line) with an explicit
   *positive-assertion* shape for remote witnesses, e.g.:
   `wrangler d1 execute --remote --command "SELECT COUNT(*) FROM pois" ... | <assert the count is > 0, fail non-zero otherwise>`
   and `curl ... ; if ($resp.StatusCode -ne 200) { exit 1 }`. Make "a witness must FAIL (non-zero
   exit) when the outcome is absent" a HARD RULE in the framing. (Authoring guidance, not a gate —
   keeps false-positive risk at zero.)

2. **Feed the green receipt BODY to the verdict panel, not just the file artifacts.** Today the
   panel judges `artifactFilesFor(steps, cwd)` (`orchestrate.mjs:146-154`) — the FILES. The
   engine-exec receipts (`engine-exec-ok` events carrying `out`, e.g. step-1's `"num_tables": 0`)
   are NOT surfaced into the panel framing. Surfacing the command outputs would let the panel see
   `num_tables: 0` / `True`-on-empty directly, sharpening (and speeding) the catch it already makes.
   This is a small, safe, additive engine change a future mission can carry — it strengthens the
   real catch rather than forcing a brittle deterministic one.

3. **Keep the verdict panel mandatory for code-repo (it is the real floor).** d1-1 is the proof
   that phase-3 is load-bearing, not ceremony. Any future "umrah" / single-witness tiering
   (`orchestrate.mjs:203`) must NOT downgrade code-repo missions with external effects to a light
   verdict — the producer-≠-verifier panel is what stands between a hollow green and a DONE.

---

## 5. Second problem named in the task — the containment-drift dirt gate

`assertCleanOutsideAllowlist(repoRoot, allowFiles)` (`git_steps.mjs:143-160`) runs
`git status --porcelain -uall` and flags **any** dirty path not in the allowlist as off-allowlist
drift; `orchestrate.mjs:745-753` then rolls back + HALTs the step (`failStep('containment-drift')`).

**The gap (diagnosis only — not fixed here):** the guard compares against the *current working
tree*, with no notion of a **baseline**. `assertRepoRoot` already captures `baseline` HEAD
(`git_steps.mjs:127-130`, returned and stored at `orchestrate.mjs:387` as `baselineHead`) — but
`baselineHead` is **never consumed** by the drift guard. So a code-repo whose worktree had
PRE-EXISTING uncommitted changes (dirt the mission did not create) trips the guard and cannot be
queued, exactly as the task describes.

**Why not fixed in this pass:** the correct fix is a judgment call with two reasonable shapes, and
making it wrong re-opens a real containment hole — so it warrants its own scoped mission rather
than being bundled into the false-green fix:
- (a) **Diff against baseline**: flag only paths dirtied *relative to `baselineHead`* (snapshot the
  pre-mission dirty set once, subtract it). Risk: a path the mission legitimately should own but
  that was already dirty would be silently exempted.
- (b) **Pre-flight refuse**: at `assertRepoRoot` time, if the declared `ALLOW-FILES` paths are
  already dirty, refuse the mission with a named reason ("worktree not clean for the declared
  allowlist — commit or stash first"), and keep the per-step guard strict. This preserves the
  guard's teeth and surfaces the real condition to the operator/conductor.

Recommendation: **(b)** — it keeps containment strict (the guard exists because a per-step
`--no-verify` commit of off-allowlist drift would land foreign changes in the real repo) and turns
a mid-mission HALT into a cost-zero pre-flight refusal with an actionable message. Implement under a
dedicated mission with its own selftests in `git_steps.mjs` + `orchestrate.mjs`.

---

## Summary

- **Mechanism**: `ok` = exit-0 of a planner-authored command (`orchestrate.mjs:578`,
  `seat_dispatch.mjs:130`); d1-1 step 8 printed `True` on a 0-row remote query.
- **Verdict**: both, primarily mission-authoring + verdict-panel territory; the engine had no
  floor at all on validation_command strength.
- **Implemented**: a conservative, code-repo-only plan-time floor rejecting remote-claiming steps
  witnessed by trivially-local presence checks, + planner framing, + 12 new selftests; full
  regression suite green.
- **Deferred (correctly)**: the empty-result-masking residual (verdict panel + authoring rule +
  surface receipt bodies), and the containment-drift baseline gap (own scoped mission, recommended
  shape (b)).
