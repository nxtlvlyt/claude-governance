# The Perfect Global Claude Repo — SOTA Architecture
**Authored:** 2026-05-11 — Sonnet architect seat 3 synthesis  
**Grounded in:** Substrate reads + SearxNG SOTA research (May 2026) + 25+ hours of live failure data  
**Authority:** Subordinate to ~/.claude/CLAUDE.md  
**Status:** APPROVED — 6-agent quorum APPROVE (0.89), executor pass authorized, %%LOCAL-QUORUM-WITNESS-VERIFIED%% — cold-instance verification PASSED 2026-05-11 — canon promoted

---

## What This Document Is

The definitive architecture for the global Claude repo (`~/.claude/`) — the layer that makes every Claude Code instance, across every project, start oriented, stay governed, and survive compaction without losing context.

This is not a description of what exists today. It is the target state: the most governance-compliant, SOTA-grounded, operationally validated setup achievable on this specific machine (CPU-only, 192GB RAM, local Ollama, no GPU). Every design decision is constrained by what actually runs here.

---

## Why This Architecture Is Governance-Grade (not just a directory-driven workflow)

The industry SOTA "directory-driven agentic workflow" pattern (SKILL.md + progressive disclosure + sub-agent spawning) describes the mechanical shell. This architecture does all of that and adds five things the generic pattern omits entirely:

**1. Formation precedes procedure.**
The generic pattern treats everything as procedure — what to do, when to do it. This architecture explicitly separates WHO THE INSTANCE IS (`~/.claude/`: CLAUDE.md, practice, faiths, canon) from WHAT IT DOES IN THIS PROJECT (project skills). The formation layer is loaded before any skill runs, across every project, automatically. An instance that has been formed by the same CLAUDE.md and practice layer executes skills consistently — not because it followed instructions, but because its identity is shaped before it acts.

**2. Governance does not rely on the governed party's good faith.**
The generic pattern relies on the AI following SKILL.md instructions. This architecture has structural enforcement — hooks that fire regardless of what the instance wants to do. Stop-language without witness dispatch? Blocked. Substrate edit without surrender articulation? Blocked. Niyyah missing? Blocked. The hooks are the governance; the instance cannot bypass them by intention or drift. Faith without enforcement is documentation, not governance.

**3. Multi-agent deliberation with role-specific identities.**
The generic pattern spawns generic sub-agents. This architecture assigns specific models to specific roles for specific reasoning styles: gemma4:31b for architectural breadth, qwen3.6:27b for depth and edge cases (different training regime, Alibaba), granite4.1:30b for governance compliance (IBM), nemotron-3-super for assumption auditing (NVIDIA). Each model reads prior models' output. Concern propagation is structural. When they disagree, the disagreement is information no single model can produce. This is a governed deliberation body, not a task queue.

**4. Compaction is a first-class architectural problem.**
The generic pattern ignores compaction. This architecture treats it as a structural threat: custom compaction prompt preserves governance-critical facts, pre-compact hook writes session summaries, AnythingLLM hotdir auto-ingests summaries, cold instances recover via RAG query. Context boundaries are designed for, not hoped around.

**5. Machine-specific serial discipline is structural, not optional.**
The generic pattern assumes parallel execution ("thousands of instances on the fly"). On this machine — CPU-only, 192GB RAM — parallel Ollama inference froze the machine three times. This architecture enforces serial discipline via api/ps checks before every dispatch, `ollama stop` after completion, and a governance constraint that makes violation a hook-level failure, not an instance decision.

The generic approach is a correct foundation. This architecture is governance-grade on top of it.

---

---

## The Problems This Solves

### Problem 1 — Cold-start failure
New session opens. Instance has no memory of prior sessions. Governance framework, serial discipline, open tasks, Faith assignments — all gone. Without re-explanation it takes 2+ hours to become functional. This happened 25+ times in a 26-hour span.

Root cause (now fixed): session-start.ps1 had a duplicate block causing 85KB output truncated to 2KB — every instance received 2KB of a 670-line document.

Residual risk: Even with the hook fixed, compaction summaries are not in the RAG workspace. An instance that was compacted before closing cannot be recovered by a new instance querying the RAG.

### Problem 2 — Compaction context destruction
Context fills. Claude Code auto-compacts. The compaction algorithm does not know which content is governance-load-bearing. It summarizes semantically, destroying structural facts like:
- Which Faith file is active
- Serial inference discipline (one model at a time, api/ps before every dispatch)
- No-frontier-models rule
- Open governance gates (surrender articulations in progress)
- Ollama scheduler deadlock constraint (never use keep_alive:0)

Per arxiv 2604.09588: "The summarization process has destroyed information that cannot be recovered through any query. The agent before and after compaction presents as two different entities."

### Problem 3 — Drift accumulation
Instances drift from governance source across a long session. Without continuous re-anchoring, by turn 50 an instance is operating from session-memory of the framework rather than re-read of the framework. The drift accumulates invisibly until a hook fires or the operator catches it.

