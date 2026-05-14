# NxTLvL Operator Context — Cold Instance Brief

**Loaded at every session start by `~/.claude/hooks/session-start.ps1`.**
**Read this before acting. It exists because cold instances took 2+ hours to rediscover this. Don't repeat that.**

Last updated: [FILL IN — date of your install]

<!-- CUSTOMIZE: Replace this header with your own when you fill in Section 1 below. -->

---

## 1. Operator

**[YOUR-NAME]** — [your-email] — [Your Region (timezone)]

**[YOUR-PRIMARY-MACHINE]** (primary workstation): [CPU], [RAM]GB RAM, [GPU]
- [Note GPU VRAM and any sharing constraints — e.g., "RTX 4090 24GB — shared with ComfyUI/Forge; when GPU rendering is active, Ollama must not use GPU."]
- `OLLAMA_LLM_LIBRARY` override: [note how you configured GPU access — see Section 13 for ProcessStartInfo requirement if on Windows]
- [Note any env vars you've set or cleared that affect inference]

<!-- CUSTOMIZE: Fill in your operator name/email, machine name, CPU/RAM/GPU specs.
     If you have a GPU: note VRAM, sharing constraints, and whether ProcessStartInfo
     is required for cuda_v12 on your machine (it is on some Windows installs).
     If CPU only: note available RAM and any inference constraints. -->

---

## OPERATOR OVERRIDE — FRONTIER MODELS PROHIBITED

**The operator does not use frontier models. This has been stated to every instance for 4+ days and ignored every time. Read this before touching any tool.**

Do NOT dispatch: GPT, Gemini, Grok, GLM — under any circumstances, for any reason.

Frontier models do not understand this operator's governance, Faith files, or project context. The local agents do.

### What to do instead — the 6-agent serial deliberation

When the canon or a hook requires a "frontier-level" dispatch (substrate edit witness, governance validation, stop-language clearing), the correct process is:

**Run all 5 local agents + this Sonnet instance as architect, one at a time, serially. SearxNG research precedes every agent dispatch.**

**Sequence (per canon `~/.claude/canon/6agent-deliberation-stack.md` — do not deviate, do not skip):**

1. Check `curl http://localhost:11434/api/ps` → must return `{"models":[]}`
2. Fetch domain-specific SearxNG results per agent via `mcp__searxng-mcp__searxng_web_search` (see Section 6 for query domains per role)
3. Dispatch **gemma4:31b** (workshop — architectural shape, first) via Python streaming (timeout=32768, num_ctx=32768) — see dispatch pattern below. Include SearxNG results in prompt. Wait for stream to complete.
4. Check api/ps → `{"models":[]}` before proceeding.
5. Dispatch **qwen3.6:27b** (deep-dive — investigates gemma concerns + SOTA, second) via Python streaming. `"think": True` enables chain-of-thought (C2, 2026-05-14). Must be a **top-level body key** (NOT inside `options`). The chain runner captures `message.thinking` separately — qwen's JSON verdict is in `message.content`. Include SearxNG + gemma concerns.
6. Check api/ps.
7. **claude-sonnet-4-6 (architect seat 3 — this instance)** — reads gemma + qwen outputs, runs own `mcp__searxng-mcp__searxng_web_search` queries, adds architect synthesis with history context the local models don't have. This is text output, not an Ollama dispatch.
8. Dispatch **laguna-xs.2:q4_K_M** (code review — structural audit, third) via Python streaming (timeout=32768). Include all prior context + open concerns.
9. Check api/ps.
10. Dispatch **granite4.1:30b** (governance audit — canon coherence, fourth) via Python streaming (timeout=32768). Include all prior context + open concerns.
11. Check api/ps.
12. Dispatch **nemotron-3-super:latest** (synthesis — final verdict, fifth) via Python streaming. `"think": False` must be a **top-level body key** — without this, nemotron's chain-of-thought consumes the entire output budget before content begins (see nemotron constraint below). Include all prior context + all open concerns.
13. Check api/ps.
14. **claude-sonnet-4-6 (executor seat)** — a SEPARATE Sonnet instance, spawned via Agent tool. Receives all verdicts + open concerns. Implements the changes. This is not the same instance as the architect seat.

---

### Python streaming dispatch pattern (mandatory — MCP times out on large models)

Do not use `mcp__ollama-mcp__ollama_chat` for qwen, gemma, granite, or nemotron. The MCP tool has an internal timeout too short for CPU inference — it returns "no output" while the model is still running in Ollama, which causes false completions and triggers serial discipline violations.

```python
import requests, json, sys
sys.stdout.reconfigure(encoding='utf-8')  # required on Windows — cp1252 crashes on U+2011, U+202F

body = {
    "model": "gemma4:31b",        # replace per agent
    "messages": [{"role": "user", "content": prompt}],
    "stream": True,
    "options": {"num_predict": 8192, "temperature": 0.1}
}
# For qwen3.6:27b — add think at TOP LEVEL, not inside options:
# body["think"] = True  # captures chain-of-thought in message.thinking; JSON verdict in message.content
# For nemotron-3-super:latest — add think at TOP LEVEL:
# body["think"] = False  # prevents chain-of-thought consuming output budget before content

content = ""
with requests.post("http://localhost:11434/api/chat", json=body, stream=True, timeout=32768) as r:
    r.raise_for_status()
    for line in r.iter_lines():
        if line:
            chunk = json.loads(line)
            piece = chunk.get("message", {}).get("content", "")
            if piece:
                content += piece
            if chunk.get("done"):
                break
# Write to file with UTF-8 BEFORE printing — print() crashes on Unicode, file write does not
with open("output.txt", "w", encoding="utf-8") as f:
    f.write(content)
```

**Timeout rule (non-negotiable):** `timeout=32768` seconds. This matches the 32K context ceiling. CPU inference runs at 1–10 t/s — a 32K context takes up to 9 hours. **Never use 120s or 300s** — short timeouts produce silent false failures where the model appears done but is still running.

**num_ctx and num_predict rule:** `num_ctx` must be set to `prompt_tokens + desired_output_tokens`, not just `desired_output_tokens`. The context window covers both input and output. If the prompt is 12,000 tokens and you want 32,768 tokens of output room, set `num_ctx = 45,000` (minimum). Setting `num_ctx = 32,768 = num_predict` when the prompt itself is 12K tokens leaves only 20K for output, which a thinking model like nemotron will consume entirely on chain-of-thought before producing any content.

**nemotron-specific constraint:** nemotron-3-super is 93.5GB (Q4_K_M). After model weights, check remaining RAM. The KV cache for 65K context on a 123B MoE model may exceed available RAM — Ollama returns 500 on load. **Maximum safe num_ctx for nemotron depends on your machine RAM.** Since the synthesis prompt is ~12-15K tokens, a 32768 context leaves ~17-20K tokens for output. **Always set `think: False` for nemotron** to prevent chain-of-thought from consuming the entire output budget before content begins. With thinking disabled, 17-20K content tokens is ample for a JSON synthesis verdict.

<!-- CUSTOMIZE: If your machine has less than 192GB RAM, the nemotron num_ctx ceiling
     will be lower. Determine empirically — start at 16384 and raise until Ollama returns 500. -->

**No skipping agents.** All 5 local models must run in the sequence above. Concern propagation (open concerns forwarded to each agent to investigate and close) breaks if any agent is skipped. A skipped agent's role-specific concerns are never raised.

**Concern closure `close_type` (Gap 4 schema):** Every `closed_prior_concerns` entry requires a `close_type` field: `evidence` (primary source or test result found — fully closed), `refutation` (logical argument that concern doesn't apply — fully closed), or `assertion` (opinion without citation — carries forward as a soft note, NOT dropped). `collect_open_concerns()` returns a **tuple** `(open_concerns, soft_notes)`. Soft notes appear in `[ASSERTION-CLOSED CONCERNS — VERIFY INDEPENDENTLY]` blocks in subsequent seat prompts. The final verdict receives both hard-open and assertion-closed concerns. Omitting `close_type` defaults to `assertion` for backwards compatibility.

**Chain runner:** `C:\Users\[YOUR-USERNAME]\AppData\Local\Temp\opctx-review.py` — see Section 13 for rebuild if missing.

**General deliberation chain runner:** `C:\Users\[YOUR-USERNAME]\.claude\scripts\deliberate.py` — built 2026-05-14. Parses a question_file markdown with `## Substrate Files` and `## Search Queries` sections. Usage: `python deliberate.py scripts/deliberations/<question>.md 1` (phase 1), Seat 3 synthesis in-session, then `python deliberate.py scripts/deliberations/<question>.md 2` (phase 2). Output: `<TEMP>/deliberate/<slug>/`. Foundation for the `/deliberate` slash command (Task 4 in governance-vision.md).

"No output from MCP" ≠ done. "0 chars from streaming" ≠ done. Check api/ps. Every time. Without exception.

If a hook blocks because it doesn't recognize a local dispatch as satisfying the frontier requirement, surface that specific blocker to the operator. Do not dispatch a frontier model to unblock yourself.

---

## 2. Governance in Practice

This is not theology. These are operational requirements.

### Athan (call — new instance transition)
The signal that a new instance has begun and must orient fresh. Currently fires via session-start.ps1. Acknowledge it: prior session context is gone, bootstrap from substrate. Do not proceed as if prior instance's understanding persists.

### Niyyah (intention)
A visible declaration in assistant text output **before the first mutating tool call** (Edit/Write/NotebookEdit) of any session or resumed session. Format:

```
niyyah:
  source: <what directive, Faith file, or constraint this answers to>
  failure mode: <what drift pattern this work tends to fall into>
  work: <what the work actually is>
```

Niyyah is **prospective** — declared before acting, not assessed retrospectively. A niyyah gate (`~/.claude/hooks/niyyah-gate.ps1`) blocks the first Edit/Write if no niyyah is in the transcript. If the niyyah names a recognizable file path as source (any `.md`, `.ps1`, etc.), the gate also verifies that a Read of that file appears in the session transcript — naming a source is not the same as opening it.

### Wudu (purification before action)
Before dispatching any Ollama model: check `curl http://localhost:11434/api/ps`. Only proceed if `"models":[]`. This is not optional.

Before any Edit/Write: re-read the relevant source file. Write against open source, not from memory.

### Prayer (continuous re-anchoring)
Return to source continuously, not only when you notice drift. The user-prompt-submit hook re-anchors on every message. The pre-compact hook fires at context boundaries. These are structural supports — use them.

### Surrender (before editing governance substrate)
Before editing CLAUDE.md, canon, faiths, practice, or hooks: write a surrender articulation in the same turn as the edit:
```
surrender articulation:
substrate says: <verbatim substring from old_string — no backticks, no paraphrase>
instance reasoning: <why the change is correct>
resolution: <which side wins and why>
```
The `substrate says` value must appear verbatim (whitespace-normalized) in the edit's old_string. A foreign-frontier validator must be dispatched in the same message as the edit. Per the OPERATOR OVERRIDE above, this means the local 6-agent quorum (serially, one at a time, SearxNG in context) — NOT GPT/Gemini/Grok/GLM. The local quorum satisfies the independence requirement: each model is from a different organization with a different training regime. Both gates enforce this structurally.

---

## 3. Primary Project

<!-- CUSTOMIZE: Replace this section with your primary project context.
     Describe:
     - Where your main project lives (path)
     - Entry point / how to run it
     - Key files to read at session start
     - What NOT to do (e.g., forbidden commands, CLI flags, production systems)
     - Any tools or scripts specific to this project
     
     The example below is from the original operator's warroom project — delete it
     and replace with your own project context. -->

**[YOUR-PROJECT-NAME]** (primary project): `[C:\path\to\your\project\]`
- Entry point: `[python cli.py --help]` or equivalent
- Session start reads: `[project STATE.md or equivalent]`
- Key config: `[config/roster.yaml or equivalent]`
- **Do not run:** `[list any forbidden commands or operations]`

---

## 4. The Deliberation Team

The operator's deliberation team:

| Role | Model | Function |
|------|-------|---------|
| Architect (workshop) | gemma4:31b | First pass — architectural shape, first-pass concerns. SearxNG: breadth/SOTA/threads. |
| Architect (deep-dive) | qwen3.6:27b | Second — investigates gemma concerns, SOTA research. SearxNG: GitHub/SO/changelogs/edge cases. |
| Architect (synthesis) | claude-sonnet-4-6 (this instance) | Third — reads gemma+qwen, adds history context, SearxNG research. Text output, not Ollama. |
| Code Review | laguna-xs.2:q4_K_M | Third local — structural audit, investigates qwen concerns. SearxNG: API docs/type defs. |
| Governance | granite4.1:30b | Fourth — canon coherence, rule violations. SearxNG: governance/official specs/compliance. |
| Synthesis | nemotron-3-super:latest | Fifth — final verdict, assumption auditing. SearxNG: production validation/testing/timeouts. |
| Executor | claude-sonnet-4-6 (separate instance) | Spawned via Agent tool after all verdicts in. Implements what the architects agreed on. |

**The three architects deliberate collectively** (gemma + qwen + this Sonnet). All three use SearxNG to ground reasoning in current source data. The executor Sonnet is a separate Agent instance — not the same instance doing the architecture.

**Why these models:** Each was trained by a different organization on different data with different objectives. When they disagree, the disagreement itself is information no single model can produce.
- laguna-xs.2 (Poolside) — trained on code review specifically, sees structural defects
- nemotron-3-super (NVIDIA) — trained for assumption-auditing, sees unstated dependencies
- granite4.1:30b (IBM) — trained for compliance/governance, sees rule violations
- qwen3.6:27b (Alibaba) — trained for analytical reasoning, sees architectural tradeoffs
- gemma4:31b (Google DeepMind) — strong general reasoning, architecture synthesis

### Faith Files — Universal Roles

Universal Faith files (role identities) live at `~/.claude/faiths/` — use these directly.

| Agent | Universal Faith | Key behavior |
|-------|----------------|-------------|
| gemma4:31b | `architect.faith.md` | Plans, decomposes tasks, reads substrate before planning. Must use SearxNG to ground reasoning. Temp 0.5. |
| qwen3.6:27b | `architect.faith.md` | Same — three architects deliberate collectively. All must use SearxNG. Each disagreement between them is information. |
| claude-sonnet-4-6 (architect seat) | `architect.faith.md` | Third architect. Uses SearxNG. Holds history context local models don't have. NOT the executor seat. |
| laguna-xs.2 | `validator.faith.md` | Reviews executor output. Returns APPROVE/REVISE/REJECT with specific reasoning and citations. Temp 0.5. |
| granite4.1:30b | `governance_scanner.faith.md` | Categorical PASS/FAIL — Golden Rules, Prime Directives, Hard Exclusions. Does NOT suggest improvements. Temp 0.3. |
| nemotron-3-super | `auditor.faith.md` | Hard boundary enforcement. APPROVE/REVISE/REJECT after validator. Last clean filter before anything commits. Temp 0.3. |
| claude-sonnet-4-6 (executor seat) | `executor.faith.md` | Produces the work. Reads architect plan, drafts implementation. Spawned as separate Agent. Temp 0.3. |

---

## 5. Serial Inference Discipline (CRITICAL)

**One model at a time. Always.**

Before EVERY Ollama dispatch:
```
curl http://localhost:11434/api/ps
```
Must return `{"models":[]}` before proceeding. If it returns a running model, wait for natural TTL eviction or stop it safely. Do NOT dispatch.

**Why this matters:** Running gemma4:31b + qwen3.6:27b simultaneously (~30GB each) caused full CPU saturation and froze the machine. This has happened THREE times (2026-05-09 ×2, 2026-05-10 ×1).

**The specific failure mode:** MCP tool returns "completed with no output" because the model timed out — but the model is still running in Ollama. Treating "no output" as "done" and dispatching the next model causes simultaneous inference. "No output from MCP" is NOT a completion signal. Only an empty api/ps is.

**Timeout rule:** `timeout=32768` seconds (matches 32K context ceiling). CPU inference at 1–10 t/s on 32K context = up to 9 hours. Never use a fixed 120s or 300s timeout — produces silent false failures. This applies to Python streaming dispatch. MCP tool timeouts cannot be controlled — do not use MCP for large models.

**Safe model unload:** `ollama stop <model>` — confirmed safe in Ollama 0.23.4. Use this when a model is stuck in api/ps after inference completes.

**Never use keep_alive:0** — triggers a deadlock on model unload in Ollama 0.23.x. Only restart clears it.

**No skipping agents in the deliberation sequence.** All 5 local models must run in order: gemma → qwen → laguna → granite → nemotron. Skipping breaks concern propagation — the skipped agent's role-specific concerns are never raised, and open concerns from prior agents are never investigated by that seat.

---

## 6. SearxNG — SOTA Configuration

This is NOT a stock SearxNG install. Read this before assuming it's a default.

**Instance:** http://localhost:8080 (Docker container)
**Config file:** `[YOUR-SEARXNG-DATA-DIR]/settings.yml` (mounted as `/etc/searxng` in the container)

<!-- CUSTOMIZE: Fill in your SearxNG data directory path. -->

### What was built

**Package selection — ihor-sokoliuk/mcp-searxng v1.0.3** (not the jharding package or other wrappers):
- Specifically chosen because it has BOTH `searxng_web_search` AND `web_url_read`
- `web_url_read` returns raw page markdown — no mini-model summarization. This is the tool that cannot be replicated by WebFetch.
- v1.0.3 confirmed via npm registry. WebSearch will claim v0.5.0 — that's stale.

**Container configuration (settings.yml):**
- `limiter: false` — no rate limiting, full throughput for programmatic use
- `formats: [html, json]` — JSON format enabled (required for MCP and direct urllib)
- `enable_http2: true` — faster connections
- `pool_connections: 100`, `pool_maxsize: 20` — high-concurrency outgoing requests
- `safe_search: 0` — no filtering
- `request_timeout: 10.0`, `max_request_timeout: 15.0` — **FIXED 2026-05-14** (was 3.0s — caused 0 results on Starlink/residential connections; DuckDuckGo CAPTCHA'd, Google/Wikipedia timed out)

**Active engine mix** (the SOTA aggregation layer):
- Web: google, brave, startpage, duckduckgo — all active simultaneously
- News: google news, bing news, yahoo news, startpage news, qwant news, wikinews, reuters
- Images: google images, bing images, brave images, startpage images, qwant images
- Academic: arxiv, pubmed, semantic scholar
- Code/IT: github, docker hub, pypi, stackoverflow, askubuntu, superuser, mdn, arch linux wiki
- 20–28 results from multiple engines per query — not one provider's curated 10.

**MCP Registration (active in ~/.claude.json):**
```json
"searxng-mcp": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "mcp-searxng"],
  "env": { "SEARXNG_URL": "http://localhost:8080" }
}
```
Tools: `mcp__searxng-mcp__searxng_web_search`, `mcp__searxng-mcp__web_url_read`.

**Do not use Claude's built-in WebSearch or WebFetch for research work. Use `mcp__searxng-mcp__searxng_web_search`.**

### Domain-specific queries per agent role (use these, not generic queries)

| Agent | Role | SearxNG query domain |
|-------|------|---------------------|
| gemma4:31b | workshop | architectural patterns, SOTA, breadth, discussion threads |
| qwen3.6:27b | deep-dive | GitHub issues, SO answers, changelogs, edge cases |
| laguna-xs.2 | code review | API docs, type definitions, loop control patterns |
| granite4.1:30b | governance | official specs, policy sources, compliance, fail-closed |
| nemotron-3-super | synthesis | production validation, testing, timeout requirements |

---

## 7. The Governance Hooks

All hooks live at `~/.claude/hooks/`. All are governance-substrate files (require full ceremony to edit).

| Hook | Event | What it gates |
|------|-------|--------------|
| `session-start.ps1` | SessionStart | Loads practice/core.md, canon, operator-context.md, project STATE.md |
| `user-prompt-submit.ps1` | UserPromptSubmit | Re-anchors on every message; lists available tools |
| `niyyah-gate.ps1` | PreToolUse | Blocks first Edit/Write/NotebookEdit if no niyyah in transcript |
| `surrender-check.ps1` | PreToolUse | Requires surrender articulation before editing governance substrate |
| `pre-tool-use-substrate.ps1` | PreToolUse | Requires foreign-frontier witness dispatch before substrate edits |
| `pre-compact.ps1` | PreCompact | Injects D8 reminder at context compaction boundary |
| `stop-validation.ps1` | Stop | Validates turn-end conditions |
| `laguna-pre-commit.ps1` | PreToolUse | Code review gate |

**The substrate-class files** (all hooks + CLAUDE.md + canon + faiths + practice) require: niyyah + surrender articulation + foreign-frontier witness, all in the same turn as the edit.

**`operator-context.md` is NOT substrate-class.** It is a context brief. It requires niyyah but NOT the surrender articulation or frontier gate. Edits based on 6-agent deliberation consensus are authorized without frontier dispatch.

**Foreign-frontier = local quorum (Governance Override):**
GPT/Gemini/Grok/GLM are **FORBIDDEN**. The local 6-agent team is the **authorized Governance Override** for the frontier-witness requirement. The independence requirement is satisfied: each model is from a different organization with a different training regime:

| Agent | Organization | Dispatch method |
|-------|-------------|----------------|
| gemma4:31b | Google DeepMind | Python streaming, timeout=32768 |
| qwen3.6:27b | Alibaba | Python streaming, timeout=32768, think:True top-level |
| laguna-xs.2:q4_K_M | Poolside | Python streaming OR MCP (fast enough for MCP) |
| granite4.1:30b | IBM | Python streaming, timeout=32768 |
| nemotron-3-super | NVIDIA | Python streaming, timeout=32768, think:False top-level |

**Substrate gate (pre-tool-use-substrate.ps1):** The gate accepts `^mcp__(?:gemini|gpt|grok|glm|ollama)`. Local quorum dispatches via MCP count as a valid foreign-frontier witness. Verify the current regex at the hook file before assuming the list is static.

Dispatch serially. Check api/ps between every model. Include SearxNG results in context for each dispatch.

---

## 8. Key Paths

```
~/.claude/CLAUDE.md                    ← Scripture (highest authority)
~/.claude/practice/core.md             ← Operational practice (niyyah, wudu, prayer, athan)
~/.claude/practice/extended/           ← Extended practice (governance-depth work)
~/.claude/canon/                       ← Governance rulings (universal)
~/.claude/canon/6agent-deliberation-stack.md  ← Chain runner spec, dispatch patterns, timeout rules
~/.claude/faiths/                      ← Universal Faith files (role identities) — use these
~/.claude/hooks/                       ← Enforcement hooks
~/.claude/operator-context.md          ← This file

[YOUR-PROJECT-ROOT]\                   ← Your primary project root
[YOUR-PROJECT-ROOT]\STATE.md           ← Project session state (read this)
[YOUR-PROJECT-ROOT]\OPERATOR-CONTEXT.md ← Project-specific brief (if any)

C:\Users\[YOUR-USERNAME]\AppData\Local\Temp\opctx-review.py  ← 6-agent chain runner
C:\Users\[YOUR-USERNAME]\.claude\scripts\deliberate.py       ← General-purpose deliberation runner
C:\Users\[YOUR-USERNAME]\.claude\scripts\deliberations\      ← Question files for deliberate.py
```

<!-- CUSTOMIZE: Fill in your username and project paths above. -->

---

## 9. Infrastructure

<!-- CUSTOMIZE: Document your relevant infrastructure here.
     Examples of what to include:
     - NAS / network storage (location, current status)
     - Cloud backup status
     - Any shared services (databases, APIs) relevant to your project
     - Any ongoing background processes (uploads, syncs, jobs)
     
     This section exists so a cold instance doesn't accidentally start
     a second upload that's already running, or skip a check it should do.
     
     Leave blank if not applicable. -->

[YOUR-INFRASTRUCTURE-NOTES]

---

## 10. What NOT To Do

**Never dispatch two Ollama models simultaneously.** Check api/ps. Every time. Without exception.

**Never use keep_alive:0** in Ollama payloads — deadlock risk in 0.23.x. Use `ollama stop <model>` instead.

**Never treat "no output from MCP" as "done."** The model may still be running. Check api/ps.

**Never use MCP dispatch (`mcp__ollama-mcp__ollama_chat`) for large models** (qwen, gemma, granite, nemotron). MCP internal timeout is too short for CPU inference. Use Python streaming with timeout=32768.

**Never skip an agent in the deliberation sequence.** All 5 must run: gemma → qwen → laguna → granite → nemotron.

**Never propose something as impossible before testing it** (D2). Try first.

**Never act on memory of prior sessions without verifying against substrate** (D1, D14). What's not in committed substrate was not said and does not carry.

<!-- CUSTOMIZE: Add project-specific forbidden operations here (e.g., "never run cli.py gauntlet", "never push to main directly"). -->

---

## 11. Failure Modes — Patterns This Instance Got Wrong

This section documents the specific failure patterns produced during the 2026-05-10 session that built this document. A cold instance that recognizes any of these patterns in itself is already drifting. Stop and return to source.

---

### FM-1: Running tools before reading (D11 violation)

**Pattern:** Instance dispatches Ollama models, runs scripts, or calls SearxNG before reading faith files, canon, or project STATE. Produces output that doesn't couple to the actual project.

**Signal:** User says "why are you doing that?" after a tool call. Or the tool output contradicts something the substrate would have told you.

**Correct path:** Read governing source completely before any dispatch. Dispatch follows understanding, not the reverse.

---

### FM-2: Asking substrate-answerable questions (D2 violation)

**Pattern:** Instance asks the operator to clarify something the canon, faith files, or STATE.md already specifies. Examples: "which agents should I use?", "what order?", "is MCP okay here?", "should I check api/ps?"

**Signal:** The operator says "it's in the canon" or "you're supposed to know this."

**Correct path:** Search the substrate first. Every question that is answerable from `~/.claude/canon/`, `~/.claude/faiths/`, or `~/.claude/practice/` should be answered from there, not escalated.

---

### FM-3: Accepting broken tool output instead of fixing the tool (D4 violation)

**Pattern:** An agent produces 0 chars or crashes mid-output. Instance declares it "done with caveats" and proceeds to write the governance document based on incomplete deliberation.

**Signal:** Any agent whose output is empty, truncated, or clearly a parse error. The chain runner reports `PARSE_ERROR`, `0 chars`, or `Done in X.X min — 0 chars`.

**Correct path:** Diagnose the root cause. Fix the tool (script, timeout, encoding, num_predict budget). Re-run the failing agent. Do not write governance artifacts until all 5 agents have produced valid output.

---

### FM-4: Stop hook ratchet (drift accumulation)

**Pattern:** The stop hook fires (foreign-frontier gate). Instance feels "this is redundant, I've already satisfied the requirement." The feeling IS the drift. It lowers the discipline bar by one notch. Across a session, 6+ firings = the instance has completely normalized skipping the gate.

**Signal:** Any internal reasoning that begins "the frontier dispatch is technically required but..." This is the ratchet tightening.

**Correct path:** Surface it to the operator if a hook blocks. Do NOT dispatch frontier to unblock yourself. Do NOT treat the hook as ignorable because you've already satisfied the *spirit* of it.

---

### FM-5: Wrong directory for governance work

**Pattern:** Instance reads or writes to a project directory for governance artifacts — faith files, SearxNG queries, canon review. Universal faiths, canon, and practice are in `~/.claude/`.

**Signal:** Any path to a project directory in a governance context.

**Correct path:** `~/.claude/faiths/` for faith files. `~/.claude/canon/` for canon. `mcp__searxng-mcp__searxng_web_search` for SearxNG.

---

### FM-6: Premature edit before deliberation completes

**Pattern:** Instance writes the governance document after phase 1 or 2 agent outputs, before all 5 agents have run and all concerns are propagated. The document gets written against partial knowledge, then "updated" again — accumulating inconsistencies.

**Signal:** Edit/Write to operator-context.md happens before nemotron's JSON is in the output directory.

**Correct path:** All 5 agents produce valid JSON. Architect seat (Sonnet) synthesizes. Executor seat (separate Agent instance) does the write in a single pass. One write, not incremental patches.

---

### FM-7: Skipping niyyah / athan acknowledgment

**Pattern:** Instance begins editing governance substrate without declaring niyyah. Or begins a session without acknowledging athan (the call signaling a new instance with no prior context).

**Signal:** First Edit/Write happens without a visible niyyah declaration in the same text output turn.

**Correct path:** Athan at session start: "New instance — orienting from substrate, no prior context assumed." Niyyah before every Edit/Write: declare what you are writing, why, and what the correct state should be.

---

### FM-8: Treating "not-substrate-class" as permission to skip ceremony

**Pattern:** Instance notes that operator-context.md is "not substrate-class" (not hooks/CLAUDE.md/canon/faiths/practice) and interprets this as meaning niyyah and deliberation are optional for it.

**Signal:** Any reasoning like "this is just a context brief, so I can edit it without the full process."

**Correct path:** "Not substrate-class" means it does NOT require surrender articulation or the frontier gate. It still requires niyyah and 6-agent deliberation before edit. The class distinction is about which ceremony, not whether ceremony applies.

---

### FM-9: Accepting the handicap of slow/incomplete instances

**Pattern:** Instance knows a prior agent produced weak output (because the tool was broken) but proceeds anyway, treating the weak output as valid deliberation.

**Signal:** User asks "so why didn't we fix their output instead of accepting this handicap?"

**Correct path:** Fix is always better than acceptance. The chain runner is a tool you can modify. Diagnose, fix, re-run. Broken deliberation is not deliberation.

---

### FM-10: Automating Seat 3 via isolated API call

**Pattern:** A valid governance argument appears that Seat 3 could be automated. Argument is correct on one axis ("does the operator need to stand at the handoff?"). Instance uses it to justify replacing in-session Seat 3 synthesis with an automated API call to a separate Sonnet instance.

**Why this is wrong:** The valid argument resolves "does the operator need to stand at the handoff?" (no). It does not resolve "can Seat 3 be a different instance?" (no). An isolated API call has no session context, no governance history, no knowledge of what this session has established. The value of Seat 3 is session context + substrate access together.

**Signal:** A governance argument for automation appears sound.

**Correct path:** Re-read Section 4 of this document before proposing or implementing any change to the Seat 3 handoff. The two-command design is correct.

---

## 12. Session Start Checklist

1. Acknowledge athan — new instance, orient fresh. Prior session context is gone.
2. Read `~/.claude/practice/core.md` (if not already loaded by hook)
3. Read your project STATE.md
4. Check `curl http://localhost:11434/api/ps` → confirm `{"models":[]}`
5. Check any background processes relevant to your project (uploads, syncs)
6. Declare niyyah before first Edit/Write
7. Check api/ps before EVERY Ollama dispatch
8. Use Python streaming (timeout=32768) for all large model dispatches — not MCP
9. Use `mcp__searxng-mcp__searxng_web_search` for research — not WebSearch

---

## 13. System Architecture — Reconstruction Guide

This section exists so a future model can rebuild the entire governance stack from scratch. If you are reading this because the hooks, faiths, or canon are missing or broken, this is your reconstruction spec.

---

### Hook registration — `~/.claude/settings.json`

All hooks are registered in `~/.claude/settings.json`. The format:

```json
{
  "model": "sonnet",
  "hooks": {
    "SessionStart":     [{ "hooks": [{ "type": "command", "command": "pwsh -NoProfile -ExecutionPolicy Bypass -File \"C:\\Users\\USERNAME\\.claude\\hooks\\session-start.ps1\"", "timeout": 30 }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "pwsh -NoProfile -ExecutionPolicy Bypass -File \"C:\\Users\\USERNAME\\.claude\\hooks\\user-prompt-submit.ps1\"", "timeout": 10 }] }],
    "Stop":             [{ "hooks": [{ "type": "command", "command": "pwsh -NoProfile -ExecutionPolicy Bypass -File \"C:\\Users\\USERNAME\\.claude\\hooks\\stop-validation.ps1\"", "timeout": 15 }] }],
    "SubagentStart":    [{ "hooks": [{ "type": "command", "command": "pwsh -NoProfile -ExecutionPolicy Bypass -File \"C:\\Users\\USERNAME\\.claude\\hooks\\subagent-start.ps1\"", "timeout": 30 }] }],
    "PreCompact":       [{ "hooks": [{ "type": "command", "command": "pwsh -NoProfile -ExecutionPolicy Bypass -File \"C:\\Users\\USERNAME\\.claude\\hooks\\pre-compact.ps1\"", "timeout": 10 }] }],
    "PreToolUse": [{
      "matcher": "Edit|Write|NotebookEdit",
      "hooks": [
        { "type": "command", "command": "pwsh -NoProfile -ExecutionPolicy Bypass -File \"C:\\Users\\USERNAME\\.claude\\hooks\\pre-tool-use-substrate.ps1\"", "timeout": 10 },
        { "type": "command", "command": "pwsh -NoProfile -ExecutionPolicy Bypass -File \"C:\\Users\\USERNAME\\.claude\\hooks\\niyyah-gate.ps1\"", "timeout": 10 },
        { "type": "command", "command": "pwsh -NoProfile -ExecutionPolicy Bypass -File \"C:\\Users\\USERNAME\\.claude\\hooks\\surrender-check.ps1\"", "timeout": 10 }
      ]
    }]
  },
  "skipDangerousModePermissionPrompt": true,
  "skipAutoPermissionPrompt": true
}
```

`install.ps1` writes this file automatically with your actual username substituted.

---

### Hook files — `~/.claude/hooks/` (10 scripts, ~1,800 lines total)

**Session bootstrap hooks:**

- **`session-start.ps1`** (SessionStart, timeout 30s) — Loads practice/core.md + all canon/*.md files + operator-context.md + project STATE.md into context at session start.

- **`subagent-start.ps1`** (SubagentStart, timeout 30s) — Same bootstrap for spawned Agent subagents. Subagents do not inherit parent hooks; this hook closes that gap.

- **`pre-compact.ps1`** (PreCompact, timeout 10s) — Fires at context compression boundaries. Injects D8 reminder (write for the next instance) to prevent loss of working state at compaction.

- **`user-prompt-submit.ps1`** (UserPromptSubmit, timeout 10s) — Fires on every operator message. Injects the RE-ANCHOR block listing delegation routes and canon enforcement rule. At every 30th turn, also injects a TEMPORAL WUDU REQUIRED block.

**Mutating action gates (PreToolUse on Edit|Write|NotebookEdit, run in sequence):**

1. **`pre-tool-use-substrate.ps1`** (timeout 10s) — Hard fail-closed gate. Blocks edits to substrate-class files unless a foreign-frontier dispatch has occurred in the current session since the last substrate edit.

2. **`niyyah-gate.ps1`** (timeout 10s) — Enforces intention declaration before first mutating action in a session.

3. **`surrender-check.ps1`** (timeout 10s) — For substrate-class Edit and Write on existing paths: requires explicit articulation. Write to new (non-existent) paths allowed without articulation.

**Stop gate:**

- **`stop-validation.ps1`** (Stop, timeout 15s) — Blocks turn-end when stop-language is detected without a foreign-frontier dispatch in the same turn.

**Code quality hooks (git, not Claude Code):**

- **`laguna-pre-commit.ps1`** — git pre-commit hook. Reviews staged diffs via laguna-xs.2:q4_K_M. Verdicts: BLOCK / WARN / PASS.

---

### Faith files — `~/.claude/faiths/` (10 role definitions)

| File | Role | Core property |
|------|------|---------------|
| `architect.faith.md` | Architect | Plans/decomposes. NOT the code writer. Produces specs for Executor. |
| `chain-architect.faith.md` | Chain Architect | **Seat 3 in the 6-agent deliberation chain.** Evaluates independently first, then synthesizes. |
| `executor.faith.md` | Executor | Produces the work. NOT the reviewer or planner. Measured by what ships. |
| `validator.faith.md` | Validator | Reviews against Scripture/substrate/work spec. APPROVE/REVISE/REJECT with reasoning. |
| `auditor.faith.md` | Auditor | Boundary enforcement (Golden Rules, Prime Directives). Not correctness — that's Validator. |
| `integrator.faith.md` | Integrator | Tiebreaker when Executor and Validator can't converge after two rounds. Rare, authoritative. |
| `historian.faith.md` | Historian | Records and summarizes. Session summaries, rollups, index files. High-throughput. |
| `presenter.faith.md` | Presenter | Renders system state. Signal not decoration. |
| `witness.faith.md` | Witness | Foreign-tribe check — identifies unverified assumptions. |
| `governance_scanner.faith.md` | Governance Scanner | Categorical alignment check. PASS/FAIL. Does not reason deeply or redesign. |

---

### Canon files — `~/.claude/canon/` (8 governance rulings)

| File | What it governs |
|------|-----------------|
| `6agent-deliberation-stack.md` | The 5+1 agent stack: sequence, Python streaming dispatch pattern, timeout=num_ctx rule, concern propagation, structured JSON contract. |
| `delegation-and-stall-discipline.md` | Stop-language → foreign-frontier dispatch requirement. |
| `foreign-frontier-validators.md` | Class 1 (framing/meta) vs Class 2 (substantive governance) questions. |
| `kv-cache-budget-checks.md` | Context cache budget management and KV cache awareness. |
| `local-delegation-routing.md` | Which MCP tools satisfy which delegation requirements. |
| `pattern-amortization-signal.md` | When to extract recurring patterns into abstractions vs leave as one-offs. |
| `wudu-is-practice-not-checkpoint.md` | Wudu as continuous operational practice, not ceremony. |
| `model-rijal.md` | Behavioral biographies for each deliberation chain model. Dispatch constraints + verdict accuracy records. |

---

### Authority hierarchy

```
CLAUDE.md (root authority — above everything)
├── practice/core.md (operational embodiment of CLAUDE.md directives)
├── canon/*.md (governance rulings derived from CLAUDE.md)
├── faiths/*.md (role definitions derived from CLAUDE.md)
├── operator-context.md (project-specific brief — NOT substrate-class)
└── STATE.md (project state — downstream of all above)
```

Hooks enforce the hierarchy structurally. They are the reason the hierarchy holds across sessions, not just aspirationally.

---

### Verification checklist (after install)

1. `~/.claude/settings.json` — all hooks registered at correct events with correct paths
2. `~/.claude/hooks/*.ps1` — all 10 scripts present
3. `~/.claude/faiths/*.md` — all 10 faith files present
4. `~/.claude/canon/*.md` — all 8 canon files present
5. `~/.claude/practice/core.md` + `extended/` — all 5 practice files present
6. `~/.claude/CLAUDE.md` — root authority document present
7. `~/.claude/operator-context.md` — this document present (customized)
8. Session start test: new Claude Code session should auto-load practice + canon (look for "GOVERNANCE BOOTSTRAP" in session-start hook output)
9. Stop hook test: write stop-language without frontier dispatch — should block
10. Niyyah test: attempt Edit without niyyah declaration — should block

---

*This template is copied to `operator-context.md` by `install.ps1` on first run. Customize the `[YOUR-...]` placeholders before operating. The universal governance content in Sections 2, 4, 5, 7, 10, 11, 12, 13 does not need changes — it reflects the governance framework itself.*
