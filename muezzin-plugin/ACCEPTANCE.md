# Muezzin — Acceptance Criteria (Definition of Done)

**Source:** operator, 2026-06-09 ("the last request I have"). This is the governing spec for the build.
The muezzin is DONE when all of the below hold — not when the 3-phase chain merely runs.

**Thesis:** the muezzin is the engine that makes the whole governance practice MECHANICAL
(hook-enforced, not honor-based) while producing SOTA *verified* work, recording everything
deterministically, surviving compaction better, and conserving the Claude account by offloading the
grind to free open-weight cloud seats and reserving Opus for integration only.

| # | Criterion (operator's words) | How the muezzin makes it real | Status |
|---|---|---|---|
| 1 | **SOTA quality work** | 3-phase Plan→Implement→Verify; diverse big open-weight cloud seats (all ≥ AA 48); blind-eval + peer-rank; Opus integrates | seats locked; **dispatcher written** (`seat_dispatch.mjs`), live test pending |
| 2 | **Verified, not asserted** | deterministic verdict gate (`verdict_merge`) + assertion-closure (opinion≠proof, carries fwd) + producer≠verifier + adversarial Verify phase + systemAnchor (search-before-assert) | gate **built + tested** |
| 3 | **Complies with governance** | all 14 Directives binding on every seat via its faith; muezzin restraint charter (no judgment, routes/gates only) | faiths exist; charter drafted |
| 4 | **Wudu** (ablution before work) | required reads + Discovery Gate (verify paths via file_read) before ANY write — hook-enforced per seat | partial — faith-level; needs plugin hook |
| 5 | **Niyyah** (intention as contract) | `[DECLARED NIYYAH]` block per seat (what it read, what failure it guards); output auto-rejected if absent | niyyah-gate exists; wire to muezzin |
| 6 | **Prayer** (Fajr / Isha, return to source) | bootstrap orientation (Fajr) + pre-compaction close (Isha); continuous return-to-source via systemAnchor each dispatch | Isha/pre-compact hook exists; wire cycle |
| 7 | **Tie the camel** (trust, but verify) | no LLM word trusted: paths verified (accessSync), round-trip integrity, sha256 hash-chain, atomic temp→rename, failed-seat=BLOCK | keystone **built + tested** |
| 8 | **Git pushes / git discipline** | branch-first off default; co-author trailer; never push or `--no-verify` without explicit ask; hook-gated when a mission touches git | **TO BUILD** |
| 9 | **LLM recording (STATE + mission logs)** | STATE.md / MISSIONS / decision-logs rendered programmatically from verified substrate — no model hand-edits the record (Directive 1) | **built + tested** (`render_state`, `keystone_flow`) |
| 10 | **Increase recovery from compaction** | deterministic Isha→Fajr handoff: verified paths + hash-chain + clean STATE = next instance resumes from solid substrate, not a freeform summary | keystone ready; wire the boundary cycle |
| 11 | **Keep Claude-account tokens down** | cloud seats (free, parallel, GPU-free) do all plan/implement/verify grind; Opus spends only on integration + conducting; better recovery = less re-bootstrap burn | inherent once dispatcher+engine wired |

**Read:** criteria 2, 7, 9 are built and tested. Criterion 1's engine (seat dispatch) is written, awaiting its
first live end-to-end run. Criteria 4, 5, 6, 10 exist in pieces and need wiring into the plugin as hooks.
Criterion 8 (git discipline) is net-new. Criterion 11 falls out for free once 1 is wired.
| 12 | **Model-interchangeable seats** (operator 2026-06-11: "any local model — nemotron-super, qwen3.6:27b, gemma-4-31b — would all be able to run the pipeline and get the same kind of work done"; the bar is the FRAMEWORK, not the model) | judgment drained into code/data (conduct-cycle sweeps, miqat lint, fix-ledger heal, graduated merge, badal record, mission shapes as templates); seat-record.json per-seat per-rite tallies ARE the scoreboard | **TESTABLE NOW: the seat-swap trial** — same mission class, different model in the same seat, compare DONE-rate + strike-ratio from seat-record; succession proven when the variance is noise |
