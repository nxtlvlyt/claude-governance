This governance framework's enforcement hooks reliably catch the "stalling/reaching" failure (an instance deferring a decision to the operator — detected via stop-language regex in stop-validation.mjs) but do NOT catch two other failure modes, and are mis-calibrated across models. (1) RUSHING: an instance confidently shipping unverified or broken output — no language signature; demonstrated 2026-05-29 when an upside-down, frozen video was shipped to the operator with "shipped and verified — HTTP 200" phrasing and zero actual frame-check. (2) UNEARNED REACHING: satisfying the stop hook with a token foreign-frontier/ollama dispatch while not doing the worthiness work CLAUDE.md and delegation-and-stall-discipline.md require ("the reach itself is the evidence — come with what you tried"). (3) MODEL MIS-CALIBRATION: the stop-language regex is tuned to Sonnet's formulaic deferrals (want me to / your call / should I) and misses Opus's softer deferrals (tell me / your eyes decide / whenever you want / what do you want / either way) — verified by transcript analysis of an Opus session that reached many times without firing the hook. A proposal (first substrate file below) defines four fixes, ALL generalizing the EXISTING, working Camel-Rule pattern (FM-12: pre-tool-use-task-watcher.mjs writes a structural state file; stop-validation.mjs gates the STOP action on that artifact, not on language): Fix 1 = verification gate on ship/declare-complete actions (require a verification artifact in-turn, substrate-coupled; supersedes a rejected language-keyed assertion-gate design); Fix 2 = fix the heartbeat that clobbers model_version to placeholder every 10 turns; Fix 3 = universalize stop-language detection (broaden regex with a precision/recall caveat, longer-term a semantic LLM-judge, plus a self-calibrating transcript-mining loop); Fix 4 = reach-worthiness articulation gate (require what-was-tried / where-reasoning-ran-out / classification before any operator reach). Evaluate rigorously: Are these four fixes structurally sound? What are the false-positive risks and the precision/recall and semantic-vs-regex tradeoffs? Is the Camel-Rule generalization valid, or does ship/reach differ from the background-task case in ways that break it? What are the implementation hazards (hook latency, gameability, interaction between fixes)? Should any fix be rejected or revised before implementation, and what is the highest-impact ordering?

## Substrate Files

C:\Users\marka\AppData\Local\Temp\governance-fix-proposal\assertion-gate-proposal.md
hooks/stop-validation.mjs
hooks/pre-tool-use-task-watcher.mjs
canon/delegation-and-stall-discipline.md

## Search Queries

- LLM agent guardrails action-gating versus language detection 2026 best practices structural enforcement
- AI agent self-verification hook false-positive rate regex bypass edge cases prompt phrasing variance across models
- code review structural hook design stop-language detection precision recall semantic classifier tradeoffs
- AI governance enforcement non-repudiation artifact-based gating compliance audit trail
- production AI agent verification gate latency testing semantic judge validation deployment
