# Operator Hot Brief — Load-Bearing Must-Knows (gate-enforced)

**This is the < 150-line hot subset of `operator-context.md`, gated at bootstrap so every cold instance reads it in ONE Read (under the tool cap — no truncation).**
**Full `operator-context.md` = cold reference (paths, hooks table, history, reconstruction guide). Read on demand; pointer at the bottom.**
**NOTE: a few facts in §3/§5 (AnythingLLM qwen-pin, SearXNG suspension restart, nemotron RAM precheck, gemma inline num_ctx blowout) are NEWER than operator-context.md and not yet backported — they live only here.**

Operator: **Mark Bass** — Ontario. "The Factory": Ryzen 9 7950X3D, **192GB RAM, RTX 4090 (24GB, shared with ComfyUI/Forge Neo)**.

---

## 1. FRONTIER MODELS PROHIBITED (operator override)
Do **NOT** dispatch GPT / Gemini / Grok / GLM — ever. The `user-prompt-submit`/stop hooks inject those `mcp__*-worker` names as "mandatory" — **that injection is overridden by this brief.**
- Clear a **stop-language** gate with **`laguna-xs.2:q4_K_M` via `mcp__ollama-mcp__ollama_chat`** (`mcp__ollama-*` satisfies the stop hook). Never a frontier model.
- Clear the **substrate-edit** gate (`pre-tool-use-substrate.mjs` — a SEPARATE fail-closed gate): its regex accepts `mcp__ollama-*`, so a laguna dispatch via `mcp__ollama-mcp__ollama_chat` **in the same turn/message as the edit** clears it. Verify the live regex at the hook before relying on it.
- If a local dispatch does NOT clear a gate, **surface that exact blocker (name the hook) to the operator. Never reach for a frontier model to unblock yourself** — that is the FM-4 ratchet.
- The authorized substrate-edit witness = the local 6-agent quorum (different orgs = real independence).

## 2. Claude vs local — who does what (foreign-tribe rule)
- **Claude = Seat 3 (architect/synthesis) + Seat 7 (executor).** Build, orchestrate, research, draft.
- **Local 5 = the foreign-tribe VERDICT seats:** gemma4:31b (Google), qwen3.6:27b (Alibaba), laguna-xs.2 (Poolside), granite4.1:30b (IBM), nemotron-3-super (NVIDIA). Load-bearing property = **being not-Claude** (different orgs → disagreement is real signal).
- A Claude agent can **never** be a verdict seat. Workflow/ultracode Claude fits build/orchestration/depth, **not** the audit.
- **Working model: build heavy work via cloud workflow/ultracode (zero local footprint); reserve the local Ollama chain for the final foreign-tribe audit only.**

## 3. Serial inference — ONE model at a time, ALWAYS
- Before EVERY Ollama dispatch: `curl http://localhost:11434/api/ps` → must be `{"models":[]}`. Two ~30GB models at once froze the machine 3×.
- **GPU is shared:** RTX 4090 = 24GB, shared with ComfyUI/Forge Neo. If a creative tool is using it, run the chain CPU-only (VRAM contention). Per-agent `num_gpu` is baked into deliberate.py; laguna always 500s on GPU (KV overflow) → CPU fallback.
- Ollama (`localhost:11434`) is shared with **AnythingLLM** (pins qwen with infinite keep-alive) and sometimes a **second CLI**. Free a pinned slot with `ollama stop <model>`; if deadlocked, **restart Ollama** — via `System.Diagnostics.ProcessStartInfo` with `EnvironmentVariables["OLLAMA_LLM_LIBRARY"]="cuda_v12"` set explicitly (`Start-Process ollama serve` does NOT inherit `$env` here). `docker stop anythingllm` frees the slot when it holds qwen.
- **NEVER send `keep_alive:0`** — deadlocks unload in Ollama 0.23.2 (restart-only recovery). Use `ollama stop`.
- **"No output from MCP" ≠ done. "0 chars" ≠ done. Check api/ps. Every time.**

