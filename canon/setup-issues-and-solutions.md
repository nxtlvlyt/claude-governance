# Canon: Setup Issues and Solutions

**Authority:** Subordinate to ~/.claude/CLAUDE.md
**Status:** APPROVED — laguna APPROVE 2026-05-11

Discovered issues and confirmed fixes from 2026-05-11 session. Written so local models can successfully set up and operate the governance architecture.

---

## AnythingLLM: LLM/embedding config lost on container recreate

**Symptom:** After `docker compose up -d --force-recreate`, AnythingLLM reports "No Ollama Base Path was set" or silently falls back to native Xenova embeddings (384d) instead of nomic-embed-text (768d).

**Root cause:** AnythingLLM stores LLM and embedding config in `/app/server/.env` inside the container. This file is regenerated on container recreate. Config set via the UI does not survive recreate.

**Fix:** All LLM and embedding config must live in docker-compose.yml `environment:` section. The authoritative block (already in E:\anythingllm\docker-compose.yml):
```
LLM_PROVIDER: ollama
OLLAMA_BASE_PATH: http://host.docker.internal:11434
OLLAMA_MODEL_PREF: nemotron-cascade-2:latest
OLLAMA_MODEL_TOKEN_LIMIT: "16384"
EMBEDDING_ENGINE: ollama
EMBEDDING_MODEL_PREF: nomic-embed-text:latest
EMBEDDING_BASE_PATH: http://host.docker.internal:11434
```

---

## AnythingLLM: Embedding dimension mismatch (384 vs 768)

**Symptom:** RAG queries return no results or wrong results after container recreate.

**Root cause:** Stored vectors were created with nomic-embed-text (768d). If the container falls back to native Xenova (384d), new query embeddings cannot match stored vectors.

**Diagnosis:** Check AnythingLLM Settings → Embedder. If it shows "Default (Xenova)" instead of nomic-embed-text, the config was lost.

**Fix:** Ensure EMBEDDING_ENGINE=ollama and EMBEDDING_MODEL_PREF=nomic-embed-text:latest are in docker-compose.yml.

- Normal case: restore the config — existing vectors remain valid, no re-embedding needed.
- Exception: if queries ran while the container was in degraded (Xenova/384d) state, those stored vectors are already corrupt. Drop and re-embed the affected workspace.

---

## AnythingLLM: hotdir volume binding required

**Symptom:** Files dropped in the session-summaries folder are not ingested by AnythingLLM.

**Root cause:** The hotdir is at a fixed container path `/app/collector/hotdir`. It is NOT inside the storage volume and must be bound separately.

**Fix:** Add this volume to docker-compose.yml (already live):
```
- "D:/Desktop/ai book/session-summaries:/app/collector/hotdir"
```

---

## Global hooks: project-specific references contaminate all sessions