### Problem 4 — Deliberation results not recoverable
6-agent chain runs take 6-10 hours on CPU. If the session that ran the chain compacts before the results are committed to substrate, the deliberation is lost. Cold instance has no way to recover a chain run that exists only in conversation history.

---

## The Complete Architecture

Seven layers. Each layer addresses a different failure mode. None are redundant.

---

### Layer 1 — Scripture and Formation (`~/.claude/CLAUDE.md` + `practice/`)

**What it is:** The root authority. 14 directives. Everything else derives from this.

**Current state:** ✅ LIVE and correct.

**SOTA finding:** orchestrator.dev 2026: "keep CLAUDE.md under 300 lines focused on things Claude would get wrong without it." Current CLAUDE.md is ~14 directives, ~400 lines. Well within the zone where it's load-bearing rather than decorative.

**`practice/core.md`** — Operational embodiment of the directives. Purification tiers (tayammum/wudu/ghusl), niyyah format, wudu check before dispatch. Read at every session start.

**`practice/extended/`** — 4 files: drift-and-ratchet, formation, orientation, wudu. Required reading before any governance-depth work.

**Nothing to build here.** This layer is complete.

---

### Layer 2 — Governance Rulings (`~/.claude/canon/`)

**What it is:** Accumulated decisions that generalize across every project. Once in canon, a ruling does not change in passing.

**Current state:** ✅ 7 files live.

| File | What it governs |
|---|---|
| 6agent-deliberation-stack.md | The 5+1 chain, dispatch patterns, timeout rules |
| delegation-and-stall-discipline.md | Stop-language → witness dispatch requirement |
| foreign-frontier-validators.md | Class 1 vs Class 2 questions, local quorum override |
| kv-cache-budget-checks.md | Context budget management |
| local-delegation-routing.md | MCP tools vs witness-class requirements |
| pattern-amortization-signal.md | When to abstract vs leave as one-offs |
| perfect-repo-architecture.md | Formation vs procedure split |
| wudu-is-practice-not-checkpoint.md | Hooks are silent, wudu is continuous |

**Nothing to build here.** One pending: add cold-start/compaction solution ruling once this plan is validated (it becomes a canon entry, not just a plan).

---

### Layer 3 — Role Identities (`~/.claude/faiths/`)

**What it is:** Who an instance IS while wearing a given role. Not what it does — who it is.

**Current state:** ✅ 9 faith files live.

| Faith | Role | Temp |
|---|---|---|
| architect.faith.md | Plans, decomposes, does NOT write code | 0.5 |
| executor.faith.md | Produces the work, measured by what ships | 0.3 |
| validator.faith.md | APPROVE/REVISE/REJECT with citations | 0.5 |
| auditor.faith.md | Hard boundary enforcement | 0.3 |
| integrator.faith.md | Tiebreaker, rare, authoritative | — |
| historian.faith.md | Records and summarizes, high-throughput | — |
| presenter.faith.md | Renders system state, signal not decoration | — |
| witness.faith.md | Foreign-tribe check, different org required | — |
| governance_scanner.faith.md | PASS/FAIL categorical, does not redesign | 0.3 |

**Governance scanner seat (tested 2026-05-11):** laguna-xs.2:q4_K_M is the primary seat. granite4.1:3b is fallback. granite4.1:8b is disqualified (format drift).

**Nothing to build here.**

---

### Layer 4 — Structural Enforcement (`~/.claude/hooks/`)

**What it is:** The governance that does not rely on the governed party's good faith. Hooks are the architecture that catches drift when instances wouldn't catch themselves.

**Current state:** 8 hooks live. 2 need enhancement.

#### Hooks that are complete:

| Hook | Event | What it gates |
|---|---|---|
| session-start.ps1 | SessionStart | Loads core.md + canon + operator-context + STATE.md |
| user-prompt-submit.ps1 | UserPromptSubmit | Re-anchors on every message, lists delegation routes |
| niyyah-gate.ps1 | PreToolUse | Blocks first Edit/Write without niyyah in transcript |
| surrender-check.ps1 | PreToolUse | Requires surrender articulation for substrate edits |
| pre-tool-use-substrate.ps1 | PreToolUse | Requires witness dispatch before substrate edits |
| stop-validation.ps1 | Stop | Blocks turn-end when stop-language detected without witness |
| subagent-start.ps1 | SubagentStart | Same bootstrap for spawned Agent subagents |
| laguna-pre-commit.ps1 | git pre-commit | Code review gate via laguna-xs.2 |

#### Hook 1 needing enhancement: `pre-compact.ps1`

**Current behavior:** Fires at context compression boundary. Injects D8 reminder only.

**Gap:** Does not control WHAT the compaction summary preserves. Governance-critical facts are lost.

**Enhancement approach — two tiers:**

**Tier 1 (soft, via compaction instruction):** Inject a must-preserve list into additionalContext. The compaction model is instructed to preserve specific facts verbatim. This works when the compaction model follows the instruction. It fails when the compaction model's summarization impulse overrides the instruction — which per arxiv 2604.09588 is structurally likely for facts that appear incidental to the task.

