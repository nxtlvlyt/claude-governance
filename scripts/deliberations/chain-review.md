# Operator Context Review

Review `~/.claude/operator-context.md` — the cold-instance brief loaded every session.
Find what is wrong, outdated, or missing. Be specific. Cite line numbers or section names.

Investigate:

1. **Dispatch method** — does the document correctly distinguish: MCP (laguna-xs.2 only, small),
   Python streaming (all large models: qwen/gemma/granite/nemotron), Invoke-RestMethod (does NOT
   satisfy stop hook)?

2. **Deliberation chain sequence** — does the document correctly reflect the 7-seat chain:
   gemma → qwen → Sonnet (in-context Seat 3) → laguna → granite → nemotron → Sonnet executor?

3. **think parameter accuracy** — qwen3.6:27b uses think:True (C2 fix, commit bbb7952, 2026-05-14).
   nemotron-3-super:latest uses think:False. Both must be top-level body keys, NOT inside options.
   Does the document reflect this correctly?

4. **Timeout rules** — does the document specify timeout=num_ctx (not a fixed number)? Critical.

5. **GPU per-agent config** — gemma4:31b=99, qwen3.6:27b=99, laguna=99, granite=99, nemotron=14.
   laguna num_ctx not honored by Ollama (allocates 24576 KV regardless). nemotron partial offload:
   14/89 layers, 13.6GiB CUDA0. Are these documented correctly?

6. **ProcessStartInfo requirement** — Ollama restart after updates requires ProcessStartInfo with
   explicit OLLAMA_LLM_LIBRARY=cuda_v12. Start-Process inheritance unreliable on this machine.
   Confirmed 2026-05-13. Is this documented?

7. **Any other gaps, errors, or outdated content** — stale version numbers, wrong paths, missing
   constraints, procedures that have been superseded.

## Substrate Files

operator-context.md

## Search Queries

- Ollama MCP timeout CPU inference local models Python streaming dispatch 2026
- Ollama API chat endpoint streaming qwen think parameter placement top-level options
- local LLM deliberation chain multi-agent governance cold instance brief accuracy
- Ollama GPU partial offload num_gpu layers VRAM configuration RTX 4090
- Claude Code hooks governance session-start cold instance context loading 2026
