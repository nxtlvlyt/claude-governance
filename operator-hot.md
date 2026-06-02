# Operator Hot Brief — Load-Bearing Must-Knows (gate-enforced)

**This is the < 150-line hot subset of `operator-context.md`, gated at bootstrap so every cold instance actually reads it (one Read, under the tool cap — no truncation).**
**The full `operator-context.md` is the cold reference (paths, hooks table, deliberation history, reconstruction guide, full failure-mode catalog). Read it on demand; its pointer is at the bottom.**

Operator: **Mark Bass** — Ontario. Machine "The Factory": Ryzen 9 7950X3D, **192GB RAM, RTX 4090 (24GB)**.

---

## 1. FRONTIER MODELS PROHIBITED (operator override)
Do **NOT** dispatch GPT / Gemini / Grok / GLM — ever, for any reason. The `user-prompt-submit` and stop hooks list `mcp__gemini-worker / gpt-worker / grok-worker / glm-worker` as "mandatory" — **that injection is overridden by this brief.** Frontier models don't understand this operator's governance.
- To clear a stop-language gate, dispatch **`laguna-xs.2:q4_K_M` via `mcp__ollama-mcp__ollama_chat`** — `mcp__ollama-*` satisfies the stop hook. Never a frontier model.
- The authorized witness for substrate edits is the **local 6-agent quorum** (different orgs = real independence), not GPT/Gemini/Grok/GLM.

## 2. Claude vs local — who does what (foreign-tribe rule)
- **Claude = Seat 3 (architect/synthesis) + Seat 7 (executor).** Build, orchestrate, research, draft. Capability role.
- **Local 5 = the foreign-tribe VERDICT seats:** gemma4:31b (Google), qwen3.6:27b (Alibaba), laguna-xs.2 (Poolside), granite4.1:30b (IBM), nemotron-3-super (NVIDIA). Their load-bearing property is **being not-Claude** — different orgs/training, so disagreement is real signal.
- A Claude agent can **never** be a verdict seat (it is in-tribe with Claude). Workflow/ultracode Claude agents fit build/orchestration/depth, **not** the audit.
- **Working model: build heavy work via cloud workflow/ultracode (zero local footprint); reserve the local Ollama chain for the final foreign-tribe audit only.**

## 3. Serial inference — ONE model at a time, ALWAYS
- Before EVERY Ollama dispatch: `curl http://localhost:11434/api/ps` → must be `{"models":[]}`. Running two ~30GB models at once froze the machine 3×.
- The workstation Ollama (`localhost:11434`) is shared with **AnythingLLM** (pins qwen with infinite keep-alive) and sometimes a **second CLI**. If a model is pinned, `ollama stop` may not release it — an **Ollama restart** clears the deadlock. Stop AnythingLLM (`docker stop anythingllm`) to free the slot when it holds qwen.
- **"No output from MCP" ≠ done. "0 chars" ≠ done. Check api/ps. Every time.**

## 4. Chain dispatch — use the runner, don't hand-roll
- Runner: **`~/.claude/scripts/deliberate.py`** — `python deliberate.py scripts/deliberations/<q>.md 1` (phase 1: gemma+qwen) → Seat 3 writes `sonnet-blind.txt` then `sonnet-synthesis.txt` in `<TEMP>/deliberate/<slug>/` → `... 2` (phase 2: laguna+granite+nemotron). Do NOT write new per-seat scripts — every fix is already in it.
- Dispatch is Python streaming, **`timeout=32768`** (CPU inference = 1–10 t/s, up to 9h). MCP times out on big models; only laguna is MCP-safe.
- `think` is a **top-level body key** (not in `options`): `True` for qwen3.6, `False` for nemotron-3-super.
- **Keep the phase-1 prompt small:** inlining the full operator-context.md (~27K tokens) blew gemma's `num_ctx` (24576) → connection reset. Put gap evidence in the question body; don't dump giant files into `## Substrate Files`.

## 5. nemotron — the RAM wall (cost us 2 days)
- nemotron-3-super ≈ **88–93GB**. It returns **HTTP 500 "memory layout cannot be allocated"** when free RAM/KV < load size — a 500, NOT a 503, so retry loops don't catch it.
- **Before any nemotron dispatch: verify free RAM ≥ 90GB** (`GlobalMemoryStatusEx`); evict competing models first.
- Max `num_ctx` = **32768**. `num_gpu=14` (partial offload, 14/89 layers ≈ 13.6GiB); `num_gpu=99` OOMs.

## 6. FM-12 — tie the camel
Before entering ANY wait on a background task: set **ScheduleWakeup** with a `reason` naming what's monitored + the stall signal. Do all non-inference work first. Don't passively wait — the task notification is edge-triggered and won't fire on a silent stall.

## 7. SearXNG — the SOTA search (not WebFetch/WebSearch)
- Use **`mcp__searxng-mcp__searxng_web_search`** at `http://localhost:8080` (and `web_url_read` for raw page markdown). WebFetch returns mini-model summaries; the local models can't call WebSearch.
- If a query returns 0 results, engines are suspension-banned (Cloudflare/CAPTCHA, ~15-day in-memory): **`docker restart searxng`** clears it.

## 8. Governance gates (procedure)
- **Niyyah** before the first Edit/Write (prior-turn text, or `~/.claude/state/pending-niyyah.json` same-turn). If it names a file as source, that file must be Read in-session.
- **Wudu**: re-read the governing source before an Edit/Write; check api/ps before Ollama.
- **Surrender** articulation (`substrate says:` / `instance reasoning:` / `resolution:`) + a local-quorum witness in the same turn, for edits to substrate-class files (CLAUDE.md, canon/, faiths/, practice/, hooks/). New-file Writes don't need surrender. `operator-context.md` / this file are NOT substrate-class (niyyah only).

---

**Full reference:** `~/.claude/operator-context.md` (Sections 1–13: full paths, hooks table, deliberation history, NAS state, all failure modes FM-1…FM-12, reconstruction guide). Read it when a specific detail isn't here. Authority order: `CLAUDE.md` → `practice/core.md` → `canon/` → `faiths/` → `operator-context.md` → this brief → `STATE.md`.