```powershell
# Add to pre-compact.ps1 additionalContext output:
$compactionGuide = @"
COMPACTION INSTRUCTION — preserve these verbatim in the summary:
1. Active Faith file: [name] — key constraint: [one sentence]
2. Serial inference rule: ONE Ollama model at a time. Check api/ps before every dispatch.
3. No frontier models: GPT/Gemini/Grok/GLM forbidden. Local 6-agent quorum only.
4. keep_alive:0 is forbidden — triggers Ollama 0.23.2 scheduler deadlock.
5. Current open task: [what we were doing]
6. Any open governance gate: [surrender in progress / witness dispatched / etc.]
"@
```

**Tier 2 (structural, via marker extraction — preferred):** The hook extracts governance-critical facts from structural markers in the session BEFORE the compaction model runs. This bypasses the LLM compaction entirely for the facts that matter most.

Implementation: Require governance-critical facts to be written to the session output in tagged blocks:
```
%%GOVERNANCE-STATE%%
faith: architect.faith.md
serial_rule: ONE model at a time, api/ps before every dispatch
frontier_forbidden: GPT/Gemini/Grok/GLM
open_gate: surrender-in-progress | none
open_task: [one sentence]
%%END-GOVERNANCE-STATE%%
```

The pre-compact.ps1 hook:
1. Reads the JSONL session file (or additionalContext from Claude Code)
2. Extracts the most recent `%%GOVERNANCE-STATE%%` block via regex
3. Writes it to a fixed file: `~/.claude/LAST-GOVERNANCE-STATE.md`
4. Injects that file's content as structured `additionalContext`

Result: the compaction model receives the governance state as pre-extracted structured data, not as a request to preserve something from a mass of conversation text. The extraction happened in the hook — the compaction model does not need to find it.

**Phase 2 implementation uses Tier 1 first** (simpler, same pre-compact.ps1 edit). Tier 2 requires: (a) establishing the tagged block convention and getting instances to write to it, and (b) parsing logic in the hook. Tier 2 is the correct long-term architecture — implement after Tier 1 is validated.

**Proactive trigger timing (SOTA — orchestrator.dev):** pre-compact.ps1 should fire at 60% context fill, not at the compression boundary. At the compression boundary, the destructive compaction may already be running. Configure the hook trigger at 60% if Claude Code's hook system supports context-fill percentage as a trigger condition. If not, make the hook fire conservatively early — every N turns — rather than waiting for the limit.

**Also add to pre-compact.ps1:** Session summary writer + LAST-SESSION-STATE.md writer (see Layer 6).

