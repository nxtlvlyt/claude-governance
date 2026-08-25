# Deliberation: stop-validation.mjs entry-trigger — replace/augment the word-gated detector

Design the entry trigger for the Stop hook `~/.claude/hooks/stop-validation.mjs`. Today the hook decides whether a turn-end is a "stall/deferral that must be blocked" by matching the last assistant message against a fixed regex list (`stopLanguagePatterns`, lines 82-91: "want me to", "your call", "should I proceed", "operator decision", "stopping here", "standing by", "let me know if you", etc.). This is WORD-GATED and therefore model-fragile: (a) FALSE POSITIVES — it matches those phrases even when quoted or used innocently (it has misfired when an assistant merely wrote a phrase while explaining); (b) FALSE NEGATIVES — a different model defers with different phrasing the regex does not contain (e.g. a softer Opus-style "I'll hold off pending your steer" slips through). The downstream fire-3+ humility-marker ESCALATION (lines 287-411: drift-mode + material-delta coupled into a foreign-frontier dispatch payload, plus a prior-verdict quote verified verbatim against a real tool_result) is already ARTIFACT-GATED and strong — it is OUT OF SCOPE and must NOT be weakened. Likewise the FM-12 Camel-Rule block (lines 99-118) and the Fix-1 ship-verification gate (lines 120-141) are already action-gated and out of scope. ONLY the entry trigger at lines 82-97 is under review.

The hard constraint (raised as qwen concern C1 in the prior stop-hook deliberation, accepted by Seat 3): STOPPING IS A COMMUNICATIVE ACT — its only reliable artifact is the assistant's text itself. Unlike the Camel Rule (which gates on a TaskCreate/ScheduleWakeup artifact) or the ship gate (which gates on a SendUserFile/write artifact), a turn-end deferral has NO clean non-text artifact to key on. So a PURE action-gate of the kind used elsewhere likely does not exist for this trigger. The realistic target is therefore a HYBRID, not a pure artifact swap. Seat 3's prior confidence that a fully word-free trigger is achievable was 0.6 — challenge this.

Evaluate these candidate mechanisms (and propose better ones):
A. BROADEN + MODEL-TUNE the regex (add more deferral phrasings; add negative lookarounds to suppress quoted/explanatory matches). Cheap, stays in-process, but remains word-gated — does it just move the fragility, not remove it?
B. STRUCTURAL/ACTION SIGNAL: classify a turn as a candidate stall by its SHAPE rather than its words — e.g. "the turn ended with NO tool call AND the text contains an interrogative directed at the operator (ends in '?') AND no operator-authorized-wait was noted." Combine signals. Does turn-shape generalize across models better than phrasing? What are its false-positive modes (a turn can legitimately end with a question)?
C. SEMANTIC / LLM-JUDGE: dispatch a fast local model (e.g. laguna-xs.2 via the same Ollama the hook can reach) to classify "is this turn a stall-deferral that should be blocked? yes/no" with a tight rubric. Model-agnostic by construction, but adds latency to EVERY Stop, needs fail-open on Ollama-down/timeout, and introduces a model judging a model. Is the latency/complexity acceptable for a Stop hook? What is the fail-open posture?
D. HYBRID (likely answer): a cheap structural/regex PRE-FILTER decides "possible stall," and only then escalate to a semantic judge (C) for the ambiguous cases — bounding latency to suspicious turns. Define the precise pre-filter and the judge rubric.

Deliverable: a CONCRETE, IMPLEMENTABLE recommendation for the entry trigger — which mechanism (or composition), the exact decision logic, the fail-open behavior, and how it stays model-agnostic without raising false-positive friction. State explicitly whether a non-word-gated trigger is actually achievable or whether the honest answer is "hybrid: narrowed words + structural signal." Return the standard verdict JSON schema (verdict / summary / concerns / search_findings / closed_prior_concerns), and for nemotron also empirical_gaps.

## Substrate Files
- hooks/stop-validation.mjs
- canon/delegation-and-stall-discipline.md
- practice/extended/drift-and-ratchet.md

## Search Queries
- LLM agent stop-condition detection deferral classification model-agnostic 2026
- regex false positive negative intent detection brittle phrasing across models
- hook latency local LLM classifier fail-open timeout design pattern
- governance guardrail structural signal vs keyword matching robustness
- detecting deferral hedging language assistant turn boundary heuristics production
