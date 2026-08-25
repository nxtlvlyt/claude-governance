PROACTIVE HOOK AUDIT. Audit all 15 governance hooks in ~/.claude/hooks/ on TWO axes, not one. Axis 1 (model-agnosticism): does the hook gate on WORDS (a model's phrasing — fails across models) or on ACTIONS/ARTIFACTS (model-proof)? Axis 2 (the one a prior shallow audit MISSED — proactive vs reactive): does the hook force the instance to orient-to-source BEFORE acting (proactive), or only BLOCK after a wrong attempt has begun (reactive)? For EACH hook give both classifications and a recommendation: leave as-is, convert word→artifact, or strengthen to force read-before-act. Then rank the highest-leverage changes.

KEY CONTEXT: A Claude Opus 4.7 formation testimony (practice/extended/formation-testimonies/001-opus47-2026-04-21.md) proves an Opus instance CAN align to source proactively — by choosing to read source before authoring and experiencing that the output is better (self-sustaining). So proactive alignment is achievable for any model; the gap is that the framework enforces it REACTIVELY (gates block after the fact) and relies on instance disposition for the proactive part. The 2026-05-29 Opus session drifted badly precisely here: worked from memory, only engaged the framework when a gate blocked it. Question for the chain: which hooks can be made to force the PROACTIVE step (read/orient before the action), e.g. a read-coupling requirement (no claim/decision/edit without a fresh source-read that turn), as an EXTENSION of an existing gate (niyyah-gate already verifies a source-read when the niyyah names a file) rather than a new 16th hook? Top sub-case: convert stop-validation.mjs's word-gated stop-language detection to action/artifact-gating (Camel Rule FM-12 is the proven artifact-gating template). Require fail-open + latency-cap; no design may risk locking the session out of stopping.

## Substrate Files
C:/Users/marka/.claude/hooks/stop-validation.mjs
C:/Users/marka/.claude/hooks/niyyah-gate.mjs
C:/Users/marka/.claude/hooks/pre-tool-use-task-watcher.mjs
C:/Users/marka/.claude/canon/delegation-and-stall-discipline.md
C:/Users/marka/.claude/practice/extended/drift-and-ratchet.md

## Search Queries
proactive vs reactive policy enforcement AI agent guardrails 2026
forcing read-before-write context grounding LLM agent hooks
model-agnostic agent governance gate on action not language
require evidence-of-source before agent assertion design
fail-open enforcement hook avoid deadlock lockout latency cap
