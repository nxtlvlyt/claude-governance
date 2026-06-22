**NEEDS-WORK**

1. **MISSING: Explicit branching/monitoring for reward hacking & consensus failure modes.** The 2026 SOTA (OpenAI's *deliberative alignment*, Anthropic's *constitutional classifiers*, DeepMind *debate* protocols) requires *mechanistic* adversarial probes between phases, not just critic seats. No "red team" seat, no explicit epistemic-uncertainty quantification, no calibrated confidence rejection threshold.

2. **Internally coherent BUT fragile coupling.** Plugin→Workflow→state file→hooks.json→cron heartbeat chain is sound on paper; in practice, Claude Code plugin sandbox + filesystem state + external cron creates three durability boundaries with undefined failure semantics. Which is source of truth when `PostToolUse` fires mid-phase-crash?

3. **Single biggest gap: No explicit "stop and escalate" boundary condition.** Bounded retries ≠ bounding *what* gets retried. If all seats hallucinate consistently (correlated failure), adaptive heal retries harder into the same attractor. Missing: divergence-detection (seat outputs >Nσ apart), automatic human/stronger-model escalation channel, and explicit mission-abandonment criteria with state preservation for forensic analysis.

4. **"Muezzin does no work" is leaky abstraction.** Dispatch, gating, self-healing, context compression between phases—this *is* cognitive work. Claiming otherwise obscures where the conductor's own model (Claude, via plugin) can fail, hallucinate state, or be misled by malicious seat outputs. No introspection layer on the muezzin itself.

5. **Witness certification is procedure, not mechanism.** "Open-weight panel reviews"—how? Quorum voting? Deliberation log? What if witness seats disagree? The governance mapping asserts D1/D14 compliance but the *operationalization* is handwaved. SOTA requires verifiable, replicable witness (ZK-provable logs, signed attestations)—none specified.

6. **Temporal/context-engineering citations are aspirational.** LangGraph/Temporal patterns don't trivially port to Claude Code's constrained plugin model. The "deterministic shell + non-deterministic LLM activities" separation is correct conceptually, but the actual Workflow script grammar, checkpoint granularity, and replay semantics are **unwritten**—this is architecture sketch, not validated design.