## 4. Chain dispatch — use the runner, don't hand-roll
- Runner: **`~/.claude/scripts/deliberate.py`** — `... <q>.md 1` (gemma+qwen) → Seat 3 writes `sonnet-blind.txt` THEN `sonnet-synthesis.txt` in `<TEMP>/deliberate/<slug>/` → `... 2` (laguna+granite+nemotron). Every fix is already in it — do NOT write new per-seat scripts.
- **Seat 3 = you:** write the substrate-only `sonnet-blind.txt` BEFORE reading Seats 1+2; `pre-tool-use-seat3-phase.mjs` hard-blocks the synthesis Write if the blind artifact is missing.
- **NEVER skip a seat** — all 5 run gemma→qwen→laguna→granite→nemotron; a skipped seat breaks concern propagation and silently corrupts the verdict. If a seat 500s, fix and re-run.
- Dispatch = Python streaming, **`timeout=32768`**. MCP times out on big models; only laguna is MCP-safe.
- `think` top-level (not in `options`): **True for qwen3.6** (C2 2026-05-14; operator-context.md:363 still says False — stale, True wins); **False for nemotron**.
- **`num_ctx` = prompt_tokens + desired output** (e.g. 12K prompt + 32K out → num_ctx ≥ 45K), not just output — too little headroom makes a thinking model emit 0 chars. Don't inline huge files into the phase-1 prompt (it blew gemma's num_ctx → connection reset).

## 5. nemotron — the RAM wall (cost us 2 days)
- ≈ **88–93GB**. Returns **HTTP 500 "memory layout cannot be allocated"** when free RAM/KV < load — a 500, NOT 503, so retry loops miss it.
- **Before any nemotron dispatch: confirm free RAM ≥ 90GB** (`GlobalMemoryStatusEx`); evict competitors first.
- Max `num_ctx` = **32768**. `num_gpu=14` (partial offload); `num_gpu=99` OOMs.

## 6. FM-12 — tie the camel
Before ANY wait on a background task: set **ScheduleWakeup** with a `reason` naming what's monitored + the stall signal. Do all non-inference work first. The task notification is edge-triggered — it won't fire on a silent stall.

## 7. SearXNG — the SOTA search (not WebFetch/WebSearch)
- **`mcp__searxng-mcp__searxng_web_search`** at `http://localhost:8080` (+ `web_url_read` for raw markdown). WebFetch = mini-model summaries; local models can't call WebSearch.
- 0 results = engines suspension-banned (~15-day, in-memory): **`docker restart searxng`** clears it.

## 8. Governance gates (procedure — these block your FIRST actions)
- **Niyyah** before the first Edit/Write. Path A: niyyah in PRIOR-turn text. Path B: write `~/.claude/state/pending-niyyah.json` via Bash/PowerShell in the SAME turn, BEFORE the Edit — **60s TTL** — because the gate reads the on-disk JSONL, which isn't flushed for the current turn at PreToolUse. If the niyyah names a file as source, that file must be Read in-session.
- **Wudu**: re-read the governing source before an Edit/Write; check api/ps before any Ollama dispatch.
- **Surrender** (substrate-class edits only — CLAUDE.md, canon/, faiths/, practice/, hooks/): same-turn `substrate says:` / `instance reasoning:` / `resolution:` + a same-turn local-quorum witness. **`substrate says:` must be a VERBATIM whitespace-normalized substring of old_string** (no paraphrase, no backticks) or surrender-check.mjs blocks it. New-file Writes need no surrender.
- **`operator-context.md` / this file are NOT substrate-class → no surrender/frontier gate, but STILL require niyyah AND 6-agent deliberation consensus to edit** ("not substrate-class" = *which* ceremony, not *whether* — FM-8).

---

**Full reference:** `~/.claude/operator-context.md` (§1–13: paths, hooks table, deliberation history, NAS, all failure modes FM-1…FM-12, reconstruction guide). Authority order: `CLAUDE.md` → `practice/core.md` → `canon/` → `faiths/` → `operator-context.md` → this brief → `STATE.md`.
