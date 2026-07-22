# Muezzin — Mission Architecture: levels, sizing, and the three guarantees

**Source:** M42 micro-queue (`MISSION42_MICRO_QUEUE_PLAN.md`) + the failure diagnosis (`DIAGNOSIS.md`) + the delegation principles (`MISSION_CONSTRUCTION.md`). This is HOW a mission decomposes and flows so the chain stays un-overwhelmed, focused, and high-quality. Construction = how a mission is written; this = how it is structured and run.

## The three levels
- **Mission** — one coherent **Maqsad** (objective). Carries its **own isolated sub-state** (not the monolithic STATE.md). Written purpose-only (niyyah + maqsad + unbiased context).
- **Sub-mission** — when a mission's decomposition exceeds the **size ceiling**, the Architect SPLITS it into sub-missions, each its own Maqsad + sub-state. (Stops one mission from bloating context and going off-topic — the operator's stated reason for sub-states.)
- **Micro-action** — the atomic unit: exactly ONE of {one file edit · one command · one verification}, with explicit `target_files` + `context_dependencies`. **Hard rule: reject any micro-action touching >1 implementation file.**

## The size ceiling (what triggers a split)
- Each mission/sub-mission carries a **budget**: a token/char cap on its sub-state + a max micro-action count. Exceed it → split into sub-missions, each under budget.
- Rationale — **Q2:286 / mizan**: a unit of work must stay inside the chain's reliable working capacity. Overloading a seat (whole-mission, multi-file scope) is exactly what produced agy's stacked SyntaxError/circular-import REJECTs.
- The numeric budget is **tunable/calibrated empirically**, not a magic constant — flagged, not asserted.

## Guarantee 1 — DON'T OVERWHELM (capacity / Q2:286)
- Decompose until each unit is **one verifiable change**.
- Each micro-action runs as an **isolated subagent loading ONLY** `target_files + context_dependencies + step text` — never whole-mission context.
- The size ceiling splits oversized missions *before* they ever reach a seat.

## Guarantee 2 — STAY FOCUSED (tawhid / no drift)
- **Per-mission isolated sub-state**; only the active mission's loads. Historical/unrelated concerns are stripped (the context-leakage failure class).
- The mission is stated by **Maqsad + niyyah, unbiased, no mechanics** — orienting the chain to the objective, not to a prescribed path it can drift from.
- One coherent source of truth per mission (tawhid); the muezzin merges sub-states up at Isha, so the registry (MISSIONS.md) stays thin and the next Fajr loads only what's active.

## Guarantee 3 — KEEP QUALITY HIGH (itqan / ihsan / witnessed deeds)
- Each micro-action is **gated on its OWN execution receipt before the next pops** (tartib: a later step is structurally forbidden until its prerequisite produced a valid product — kills the M27 Stage-3 hour-loss and M31 stacked-error reject).
- **No PASS without a receipt the muezzin ran** (`node -c` / `bash -n` / `docker build` / test). **Min-not-average** confidence.
- **git commit per passing step; rollback per failing step** — surgical single-step repair, never whole-phase rejection.
- The **verifier seat sees only file + AC + receipt** (independent witness — not the executor's self-attestation prose).
- **Numeric contracts are declared, then pinned (RULE 19, both jurisdictions since 2026-07-22):** a mission whose Maqsad fixes exact numbers (thresholds, weights, budgets, caps) declares them once as `NUMERIC-CONTRACT: n1,n2,...` — the miqat then refuses the mission unless every listed literal appears in a validation_command/[command]/[verify] step. Prose numbers a seat can silently rewrite are not a contract (mt-levels-not-ladders shipped wrong thresholds exactly this way).

## The flow (one mission, end to end)
1. A Mission arrives as an **amanah**: Maqsad + niyyah + unbiased context.
2. **Phase 1 — Architect does ijtihad:** decomposes into a `micro_queue` (sub-missions if over budget; micro-actions within budget).
3. **The muezzin pops micro-actions serially**; each runs isolated → gated on its receipt → commit-or-rollback.
4. **Phase 3 — Isha:** the muezzin merges the sub-state up deterministically (no LLM writes the record), hash-chained.
5. The registry stays thin; the next Fajr loads only the active sub-state.

**Net:** sub-missions keep each unit inside capacity (don't overwhelm), isolated sub-state + objective-only framing keep it focused, and per-step receipts + rollback keep quality high — the three guarantees, each anchored to a principle agy violated.
