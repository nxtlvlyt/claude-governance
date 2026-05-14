# C1 Search Refinement — Dynamic Query Generation in the Deliberation Chain

The current deliberation chain in `scripts/deliberate.py` requires search queries to be
pre-specified in the question file (one per seat). Agents cannot generate their own queries
mid-chain. This was flagged as concern C1 in the chain quality deliberation (2026-05-14,
CONDITIONAL_APPROVE, commit bbb7952): "SEARCH_REFINEMENT — dynamic query generation deferred
as design work."

**Question:** What is the right architecture for search refinement in this deliberation chain?
Specifically:

1. Should Seat 3 (in-context Sonnet synthesis) be able to generate new search queries after
   reading phase 1 outputs, triggering a second SearxNG pass before phase 2 begins?

2. Alternatively, should each phase 1 agent (gemma, qwen) be able to emit search queries in
   their structured JSON output that get executed before the next agent runs?

3. What quality improvement would dynamic search refinement deliver vs. static pre-specified
   queries — is the complexity justified?

4. What are the failure modes? (runaway query generation, context window overflow, chain
   getting off-track by following search tangents)

5. What does SOTA look like for agentic search refinement in multi-model deliberation chains
   in 2026? What patterns from RAG pipelines, MCTS, or multi-agent search apply here?

Evaluate against: implementation complexity in deliberate.py, risk of context window overflow
at 16384 ctx ceiling, serial inference discipline (no parallel fetches), and whether the
quality gain justifies the added latency.

## Substrate Files

scripts/deliberate.py
canon/6agent-deliberation-stack.md

## Search Queries

- multi-agent LLM deliberation chain dynamic search query generation agentic RAG 2026
- retrieval augmented generation iterative query refinement multi-step reasoning local models
- chain of thought search augmentation MCTS tree search LLM deliberation quality improvement
- agentic search loop context window management sequential inference token budget tradeoffs
- multi-agent system search grounding concern propagation quality verdict accuracy evaluation
