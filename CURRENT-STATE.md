# CURRENT-STATE.md

Written by: user-prompt-submit.ps1 hook (turn 580 heartbeat)
Timestamp: 2026-05-13 09:23:43
Project CWD: C:\Windows\System32

## Governance constants (always true)

- Serial inference: ONE Ollama model at a time. api/ps check before every dispatch. ollama stop after.
- Frontier models for governance deliberation: use local quorum (gemma/qwen/granite/nemotron). Frontier validators (Gemini/GPT/Grok/GLM) available for clearing stalls and framing audits per hook lines 20-22.
- Authority chain: CLAUDE.md -> canon/ -> operator-context.md -> LAST-SESSION-STATE.md -> CURRENT-STATE.md -> RAG

## Current session state

(Instance should update this file with active task, open gates, decisions in progress.)
