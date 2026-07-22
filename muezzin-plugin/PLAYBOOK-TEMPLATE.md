# PLAYBOOK-TEMPLATE — the canonical house playbook structure

Authored 2026-07-21 at the operator's word ("can we check how we are writing playbooks for
the warroom... did we find any gaps in how we structure playbooks"). Distilled from the two
proven playbooks — GAP-CLOSURE-PLAYBOOK.md (2026-07-03) and CONDUCTOR-PORT-PLAYBOOK.md
(2026-07-11) — whose format existed only by imitation until this file. Gap this closes:
warroom's HIERARCHY.md lists playbooks as a substrate tier, but no jurisdiction had a spec
for what one IS. Warroom's playbook tier inherits this template.

## A playbook is NOT a tutorial

- A **playbook** is an OPERATIONAL INDEX + narrative over receipts: it tells an executor
  (chain, conductor, or future instance) what to do, in what order, with what acceptance
  bars, and WHERE each claim's full receipt lives. Its prime directive is D12: "read the
  pointed file before acting on a summary here." It is never self-contained on purpose.
- A **tutorial** is a self-contained TEACHING narrative for a human builder (e.g. the
  Desktop trading-bot playbook doc). It carries its lessons inline and duplicates freely.
- Label the artifact honestly. A tutorial titled "playbook" invites executors to act on
  summaries; a playbook titled "tutorial" buries its acceptance bars.

## Required sections (from the proven pair — deviations need a receipted reason)

1. **MANDATE HEADER** — author + date + the operator's words VERBATIM that commissioned it,
   and what spend/scope the playbook represents. (Both proven playbooks open this way; it is
   the authority chain.)
2. **POINTER DISCIPLINE CLAUSE** — the explicit sentence that every summary names where its
   full receipt lives and the receipt must be read before acting. (CONDUCTOR-PORT: "read the
   pointed file before acting on a summary here (CLAUDE.md D12)".)
3. **EXECUTION MODEL** — WHO executes each part (chain mission vs conductor-direct vs human),
   with the exceptions ENUMERATED and each exception carrying its reason (bootstrap hazard,
   identity-bound, etc.). Never leave executor-selection to judgment.
4. **PROVEN PATTERNS** — the house-style section: named patterns with their receipts, stated
   as conditions ("FAIL-OPEN only when a defect CANNOT be proven"). New work deviating from a
   listed pattern needs a receipted reason.
5. **UNIT/PHASE SEQUENCE, dependency-ordered** — each unit: what, why (one line), the
   ACCEPTANCE BAR (mechanically checkable — a selftest, a marker, a census count; never
   "looks done"), and the EVIDENCE POINTER (file/receipt the unit is judged against).
6. **SELF-UPDATE CLAUSE** — the instruction that whoever executes the playbook updates it
   with what they learned (CONDUCTOR-PORT: "update this file with what it learns"). A
   playbook that can't absorb its own execution receipts goes stale silently.
7. **JURISDICTION** — which repo/queue/authority the playbook binds to. Authority is
   re-derived per jurisdiction, never cross-mounted.

## Known structural gaps this template records (open, dated 2026-07-21)

- **No staleness mechanism**: nothing mechanically flags a playbook whose receipts have
  drifted from reality (the trading-bot tutorial's invented alert legend is the failure
  class: asserted formats with no pointer to the source of truth). Candidate fix: every
  playbook lists its LOAD-BEARING FILES; a lint compares mtime/anchors and flags drift.
  Owner: N5-adjacent engine item, unassigned.
- **Warroom playbook tier is empty**: HIERARCHY.md declares it; no artifacts exist. First
  real warroom playbook should be authored FROM this template when warroom S-phases resume.
