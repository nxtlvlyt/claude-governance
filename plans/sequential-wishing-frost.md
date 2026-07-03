# Plan: Fix the "park instead of diagnose" conductor behavior

## Status: RESOLVED 2026-07-03 — closed by machinery, verified from live sweep output

The question this plan was researching ("is diagnose-vs-park a standing policy anywhere
a fresh instance would actually read it, or one instance's judgment?") is answered by
conduct-cycle.mjs itself, receipted from a live sweep run 2026-07-03T21:25Z:

1. **DIAGNOSE-<mission> actions** fire for every FAILED(x2) with the rule text
   "FAILED x2 needs diagnosis from receipts, never a blind relaunch (conductor faith)"
   and "a bare FAILED mark is not a finished judgment" — the exact receipt paths to
   read are printed per mission.
2. **PERFORM-NAMED-FIX-<mission> actions** fire when a diagnosis names a fix that was
   never performed: "sitting on a named fix is the violation" (self-heal rule,
   operator 2026-06-10). Parking a named fix is now mechanically surfaced every beat.
3. **REVISIT-PARKED** fires for parks whose revival condition was never re-checked:
   "a park whose revival condition is never re-checked is a graveyard, not a hold"
   (operator 2026-07-02) — verdicts REVIVE-NOW / RETIRE-SUPERSEDED / STILL-BLOCKED
   required, "silence is the only invalid outcome".
4. **BEAT-COMPLETE BAR**: when required actions exist, "nothing needed from you" is
   EARNED only after at least one lands — a conductor cannot end a beat by deferring.

So: it was originally a judgment lapse class, and it has since been drained out of the
seat into the sweep (the succession-scorecard pattern in STATE.md). Any future
instance — any model — inherits the diagnose-first policy mechanically. No further
work owed under this plan.
