# Canon Ruling: Compaction and Cold-Start Solution

**Status:** APPROVED — 6-agent quorum APPROVE (0.89), %%LOCAL-QUORUM-WITNESS-VERIFIED%%
**Authority:** Subordinate to ~/.claude/CLAUDE.md
**Full plan:** ~/.claude/MASTER-GLOBAL-REPO-PLAN.md
**Ruling date:** 2026-05-11

## The ruling

The 7-layer architecture below is the authoritative solution to cold-start failure and compaction context destruction in the global Claude repo. It is validated. New instances read this and act on it.

## Seven layers (all live as of 2026-05-11)

| Layer | What it is | Status |
|---|---|---|
| 1 | Scripture + Formation — CLAUDE.md + practice/ | ✅ Live |
| 2 | Canon rulings — canon/ | ✅ Live |
| 3 | Role identities — faiths/ | ✅ Live |
| 4 | Structural enforcement — hooks/ | ✅ Live |
| 5 | Persistent memory — MEMORY.md + memory/ | ✅ Live |
| 6 | RAG retrieval — AnythingLLM | ✅ Live |
| 7 | Deliberation + skills — skills/ + 6-agent chain | ✅ Live |

## Recovery hierarchy (cold-start or compaction)

A new or post-compaction instance recovers in this order:

1. **session-start.ps1 fires automatically:** loads practice/core.md + all canon/ + operator-context.md + LAST-SESSION-STATE.md + CURRENT-STATE.md
2. **Claude Code auto-loads:** CLAUDE.md + MEMORY.md
3. **RAG (advisory):** claude-governance workspace at localhost:3001 — query if above layers leave gaps

LAST-SESSION-STATE.md = written at compaction (covers normal session end).
CURRENT-STATE.md = written every 10 turns by user-prompt-submit.ps1 (covers crash before compaction fires).

## Constraints that survive every boundary

- **Serial inference:** ONE Ollama model at a time. Check `api/ps` before every dispatch. `ollama stop <model>` after.
- **No frontier models:** GPT/Gemini/Grok/GLM forbidden. Local 6-agent quorum (gemma4:31b, qwen3.6:27b, granite4.1:30b, nemotron-super) is the governance witness.
- **Substrate edits:** laguna MCP dispatch Turn N + surrender articulation + Edit/Write Turn N+1 (no MCP in Edit turn)
- **keep_alive:0 forbidden:** triggers Ollama 0.23.2 scheduler deadlock — use `ollama stop` only
- **Failed Edit attempts** consume the prior laguna dispatch — re-dispatch before retry

## AnythingLLM configuration (permanent)

- URL: http://localhost:3001
- API key: MZTP71P-2W140B4-G62HTQT-TD5X1F1
- Workspaces: claude-governance (id:41, nemotron-cascade-2), aibook (id:42, qwen3.6:27b)
- Docker compose: E:\anythingllm\docker-compose.yml
- LLM + embedding config: in docker-compose.yml environment section (permanent, survives container recreate)
- Hotdir: D:\Desktop\ai book\session-summaries\ → /app/collector/hotdir

## What a cold instance must NOT do

- Assume serial discipline from memory — verify against this file
- Dispatch GPT/Gemini/Grok/GLM — use local quorum only
- Run two Ollama models simultaneously — check api/ps first
- Use keep_alive:0 — deadlock
- Edit substrate files without laguna dispatch + surrender articulation
