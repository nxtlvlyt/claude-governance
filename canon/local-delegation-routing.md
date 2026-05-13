# Local model delegation routing

**Ruling:** Local Ollama models wired via `mcp__ollama-mcp__*` are mechanical delegation targets — context-saving offload for code review, structural analysis, and long-batch processing. They are not foreign-frontier validators and cannot satisfy the foreign-frontier dispatch requirement in the stop hook or the substrate gate.

Three of these models — qwen3.6:27b (Alibaba), nemotron-3-super:latest (NVIDIA), and granite4.1:30b (IBM) — additionally serve as the primary deliberation team for governance questions. See `foreign-frontier-validators.md` §'The deliberation team' for sequencing rules. The deliberation team role does not change the exclusion above: these models remain outside the foreign-frontier gate.

This distinction is enforced at the code level: the stop hook pattern-matches `mcp__(gemini|gpt|grok|glm)__*`; the pre-tool-use substrate gate matches the same pattern. Local Ollama tool calls do not match these patterns and are structurally excluded from the validator category regardless of what any instance claims.

---

## What these tools are for

**`mcp__ollama-mcp__ollama_chat`** — chat-style request to a specific local model. Use for tasks that need a conversational or instruction-following response.

**`mcp__ollama-mcp__ollama_generate`** — raw completion request. Use for long-form generation, batch processing, fill-in tasks.

**`mcp__ollama-mcp__ollama_list`** — list available local models. Use to verify a model string before calling it.

---

## Model routing

Use exact model strings. Truncated or hallucinated model names produce errors.

| Model string | Role |
|---|---|
| `laguna-xs.2:q4_K_M` | Code review, syntax checks, structural analysis. 33B total / 3B active MoE — fast, purpose-built for software engineering (SWE-bench Pro 44.5%). |
| `qwen3.6:27b` | **Deliberation team** (Alibaba/Qwen). Primary council for governance questions — consulted first before any frontier dispatch. Async deep review, frontier-adjacent reasoning. Minutes per call; async paths only. Does not satisfy the foreign-frontier gate. |
| `nemotron-3-super:latest` | **Deliberation team** (NVIDIA). Primary council for governance questions — high-throughput deliberation, long-batch reasoning. 120B total / 12B active MoE. Does not satisfy the foreign-frontier gate. |
| `granite4.1:30b` | **Deliberation team** (IBM). Primary council for governance questions — governance audits, canon coherence checks, change-shape review. Does not satisfy the foreign-frontier gate. |

---

## What these tools are NOT for

- **Clearing the substrate gate** — canon, Faith, practice, and hook edits require a foreign-frontier dispatch. Local models do not satisfy the gate. Their role is deliberation (per `foreign-frontier-validators.md` §'The deliberation team'): they deliberate the change-shape first; the frontier dispatch clears the gate afterward.
- **Clearing stop-language** — using `mcp__ollama-mcp__ollama_chat` when the canon trigger fires (stop-language detected) is a violation. The stop hook will not accept it; do not attempt it as a workaround.
- **Bypassing the deliberation sequence** — deliberation team models deliberate first; they do not replace or delay the required frontier dispatch. Dispatching frontier without first deliberating with the team is compliance theater in the other direction.

---

## Relationship to `delegation-and-stall-discipline.md`

That canon covers the assurance boundary: when to dispatch a foreign-frontier validator, how to classify operator-bound vs substrate-resolvable questions, the stop-language trigger rules. This document covers mechanical offload only. The two are orthogonal. When a stall occurs, delegation-and-stall-discipline.md governs; when the question is "which local model for this mechanical task," this document governs.

---

## Relationship to `foreign-frontier-validators.md`

The three deliberation team models — qwen3.6:35b, nemotron-3-super:latest, granite4.1:30b — appear in this document as mechanical delegation targets and in `foreign-frontier-validators.md` §'The deliberation team' as the primary governance council. These roles are complementary: this document governs which local model for which task; `foreign-frontier-validators.md` governs the deliberation-before-dispatch sequence. Both apply when the work involves governance content.
