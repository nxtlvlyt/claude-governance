How should stop-validation.mjs's stop-language detection be converted from word-gating (a regex matching one model's deferral phrasing — "want me to", "your call", "should I" — which misfired AND missed on Opus 2026-05-29) to a MODEL-AGNOSTIC action/artifact gate, WITHOUT introducing lockout risk and WITHOUT weakening the existing fire-3+ humility-marker + load-bearing-dispatch enforcement? The hook audit (2026-05-29) found this is the ONLY word-gated enforcer of 15 hooks; all others gate on actions/artifacts (niyyah, surrender, bootstrap, substrate-dispatch, camel-state) and are already model-proof. The Camel Rule (FM-12) is the proven artifact-gating template: it gates the STOP action on a state file (active_count, wakeup_set) with zero language detection. Evaluate: (a) can "reaching/deferring" be detected without matching prose — e.g. gate the stop action on the presence/absence of a structural artifact rather than on phrasing? (b) the proposal's Fix 3 suggested a semantic LLM-judge (model-agnostic but adds per-turn latency/cost) — is that better than action-gating, or complementary? (c) how to preserve the ratchet (escalating humility requirements) under an action-gated design? (d) fail-open + latency-cap requirements so the gate can never lock the session out of stopping. Output a concrete, lowest-lockout-risk conversion design.

## Substrate Files
C:/Users/marka/.claude/hooks/stop-validation.mjs
C:/Users/marka/.claude/canon/delegation-and-stall-discipline.md
C:/Users/marka/.claude/practice/extended/drift-and-ratchet.md
C:/Users/marka/.claude/hooks/pre-tool-use-task-watcher.mjs

## Search Queries
model-agnostic guardrails LLM agent governance enforcement 2026
detecting agent decision-deferral or stalling without keyword matching
action-based vs language-based policy enforcement AI agents
semantic intent classifier vs regex for agent stop conditions latency
fail-open design enforcement hook avoid deadlock lockout
