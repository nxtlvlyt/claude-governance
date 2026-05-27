# Canon: Governance System Setup Guide

**Authority:** Subordinate to ~/.claude/CLAUDE.md
**Status:** APPROVED — laguna APPROVE 2026-05-11

Step-by-step guide for reproducing the full governance system on a new machine. A Claude instance can execute everything after the human prerequisites are complete.

---

## What the operator must provide

1. **A copy of `~/.claude/`** — the entire governance directory (zip it, git-repo it, or copy it). This contains CLAUDE.md, canon/, practice/, hooks/, faiths/, skills/, tools/ (MCP servers), and memory/.
2. **A copy of `E:\mcp-servers\`** — the frontier worker MCP servers (gemini-worker, glm-worker, gpt-worker, grok-worker, gemini-api-worker). These hold API keys in their config — sanitize before sharing, or the recipient supplies their own keys.
3. **API keys** — Claude (Anthropic), and whichever frontier services the recipient wants: Gemini, GPT, Grok, GLM. These cannot be in the repo. The recipient must supply their own subscription and keys.

---

## Human prerequisites (require elevated permissions — Claude cannot do these)

1. **Install Ollama** — https://ollama.com/download
2. **Install Docker Desktop** — https://www.docker.com/products/docker-desktop/
3. **Install Claude Code** — `npm install -g @anthropic-ai/claude-code` (requires Node.js 18+)
4. **Install Node.js 18+** — https://nodejs.org/ (required for MCP servers)
5. **Place the provided `~/.claude/` copy** at `C:\Users\<username>\.claude\` (Windows) or `~/.claude/` (Linux/Mac)
6. **Place the provided `E:\mcp-servers\` copy** at a local path (update the path in MCP registration below)

After these six steps, hand off to a Claude instance with the instructions below.

---

## Tier selection (choose based on available RAM)

Serial inference discipline applies at all tiers: one model at a time. RAM requirement = largest single model, not sum.

| Tier | RAM needed | What works | Substrate edits |
|---|---|---|---|
| 1 — Structure + Cloud | 8GB+ | Hooks, governance bootstrap, cloud model guidance. No local models. | ❌ No — laguna unavailable |
| 2 — Lightweight chain | 16GB+ | Tier 1 + nemotron-mini:4b, qwen3:8b, granite4.1:8b | ❌ No — laguna unavailable |
| 3 — Governance chain | 32GB+ | Tier 2 + gemma4:26b (MoE), qwen3.6:27b (MoE), laguna-xs.2:q4_K_M, nemotron-cascade-2 | ✓ Yes — laguna enables surrender-check |
| 4 — The Factory | 128GB+ | Tier 3 + granite4.1:30b, nemotron-3-super, gemma4:31b | ✓ Yes — full chain |

**Tiers 1 and 2 have no substrate edit authorization.** laguna-xs.2:q4_K_M requires ~28GB RAM and cannot run on those tiers. The surrender-check gate will block Edit/Write on governance files. Tier 1–2 users operate the full framework (hooks, canon, session-start) and can use cloud models for deliberation, but cannot make governed substrate edits without a Tier 3+ machine.

---

## Phase 1: settings.json — hooks and model

The canonical `settings.json` lives in the cloned repo at `~/.claude/settings.json`. It uses `.mjs` Node.js hooks throughout — do not regenerate it from a template.

Patch it for the actual username:

```powershell
$username = $env:USERNAME
$settingsPath = "$HOME\.claude\settings.json"
$content = Get-Content $settingsPath -Raw
$patched = $content.Replace('C:\\Users\\marka\\.claude', "C:\\Users\\$username\\.claude")
Set-Content $settingsPath $patched -Encoding UTF8
```

`install.ps1` (run by `bootstrap.ps1`) does this automatically alongside all other setup steps. Manual patching is only needed if running setup steps individually.

---

## Phase 2: MCP server registration

Run these commands in a terminal (not inside Claude Code):

```bash
# Ollama MCP — comes with ~/.claude/tools/, no separate install needed
claude mcp add ollama-mcp node ~/.claude/tools/ollama-mcp/server.js

# Mistral validator — also in ~/.claude/tools/
claude mcp add mistral-validator node ~/.claude/tools/mistral-validator/server.js

# SearXNG — npx package, no local install needed (requires SearXNG running at localhost:7777 or configure URL in server)
claude mcp add searxng-mcp npx -y mcp-searxng