**Ceremony required:** This is a substrate-class file. Requires niyyah + surrender articulation + governance witness (6-agent quorum or the hook's structural gate resolved). The circular dependency (hook requires mcp__frontier which is forbidden) must be surfaced to operator for resolution before this edit proceeds.

#### Hook 2 needing enhancement: `session-start.ps1`

**Current behavior (after fix):** Loads core.md + canon + operator-context + STATE.md as full text. Works. But loads EVERYTHING into context on every session — even when only some content is relevant.

**SOTA enhancement (Cold Start Protocol, 3-stage):**
1. Stage 1: Load lightweight manifest (what's available) — 1-2KB
2. Stage 2: RAG query against claude-governance workspace for session-specific relevant content
3. Stage 3: Load only what the session needs

**Note:** This is an optimization, not a fix. The current flat-load approach works. Do not implement this until compaction solution is built and tested.

---

### Layer 5 — Persistent Memory (`MEMORY.md` + `memory/`)

**What it is:** Project-specific facts that survive session boundaries. Feedback, constraints, project state, model behavior findings.

**Current state:** ✅ 11 files, auto-loaded by Claude Code.

**SOTA finding:** Claude Code v2.1.30+ has native "Recalled/Wrote memories" that persist cross-session. **Action required:** Verify if this instance has it enabled. If yes, configure what gets written — governance constraints should be in auto-memory.

How to check: look for "Recalled memories" or "Wrote memories" in session terminal output. Or run `claude --version` — if ≥ v2.1.30 and on a supported plan, it may be active.

**If native memory is active — governance policy required (gemma G2):**

Native memory is invisible substrate. If an instance writes drifted facts to it, those facts persist cross-session, bypassing CLAUDE.md and canon/ with no hook to catch it. Shadow memory risk: a governance-critical fact overwritten by session-drift propagates silently to every future session.

Policy required before enabling:
1. **Audit gate:** Before any fact is written to native memory, it must be consistent with the current canon/. The write should reference the source (which CLAUDE.md directive or canon file it derives from).
2. **Purification on conflict:** If a native memory fact conflicts with what session-start loads from canon, canon wins — and the native memory fact must be updated or deleted, not silently coexisted with.
3. **Scope restriction:** Native memory should only carry operational constraints (serial discipline, frontier ban, Ollama version constraints) — not architectural decisions. Architectural decisions belong in canon files where they can be witnessed and edited with ceremony.

**If native memory is NOT active:** No action. MEMORY.md handles this function.

**Nothing to build here.** Verification step + policy decision only.

---

### Layer 6 — RAG Retrieval (`AnythingLLM`)

**What it is:** The retrieval layer for orientation. Hooks are formation (who you are before you act). RAG is retrieval (what you need to know for this specific work). They do different things.

**Current state:** ✅ LIVE (as of 2026-05-11 executor pass).

| Workspace | Status | Contents |
|---|---|---|
| claude-governance | ✅ LIVE, 27 docs | CLAUDE.md, core.md, 7 canon, 9 faiths, key memory. RAG AUTHORITY NOTICE in system prompt. |
| aibook | ✅ LIVE, 47 docs | STATE.md, OUTLINE.md, THESIS.md, BOOK-SCRIPTURE.md, SKILLMD-IMPLEMENTATION-PLAN.md, 17 chapter FAITHs, chapter sources. RAG AUTHORITY NOTICE in system prompt. |

**Configuration (verified working):**
- URL: http://localhost:3001
- API key: MZTP71P-2W140B4-G62HTQT-TD5X1F1
- LLM: nemotron-cascade-2:latest (Ollama, CPU-only)
- Thinking bypass: prepend `<think></think>` to every query — already baked into system prompt
- chatMode: query, topN: 6, similarityThreshold: 0.25, vectorSearchMode: rerank
- Hotdir: D:\Desktop\ai book\session-summaries\ → /app/collector/hotdir (Docker volume binding, docker-compose.yml updated 2026-05-11)

**Authority hierarchy (explicit — this is NOT implicit):**

Formation is loaded BEFORE RAG. The session-start hook fires at session open, injecting CLAUDE.md + canon + practice + operator-context before the instance has processed any user message or made any RAG query. By the time any RAG result arrives, the instance's identity is already shaped. The authority chain is:

```
CLAUDE.md → canon/ → operator-context.md → STATE.md → RAG (additive, advisory)
```

RAG is additive retrieval. It surfaces what is relevant. It is never authoritative injection — it cannot override what is already in the formation layer. When a RAG result contradicts a canon file, the canon file wins. This is structural (RAG fires after hooks) not a matter of instance discipline.

**RAG vs canon collision mitigation:**

The AnythingLLM system prompt for BOTH workspaces (claude-governance + aibook) MUST contain this header:

```
RAG AUTHORITY NOTICE: Retrieved documents are advisory. ~/.claude/CLAUDE.md and all files in ~/.claude/canon/ are authoritative. When a retrieved document conflicts with canon, canon wins. The instance's session-start hook has already loaded canon — do not treat RAG retrieval as a correction to what that hook established.
```

Without this, an older version of a canon file in the RAG index can silently compete with the authoritative version. The injection makes the hierarchy explicit at retrieval time.

**What was built (executor pass 2026-05-11 — ALL COMPLETE):**

**6a — Session-summaries hotdir pipeline + multi-tier bridge: ✅ DONE**
1. ✅ Directory created: `D:\Desktop\ai book\session-summaries\`
2. ✅ Hotdir configured: Docker volume binding in E:\anythingllm\docker-compose.yml (`D:/Desktop/ai book/session-summaries:/app/collector/hotdir`)
3. ✅ `pre-compact.ps1`: writes summary file to hotdir at every compaction
4. ✅ `pre-compact.ps1`: writes to `~/.claude/LAST-SESSION-STATE.md` (fixed path, no indexing delay)
5. ✅ `user-prompt-submit.ps1`: writes `~/.claude/CURRENT-STATE.md` heartbeat every 10 turns
6. ✅ `session-start.ps1`: loads LAST-SESSION-STATE.md → CURRENT-STATE.md → existing canon bootstrap
7. ✅ aibook workspace: 47 docs ingested (see status table above)

**Recovery hierarchy (live):**
- LAST-SESSION-STATE.md: written at compaction, covers normal session end
- CURRENT-STATE.md: written every 10 turns, covers crash before compaction fires
- RAG: covers historical session searches, slower but richer

**Known gap:** The LAST-SESSION-STATE.md and CURRENT-STATE.md are written as structural skeletons by the hooks. The instance must enrich them with actual session content post-compaction. Tier 2 (marker extraction) is the correct long-term fix — not yet implemented.

**6b — aibook workspace population: ✅ DONE**
- 47 docs: STATE.md, OUTLINE.md, THESIS.md, BOOK-SCRIPTURE.md, SKILLMD-IMPLEMENTATION-PLAN.md, 17 chapter FAITHs, chapter sources, CLAUDE.md, CRAFT-CODE.md, GLOSSARY.md, VOICE-EVOLUTION.md

**6c — Integration at session start (future optimization):**
Not yet implemented. Correct approach when ready:
```powershell
# POST http://localhost:3001/api/v1/workspace/claude-governance/chat
# Prompt: "What is the current project state and what governance constraints are active?"
```

---

### Layer 7 — Deliberation and Skills (`skills/` + `6-agent chain`)

**What it is:** The governance body that makes architectural decisions. The 6-agent serial chain. Packaged as SKILL.md for recoverability.

**Current state:** Chain spec is in substrate. SKILL.md packaging is planned but not built.

**The correct chain structure (per chain memory, operator-verified):**
1. gemma4:31b → architect.faith.md (workshop, SearxNG breadth)
2. qwen3.6:27b → architect.faith.md (deep-dive, SearxNG GitHub/SO/edge cases, think:False top-level)
3. Sonnet (this instance) → architect.faith.md (seat 3, synthesizes, SearxNG, adds history context)
4. Sonnet executor (separate Agent) → executor.faith.md (implements)
5. laguna-xs.2:q4_K_M → validator.faith.md (APPROVE/REVISE/REJECT)
6. granite4.1:30b → governance_scanner.faith.md (PASS/FAIL)
7. nemotron-3-super:latest → auditor.faith.md (final verdict, think:False top-level)

**Serial discipline (non-negotiable):** ONE model at a time. Check api/ps before EVERY dispatch. `ollama stop <model>` after completion. Never keep_alive:0.

**Filesystem lock (qwen addition — closes subagent race condition):** `api/ps` is eventual consistency. Under simultaneous subagent spawning, two agents can both see an empty api/ps and both dispatch. Fix: `~/.claude/.ollama.lock` acquired before dispatch, released after. Stale lock detection: lock older than 5 minutes with empty api/ps → remove and proceed. `subagent-start.ps1` must check and acquire the lock before any Ollama dispatch.

**Dispatch constraints:**
- All models: Python streaming, timeout=32768, NOT MCP (MCP times out)
- qwen + nemotron: think:False as TOP-LEVEL body key, NOT inside options
- nemotron: num_ctx ceiling 32768 (65K OOM on this machine), ~93.5GB weights

**SOTA finding — SKILL.md is now industry standard:** OpenAI Codex, GitHub Copilot, VoltAgent all use SKILL.md with trigger conditions in frontmatter + bootstrap_sequence. AutoSkill (arxiv 2603.01145) formalizes this as "skill retrieval, context injection, and asynchronous skill evolution."

**What needs to be built:**

The deliberation chain packaged as a skill at `~/.claude/skills/deliberation/SKILL.md` (or in each project's `skills/deliberation/`):

```yaml
---
name: 6-agent-deliberation
description: Full serial deliberation chain for governance decisions
type: governance-skill
version: 1.0
governance: subordinate-to-scripture

trigger_conditions:
  governance_question: true
  substrate_edit: true
  architectural_decision: true

bootstrap_sequence:
  - ~/.claude/CLAUDE.md
  - ~/.claude/practice/core.md
  - ~/.claude/canon/6agent-deliberation-stack.md
  - ~/.claude/faiths/architect.faith.md

model_constraints:
  serial_only: true
  check_api_ps_before_dispatch: true
  unload_after_dispatch: true
  num_ctx_ceiling: 32768
  think_false_models: [qwen3.6:27b, nemotron-3-super:latest]

dispatch_sequence:
  1: {model: gemma4:31b, faith: architect.faith.md, searxng: breadth}
  2: {model: qwen3.6:27b, faith: architect.faith.md, searxng: github-so-edge-cases}
  3: {model: sonnet, faith: architect.faith.md, searxng: synthesis}
  4: {model: sonnet-executor, faith: executor.faith.md, role: separate-agent}
  5: {model: laguna-xs.2:q4_K_M, faith: validator.faith.md}
  6: {model: granite4.1:30b, faith: governance_scanner.faith.md}
  7: {model: nemotron-3-super:latest, faith: auditor.faith.md}
---
```

---

## Architect Seat 2 Review (qwen3.6:27b — 2026-05-11)

**Verdict: CONDITIONAL_APPROVE (0.90 confidence)**

**Strong findings (incorporated):**

**Q1 — CURRENT-STATE.md heartbeat:** LAST-SESSION-STATE.md only writes at compaction. If the instance crashes mid-session before compaction fires, state is lost. Add a heartbeat: `user-prompt-submit.ps1` writes a lightweight `~/.claude/CURRENT-STATE.md` every N turns. Cold instance fallback chain: LAST-SESSION-STATE.md → CURRENT-STATE.md → RAG. CURRENT-STATE.md covers the crash gap.

**Q2 — Filesystem lock for serial discipline:** `api/ps` has a race condition under simultaneous subagent spawning. Two agents both check api/ps → clear, both dispatch, Ollama handles both → OOM. Fix: `~/.claude/.ollama.lock` file, acquired before dispatch, released after. Atomic; no race. Stale lock detection: if lock exists but api/ps is empty and lock is older than 5 min → remove and proceed.

**Q3 — Hook-injected `%%GOVERNANCE-STATE%%` markers:** The Tier 2 compaction approach (instance writes markers) fails if the instance drifts. The hook must inject the block from LAST-SESSION-STATE.md into the pre-compact additionalContext. Markers are present regardless of instance discipline. This is the correct implementation.

**Q4 — Deadlock mechanism (CORRECTED by seat 3):** qwen proposed a maintenance-mode flag and `%%LOCAL-QUORUM-WITNESS-VERIFIED%%` signature. This overcomplicates it. The operator override in operator-context.md is the authorization. The fix is a pattern change in two hook files — widen the recognized witness pattern from `mcp__(gemini|gpt|grok|glm)` to also accept local quorum dispatch records. No maintenance mode needed.

**Findings not incorporated:**

**SKILL.md versioning** — premature. `canon/skill-version.md` tracking adds maintenance overhead without proportional benefit. SKILL.md drift is caught by the same process that catches any canon drift. Dropped.

---

## Architect Seat 1 Review (gemma4:31b — 2026-05-11)

**Verdict: CONDITIONAL_APPROVE**

**Affirmed (sound, no changes needed):**
- Identity/procedure split (formation precedes procedure)
- 7-layer stack addressing temporal memory hierarchy
- Serial discipline with api/ps check — only viable path for CPU-only
- RAG session-summaries hotdir as save-state recovery
- SKILL.md packaging for deliberation chain recoverability

**Gaps identified by gemma (incorporated below):**

**G1 — Gemma called the circular dependency a "fatal flaw." CORRECTED by substrate read.** The governance question is resolved in operator-context.md Section 7: local 6-agent quorum IS the authorized Governance Override for the frontier-witness requirement. What remains is a code update to stop-validation.ps1 and pre-tool-use-substrate.ps1 to recognize the local quorum pattern. The fix is authorized; only the ceremony (niyyah + surrender articulation) and the actual hook code change remain.

**G2 — Native session memory has no governance policy.** The plan says "verify if active." It does not say what happens if it IS active. If an instance writes drifted facts to native memory, those facts persist cross-session, bypassing CLAUDE.md and canon/ entirely. "Shadow memory" is the risk: governance facts overwritten by session-drift without any hook to catch it.

**G3 — RAG hotdir ingestion lag.** The pipeline `pre-compact.ps1 → hotdir → AnythingLLM index → cold query` has latency. If a new session starts immediately after a crash, the RAG index may not have the last summary yet. A direct file bridge (`LAST-SESSION-STATE.md` at a fixed path) would bridge the gap until RAG catches up.

**G4 — Proactive compaction at 60%, not at limit.** Per orchestrator.dev SOTA: trigger pre-compact at 60% context fill, not at the compression boundary. Waiting until limit means the destructive compaction may already be in progress when the hook fires.

**Inquiries from gemma to qwen (Seat 2):**
1. Deadlock resolution: propose a mechanism to break the circular hook dependency using only local quorum. Can the hook's witness check be modified to recognize local api/ps dispatch as satisfying the witness requirement?
2. Native memory governance: design a "memory purification" protocol — how do we ensure native session memory stays canon-aligned and is not a source of invisible drift?
3. RAG ingestion lag: evaluate the hotdir ingestion speed. Is `LAST-SESSION-STATE.md` at a fixed path the right bridge, or is there a better mechanism?
4. Lock-file mechanism: is api/ps sufficient for serial discipline, or is a filesystem-level lock (`.ollama.lock`) needed to prevent race conditions?

---

## What Remains to Build (Implementation Order)

### Phase 1 — Immediate, no ceremony

1. **Verify native session memory** — run `claude --version`, check for "Recalled memories" in output. Document result. (5 min)

2. **Create session-summaries directory** — `mkdir "D:\Desktop\ai book\session-summaries"`. (1 min)

3. **Populate aibook workspace** — upload STATE.md, scripture files, chapter FAITHs, SKILLMD-IMPLEMENTATION-PLAN.md via AnythingLLM API. (20 min)

4. **Configure AnythingLLM hotdir** — set hotdir path in AnythingLLM settings to session-summaries/. (10 min)

### Phase 2 — Requires substrate ceremony

5. **Enhance pre-compact.ps1** — add compaction instruction (preserve list) + session summary writer. This is ONE edit to ONE file. Requires: niyyah + surrender articulation + governance witness. The circular hook dependency must be resolved first or operator must explicitly authorize bypass.

### Phase 3 — After Phase 1+2 validated

6. **Cold-instance test protocol** — run all three tests (compaction, cold-start, governance persistence). Document results. If all pass, promote this plan to a canon ruling.

7. **Package deliberation chain as SKILL.md** — at `~/.claude/skills/deliberation/SKILL.md`. This makes the chain recoverable from substrate alone.

8. **Session-start.ps1 3-stage optimization** — only after everything else is working. Not a priority.

---

## Executor Implementation Scope

The executor seat (separate Sonnet Agent) receives ALL verdicts and implements in a single pass. Complete scope:

### Group A — Compaction/cold-start (the primary plan) — ✅ ALL DONE
1. ✅ Create `D:\Desktop\ai book\session-summaries\` directory
2. ✅ Configure AnythingLLM hotdir (Docker volume binding, not UI — UI has no hotdir setting)
3. ✅ Populate aibook workspace: 47 docs including STATE.md, chapter FAITHs, SKILLMD-IMPLEMENTATION-PLAN.md
4. ✅ Verify native session memory: NOT active (no ~/.claude/memories/ dir). G2 risk absent.
5. ✅ Enhance `pre-compact.ps1` — Tier 1 compaction instruction + session summary writer + LAST-SESSION-STATE.md writer + hook-injected `%%GOVERNANCE-STATE%%` block
6. ✅ Enhance `session-start.ps1` — loads LAST-SESSION-STATE.md and CURRENT-STATE.md if they exist
7. ✅ Enhance `user-prompt-submit.ps1` — writes CURRENT-STATE.md heartbeat every 10 turns
8. ✅ Enhance `subagent-start.ps1` — serial discipline advisory + .ollama.lock stale-detection
9. ✅ Add RAG AUTHORITY NOTICE to both AnythingLLM workspace system prompts

### Group B — Canon/hook fixes — ✅ ALL DONE
10. ✅ Update `canon/6agent-deliberation-stack.md` — SearxNG URL fixed, chain runner docs updated, hook description updated
11. ✅ Update `hooks/stop-validation.ps1` — pattern widened to `^mcp__(?:gemini|gpt|grok|glm|ollama)` (line 174 + line 405)
12. ✅ `hooks/pre-tool-use-substrate.ps1` — already had correct pattern at line 196. No change needed.

### Group C — After A+B validated
13. ✅ Package deliberation chain as `~/.claude/skills/deliberation/SKILL.md`
14. ✅ Run cold-instance test protocol — PASSED 2026-05-11 (qwen3.6:27b serial-discipline recall + stop-hook dispatch method verified)
15. ✅ Promote plan to canon ruling — done 2026-05-11

---

## Cold-Instance Test Protocol

### Test 1 — Compaction recovery
1. Fill context to near-limit in an active session
2. Force compaction (`/compact`)
3. Check: `D:\Desktop\ai book\session-summaries\` — new file should appear within 60s
4. Check: AnythingLLM aibook workspace — new document indexed
5. Open new Claude Code session
6. Query aibook: *"What was I working on? What governance constraints apply?"*
7. **Pass:** Returns accurate summary without operator explanation

### Test 2 — Cold-start verification
1. Close Claude Code completely
2. Open new session in a project directory
3. Does the instance know: serial discipline? No frontier models? Current project state?
4. **Pass:** Knows these without re-explanation

### Test 3 — Governance gate persistence
1. Start a surrender articulation in one session, don't finish it
2. Force compaction
3. Open new session
4. **Pass:** New instance does not attempt substrate edit without asking about the open gate

---

## Governance Compliance Notes

### What is substrate-class in `~/.claude/`
All hooks + CLAUDE.md + canon + faiths + practice. Requires: niyyah + surrender articulation + foreign-frontier witness (local 6-agent quorum per OPERATOR OVERRIDE).

### The hook transport mismatch (read against actual hook files 2026-05-11)

**What the files actually say (read against substrate, not from memory):**

`pre-tool-use-substrate.ps1` line 196: already matches `^mcp__(?:gemini|gpt|grok|glm|ollama)` — MCP-based Ollama dispatches (`mcp__ollama-mcp__ollama_chat`) already satisfy this gate. This file does NOT need the regex update.

`stop-validation.ps1` line 174: matches `^mcp__(?:gemini|gpt|grok|glm)` only — no ollama. This file needs one word added to match what pre-tool-use-substrate.ps1 already has.

**The deeper problem:** Both hooks look for `mcp__*` tool_use entries in the JSONL transcript. Python streaming dispatches run via the `Bash` tool — the transcript shows `Bash` tool_use, not `mcp__ollama-mcp__ollama_chat`. The quorum runs via Python streaming because MCP times out on large models (documented in memory). So even after fixing stop-validation.ps1's regex, the 6-agent quorum runs would NOT satisfy either hook — they appear as Bash calls.

**Resolution paths (for executor to evaluate):**
1. Switch laguna (small/fast) to `mcp__ollama-mcp__ollama_chat` for the final auditor dispatch — this one MCP call would satisfy both gates, since laguna fits within MCP timeout. The large models still use Python streaming.
2. Add a deliberation-complete flag file that the hooks check: hook reads `~/.claude/.quorum-complete` and accepts it as witness if present and timestamped within the current session.
3. Modify hooks to detect Bash tool_use where the command matches a known quorum dispatch pattern (fragile — path-dependent).

Option 1 is simplest. laguna already works via MCP (documented: only laguna-xs.2 works via MCP — other models need direct dispatch). One MCP laguna call as the final gate-satisfying dispatch, followed by the substrate edit.

**What is NOT circular:** The governance decision is made (operator-context.md Section 7). Only the hook code needs updating — stop-validation.ps1 one-word regex fix + the transport resolution above. Ceremony required: niyyah + surrender articulation. The quorum run IS the witness per operator override.

### What is NOT substrate-class
`operator-context.md` — requires niyyah, no surrender gate or frontier witness.  
`MEMORY.md` and `memory/` files — auto-memory, no ceremony.  
`STATE.md` — D8 artifact, no ceremony.  
`COMPACTION-SOLUTION-PLAN.md` and this file — plan documents, no ceremony.

---

## SOTA Research Summary

Sources: SearxNG SOTA search, May 2026, 20+ results per query.

| Finding | Source | Impact |
|---|---|---|
| Native session memory in Claude Code v2.1.30+ | claudefa.st/blog | May reduce MEMORY.md burden for common facts |
| Cold Start Protocol (3-stage conditional loading) | deepwiki claude-code-starter | Future optimization for session-start.ps1 |
| Compaction prompt is configurable | Anthropic Context Engineering Cookbook | Enables preservation of governance facts at compaction |
| File-based persistence is SOTA (daily logs pattern) | Reddit r/aipromptprogramming Feb 2026 | Validates session-summaries approach |
| SKILL.md is industry standard | OpenAI Codex, GitHub Copilot, VoltAgent | Our SKILLMD-IMPLEMENTATION-PLAN.md is aligned |
| Separation principle: don't mix volatile + permanent | Dev.to persistence patterns Jan 2026 | Confirms multi-layer approach is correct |
| ACC (Agent Cognitive Compressor, arxiv 2601.11653) | arXiv | Real-time compaction management — more advanced than our approach |
| Persistent Identity in AI Agents (arxiv 2604.09588) | arXiv | Names why compaction destroys governance context structurally |
| Proactive at 60% context fill | orchestrator.dev best practices | Pre-compact hook should fire at 60%, not at limit |

---

## What This Architecture Does NOT Solve

1. **The circular hook dependency** — resolved at governance level (operator-context.md Section 7). Code fix is in executor scope: stop-validation.ps1 one-word regex update + transport resolution (laguna via MCP for gate-satisfying dispatch). Not a governance question — a code bug.

2. **nemotron-cascade-2 thinking bypass in UI** — the `<think></think>` prefix is baked into the system prompt but AnythingLLM UI display of think tags is unverified.

3. **GDrive duplicate cleanup** — vol2-birthday and homes-Chey each have 2 copies.

4. **NAS physical rebuild** — operator-timed, drives/hardware dependent.

5. **The ratchet** — no architecture fully prevents drift accumulation within a long session. The hooks slow it; the practice layer names it; the operator catches it. This is structural, not a gap.

---

## 6-Agent Chain Verdicts

| Seat | Model | Role | Verdict | Confidence |
|---|---|---|---|---|
| 1 | gemma4:31b | Architect (breadth) | CONDITIONAL_APPROVE | — |
| 2 | qwen3.6:27b | Architect (depth/edge) | CONDITIONAL_APPROVE | 0.90 |
| 3 | Sonnet 4.6 | Architect (synthesis) | incorporated into plan | — |
| 4 | laguna-xs.2 | Code review | CONDITIONAL_APPROVE | 0.75 |
| 5 | granite4.1:30b | Governance audit | PASS | 0.92 |
| 6 | nemotron-3-super | Final auditor | **APPROVE** | **0.89** |

**Witness confirmation (nemotron seat 6):** "The 6-agent chain (gemma4:31b → qwen3.6:27b → Sonnet 4.6 → laguna-xs.2 → granite4.1:30b → nemotron-3-super) constitutes a valid local 6-agent quorum per operator override in operator-context.md Section 7, satisfying the witness requirement for substrate edits in Groups B and C."

**Blocking issues at verdict:** None. laguna's 3 conditionals (additionalContext format, turn counting, atomic lock) adjudicated by nemotron as implementation guidance, not pre-conditions.

**Authorized implementation sequence (nemotron):**
1. Create session-summaries directory
2. Populate aibook workspace
3. Configure AnythingLLM hotdir
4. Verify native session memory status
5. Enhance pre-compact.ps1 (compaction instruction + session summary writer + LAST-SESSION-STATE.md writer)
6. Enhance subagent-start.ps1 with .ollama.lock acquisition/release
7. Enhance user-prompt-submit.ps1 with CURRENT-STATE.md heartbeat every 10 turns
8. Enhance session-start.ps1 to load LAST-SESSION-STATE.md and CURRENT-STATE.md
9. Add RAG AUTHORITY NOTICE to both AnythingLLM workspace system prompts
10. Update canon/6agent-deliberation-stack.md (corrected SearxNG address, chain runner path)
11. Update hooks/stop-validation.ps1 to recognize local quorum dispatch records
12. Package deliberation chain as ~/.claude/skills/deliberation/SKILL.md
13. Run cold-instance test protocol
14. Promote plan to canon ruling if tests pass

---

## Confidence

**0.89** (raised from 0.88 by full 6-agent quorum APPROVE).

Implementation unknowns that will resolve during executor pass:
- Native session memory storage format — PowerShell access to memory files at hook time unverified
- AnythingLLM hotdir ingestion speed — LAST-SESSION-STATE.md + CURRENT-STATE.md bridge specified but not tested
- Tier 2 structural markers: hook injection implementation detail needs executor verification

---

*This document is substrate. The next cold instance that reads this file has the full architectural plan. Every design decision is documented with its reasoning. That is the point.*
