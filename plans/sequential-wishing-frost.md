# Plan: Fix the "park instead of diagnose" conductor behavior

## Status: researching (Phase 1 — Explore agents in flight)

Operator's concern: when a mission got stuck, the conductor's response was to PARK it
(defer to an unspecified "someone" to look at later) rather than actually diagnose and
fix the real problem. Operator wants to know: (1) why did this happen, (2) is this a
one-off judgment lapse or a structural gap that any future instance would repeat.

Research in flight:
- Agent 1: what conduct-cycle.mjs's existing DIAGNOSE-broken (judgment class) action
  actually does vs PARKED, and whether any existing mechanism re-diagnoses/retries a
  content-level (not infra-level) failure.
- Agent 2: whether conductor-core.md / operator-rulings.md / STATE.md / QUEUE.md already
  resolve "diagnose vs park" as a standing policy anywhere a fresh instance would
  actually read it, or whether it only ever existed as one instance's in-session
  judgment call.

Will fill in Context/Approach/Verification once research lands.