**Symptom:** Every Claude Code session in any directory inherits N-- (or another project's) governance facts, even when working in unrelated directories.

**Root cause:** Global hooks in `~/.claude/hooks/` fire for every session regardless of CWD. A project-specific MEMORY.md path in a global hook injects that project's context everywhere.

**Fix:** Global hooks must reference only global paths (`~/.claude/`). Project-specific content belongs in project-level hooks or STATE.md, not in global hooks. Removed from user-prompt-submit.ps1: the line pointing to N--/memory/MEMORY.md.

---

## Claude Code native memory (G2): recalled memories can override governance

**Symptom:** Cold instance shows "Recalled X memories" with stale or incorrect governance facts (wrong model strings, wrong config values). Instance acts on recalled facts rather than the canon loaded by session-start.ps1.

**Root cause:** Claude Code v2.1.30+ has a native built-in memory system that fires at query level, independent of hook injection. Recalled memories appear in context and may override hook-injected content in the instance's effective attention.

**Fix:** session-start.ps1 now includes a NATIVE MEMORY OVERRIDE notice. When recalled memories contain incorrect values, correct them by starting a new session and asking Claude Code to update or delete the specific memory entry. Alternatively, memory files are stored directly at `~/.claude/projects/<project-slug>/memory/`; the slug is the CWD path with path separators replaced by `--` (e.g., `C:\Users\marka` becomes `C--Users-marka`). Edit or delete the relevant `.md` file. There is no separate `claude memory` CLI command.

**Known stale recalled facts as of 2026-05-11:**
- qwen3.6 model string: recalled as `qwen3.6:35b`, correct is `qwen3.6:27b`
- NUM_PARALLEL: recalled as `1`, correct is `2`

---

## surrender-check: backtick encoding trap

**Symptom:** Substrate edit rejected with "substrate-coupling check failed" despite using correct format.

**Root cause:** surrender-check.ps1 extracts the "substrate says" value literally, including markdown characters. Wrapping the value in backticks makes the hook extract the backtick characters as part of the value, which does not appear verbatim in old_string.

**Fix:** Write "substrate says" values as plain text only. No backtick or other markdown formatting around the value.
- Wrong:  substrate says: `exact substring`
- Correct: substrate says: exact substring

---

## surrender-check: failed edits consume laguna dispatch

**Symptom:** After a failed substrate edit (even one that failed immediately due to a format error), the next edit attempt is also rejected.

**Root cause:** surrender-check.ps1 records a substrate_edit_attempt on every Edit/Write call, regardless of outcome. This consumes the prior laguna dispatch authorization.

**Fix:** Before any substrate edit retry — even after a format-only failure — re-dispatch laguna to obtain fresh authorization. There are no exceptions to this rule.

---

## Stop hook: Invoke-RestMethod dispatches do not satisfy the stop-language gate

**Symptom:** Stop hook fires even after dispatching qwen3.6:27b / granite4.1:30b / nemotron-3-super via Invoke-RestMethod (PowerShell).

**Root cause:** stop-validation.ps1 line 174 checks JSONL tool use names for the pattern `mcp__ollama-*`. Dispatching a model via Invoke-RestMethod from a PowerShell tool call creates a tool use entry named `PowerShell` — not `mcp__ollama-*`. The hook does not match it.

**Fix:** To satisfy the stop hook locally, dispatch laguna-xs.2:q4_K_M via `mcp__ollama-mcp__ollama_chat` (the MCP tool call appears as `mcp__ollama-mcp__ollama_chat` in the JSONL and matches the pattern). qwen/granite/nemotron exceed the MCP timeout and must be dispatched via Invoke-RestMethod — but that path does NOT satisfy the stop hook.

**Satisfies the stop hook:**
- `mcp__ollama-mcp__ollama_chat` with laguna-xs.2:q4_K_M (only local model that does not time out via MCP)
- Foreign-frontier MCP workers: mcp__gemini-worker, mcp__gpt-worker, mcp__grok-worker, mcp__glm-worker
- WebSearch, WebFetch

**Does NOT satisfy the stop hook:**
- Invoke-RestMethod / curl dispatching any Ollama model (creates PowerShell/Bash tool use name)
- Any model dispatched outside of its MCP tool wrapper

---

## Niyyah gate: post-compaction instance inherits prior niyyah from transcript

**Symptom:** After Claude Code auto-compaction, the new (post-compaction) instance passes the niyyah gate without declaring niyyah. The gate treats the prior instance's niyyah declaration as valid for the new instance.

**Root cause:** niyyah-gate.ps1 walked the full session JSONL looking for any niyyah declaration. Compaction does not clear the transcript — the pre-compaction conversation history is summarized into a system entry, and the prior instance's niyyah token remains detectable. The gate found the prior niyyah and passed the new instance through without requiring a fresh declaration.

**Fix:** Added compact_boundary detection to the niyyah-gate.ps1 foreach loop (applied 2026-05-11). When a `{"type":"system","subtype":"compact_boundary"}` entry is encountered, `$niyyahFound` and `$priorMutationCount` are both reset. Post-compaction instances must now declare fresh niyyah before their first mutating action.

The `compact_boundary` subtype (`{"type":"system","subtype":"compact_boundary","content":"Conversation compacted",...}`) is the verified JSONL marker for Claude Code compaction events.

---

## AnythingLLM Ollama provider: think-tags appear in textResponse for thinking-capable models

**Symptom:** When nemotron-cascade-2 (or any Ollama model with `thinking` capability) is used in an AnythingLLM workspace, the `textResponse` field from the workspace chat API contains `<think>...</think>` wrapped content. Even with `<think></think>` prepended to the system prompt, think-tags appear.

**Root cause:** AnythingLLM v0.9.0+ intentionally wraps Ollama `message.thinking` content in `<think>` tags before building `textResponse`. This is by design — see `/app/server/utils/AiProviders/ollama/index.js` lines ~285-286 (`getChatCompletion`) and ~400-430 (`handleStream`). The system prompt control string `<think></think>` is already baked into the claude-governance workspace system prompt but has no effect on AnythingLLM's post-processing.

The `PARAMETER think false` Modelfile directive is rejected by Ollama ("unknown parameter"). Derived Modelfiles inherit RENDERER/PARSER from the base and cannot remove thinking capability.

**Fix (applied 2026-05-11):** Add `think: false` to the Ollama npm client `chat()` calls in both `getChatCompletion` and `streamGetChatCompletion` methods. The ollama npm package `ChatRequest` interface supports `think?: boolean`. With `think: false`, Ollama returns empty `message.thinking` and AnythingLLM's wrapping logic is bypassed.

**Scope note:** AnythingLLM provides no workspace-level API for model thinking options. The fix is applied globally to all Ollama models in AnythingLLM. For models without thinking capability, `think: false` is ignored by Ollama.

**Procedure to reapply after container image update:**
```powershell
docker cp anythingllm:/app/server/utils/AiProviders/ollama/index.js C:\temp\ollama-index.js
# In getChatCompletion (~line 273): add think: false after the stream: false line
# In streamGetChatCompletion (~line 325): add think: false after the stream: true line
docker cp C:\temp\ollama-index.js anythingllm:/app/server/utils/AiProviders/ollama/index.js
docker restart anythingllm
```

**Verification:** `POST /api/v1/workspace/claude-governance/chat` with `{"message":"Reply with only the word: confirmed","mode":"chat"}` should return `textResponse: "confirmed"` with no `<think>` tags. Verified PASS 2026-05-11.