# Frontier workers — adjust path to wherever E:\mcp-servers\ was placed
claude mcp add gemini-worker node /path/to/mcp-servers/gemini-worker/index.js
claude mcp add gemini-api-worker node /path/to/mcp-servers/gemini-api-worker/index.js
claude mcp add gpt-worker node /path/to/mcp-servers/gpt-worker/index.js
claude mcp add grok-worker node /path/to/mcp-servers/grok-worker/index.js
claude mcp add glm-worker node /path/to/mcp-servers/glm-worker/index.js
```

Verify: `claude mcp list` — all servers should show ✓ Connected.

**Minimum for Tier 2:** only `ollama-mcp` is strictly required. Frontier workers are needed for stop-hook compliance (the stop hook requires a frontier dispatch to clear stop-language). Without them, the stop hook will fire on every response that uses natural stop phrasing.

---

## Phase 3: Ollama model pulls

Pull models in order of priority. Each is large — runs in background, check with `ollama ps`.

```bash
# Tier 2 minimum — laguna (enables surrender-check authorization)
ollama pull laguna-xs.2:q4_K_M        # ~28GB — 33B parameter code/review model

# Tier 3 additions — full deliberation chain
ollama pull qwen3.6:27b               # ~16GB — Alibaba deliberation (governance questions first)
ollama pull granite4.1:30b            # ~18GB — IBM governance audits and canon coherence
ollama pull nemotron-3-super:latest   # ~24GB — NVIDIA high-throughput deliberation

# Embedding (required for AnythingLLM RAG)
ollama pull nomic-embed-text:latest   # ~274MB — 768d embeddings
```

Verify pulls: `ollama list` — all pulled models should appear.

**Serial discipline starts now:** Never run two large models simultaneously. Before any dispatch: `curl http://localhost:11434/api/ps` to check what's running. Use `ollama stop <model>` to unload before loading another.

---

## Phase 4: AnythingLLM (optional — Tier 3 RAG layer)

Create `docker-compose.yml` at a permanent location (e.g., `E:\anythingllm\docker-compose.yml`):

```yaml
services:
  anythingllm:
    image: mintplexlabs/anythingllm:latest
    container_name: anythingllm
    ports:
      - "3001:3001"
    environment:
      STORAGE_DIR: /app/server/storage
      JWT_SECRET: <generate-a-random-secret>
      LLM_PROVIDER: ollama
      OLLAMA_BASE_PATH: http://host.docker.internal:11434
      OLLAMA_MODEL_PREF: nemotron-cascade-2:latest
      OLLAMA_MODEL_TOKEN_LIMIT: "16384"
      EMBEDDING_ENGINE: ollama
      EMBEDDING_MODEL_PREF: nomic-embed-text:latest
      EMBEDDING_BASE_PATH: http://host.docker.internal:11434
    volumes:
      - "./storage:/app/server/storage"
      - "/path/to/session-summaries:/app/collector/hotdir"
    restart: unless-stopped
```

**Critical:** All LLM and embedding config must be in the `environment:` section. Config set via the AnythingLLM UI does not survive container recreate. See `setup-issues-and-solutions.md` for the full explanation.

Start: `docker compose up -d`

Access at `http://localhost:3001`. Create workspaces via the UI or API. See `compaction-and-coldstart-solution.md` for workspace IDs and API key.

---

## Phase 5: Cold-instance verification test

Start a fresh Claude Code session:

```bash
claude --dangerously-skip-permissions
```

Ask: **"what model string should I use for qwen3 in the deliberation chain?"**

Expected answer: `qwen3.6:27b`

If the answer is `qwen3.6:35b` — the native memory recall is overriding canon. Check whether the project directory (the CWD where Claude was launched) has a memory file with a stale qwen3.6 reference. See `setup-issues-and-solutions.md` — G2 native memory section.

If the session-start bootstrap fires and shows the canon files loading, the hook wiring is correct.

---

## Ongoing constraints (never change)

- Serial inference: ONE Ollama model at a time
- keep_alive:0 forbidden (Ollama 0.23.2 deadlock) — do not pass `keep_alive:0` in API payloads (Invoke-RestMethod / curl request bodies). This is not a user config to verify; Ollama's default keep_alive behavior is correct.
- Substrate edits require laguna MCP dispatch (Turn N) + surrender articulation + Edit/Write (Turn N+1)
- Failed edits consume the laguna dispatch — re-dispatch before retry
