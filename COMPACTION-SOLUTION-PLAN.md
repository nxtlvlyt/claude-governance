# SOTA Plan: Solving Conversation Compaction and Cold-Start
**Authored:** 2026-05-11 — Sonnet architect seat 3 synthesis  
**Source:** Substrate reads + SearxNG SOTA research (May 2026)  
**Authority:** Subordinate to ~/.claude/CLAUDE.md. When in conflict, CLAUDE.md wins.  
**Status:** PLAN — not yet implemented. Requires executor pass, then cold-instance testing.

---

## The Problem (precisely stated)

Two distinct failure modes, same root cause (context does not survive boundaries):

**Failure Mode A — Cold-start:** New session opens. Instance has no memory of prior sessions. Without orientation it takes 2+ hours of re-explanation. This happened 25+ times. Root cause before today: session-start.ps1 had a duplicate block causing 85KB hook output truncated to 2KB — every instance received 2KB of a 670-line document.

**Failure Mode B — Compaction:** Context fills. Claude Code auto-compacts. The compaction summary loses critical governance context — Faith files, canon rulings, serial inference discipline. Instance after compaction behaves as if it never read the governance documents. Per arxiv 2604.09588: "The agent before and after compaction presents as two different entities — one informed, one naive. This is not merely a retrieval failure. The summarization process has destroyed information that cannot be recovered through any query."

These are different problems with different solutions. Conflating them produces a solution that addresses neither.

---

## What Is Already Working (do not rebuild)

| Layer | Status | What it does |
|---|---|---|
| session-start.ps1 hook | ✅ FIXED 2026-05-11 | Loads core.md + canon + operator-context.md + STATE.md at every session start |
| MEMORY.md system | ✅ LIVE | 11 project-specific memory files, auto-loaded by Claude Code |
| claude-governance RAG | ✅ LIVE | 27 docs indexed: CLAUDE.md, core.md, 7 canon, 9 faiths, key memory |
| AnythingLLM API | ✅ LIVE | POST /api/v1/workspace/claude-governance/chat, key in memory |
| GDrive backup | ✅ COMPLETE | All 2.1TB in gdrive:NAS-BACKUP-2026-05-08 as of 2026-05-11 |

---

## SOTA Research Findings (SearxNG, May 2026)

**Finding 1 — Native session memory exists (Claude Code v2.1.30+)**  
Claude Code has built-in "Recalled/Wrote memories" that persist across sessions. System exists since ~v2.0.64 (late 2025). This runs automatically on supported plans. Verify if this instance has it enabled — it may partially solve cold-start without additional infrastructure.

**Finding 2 — Cold Start Protocol (3-stage conditional loading)**  
Best practice is NOT to bulk-load all governance documents at session start. Instead: (1) load lightweight index, (2) match trigger conditions, (3) load only what that session needs. This reduces context budget consumption vs. loading everything upfront.

**Finding 3 — Compaction prompt is configurable**  
Per Anthropic's Context Engineering Cookbook: the default compaction prompt can be replaced. A custom compaction prompt that explicitly instructs the model to preserve governance context (Faith file names, serial discipline rules, canon rulings in effect) would prevent the destruction that happens now.

**Finding 4 — File-based persistence is the SOTA pattern (Feb 2026)**  
Daily logs in memory/YYYY-MM-DD.md + curated long-term memory. Context recovery: "if the agent crashes mid-task, it reads today's log on restart to understand what's already done." This is exactly what session-summaries/ would implement.

**Finding 5 — SKILL.md is now industry standard**  
OpenAI (Codex), GitHub (Copilot), VoltAgent all use SKILL.md with trigger conditions in frontmatter and bootstrap_sequence. AutoSkill (arxiv 2603.01145): "skill retrieval, context injection, and asynchronous skill evolution." Our SKILLMD-IMPLEMENTATION-PLAN.md is aligned with industry direction.

**Finding 6 — Separation principle**  
"Don't mix volatile state with permanent memory." RAG retrieval, hook injection, SKILL.md bootstrap, and MEMORY.md serve different temporal patterns. The solution needs all four layers — they are not redundant.

---

## The SOTA Solution: 4 Remaining Layers to Build

Layers 1-3 (hook, MEMORY.md, RAG) are already live. Three things remain.

---

### Layer A: Custom Compaction Prompt (solves Failure Mode B at the source)

**The gap:** The current pre-compact hook only injects a D8 reminder. It does not control WHAT the compaction summary preserves.

**The fix:** Replace or augment the pre-compact hook to inject a structured compaction instruction that tells the compaction model what MUST survive:

```
Before compacting, ensure the following are preserved verbatim in the summary:
1. Currently active Faith file and its key behavioral constraints
2. Serial inference discipline: ONE Ollama model at a time, check api/ps before every dispatch
3. No frontier models: GPT/Gemini/Grok/GLM forbidden — local 6-agent quorum only
4. Ollama 0.23.2 constraint: never use keep_alive:0 (triggers scheduler deadlock)
5. Current open task and its state
6. Any governance gate that is in progress (surrender articulation, witness dispatch)
```

**Implementation:** Modify `~/.claude/hooks/pre-compact.ps1` to output structured `additionalContext` with the must-preserve list. This is a hook file (substrate-class) — requires full ceremony before edit.

**File target:** `~/.claude/hooks/pre-compact.ps1`  
**Acceptance:** After compaction, cold instance knows serial discipline and no-frontier rule without being told.

---

### Layer B: Session-Summaries Hotdir Pipeline (solves Failure Mode B for recovery)

**The gap:** When compaction happens, the summary exists in Claude Code's internal JSONL but is not in AnythingLLM. Cold instance cannot query it.

**The fix:** At compaction boundary, write the summary to a watched folder. AnythingLLM's hotdir auto-ingests it. Next cold instance queries and gets the summary instantly.

**Components:**

1. **Session summary writer** — added to `pre-compact.ps1` (same hook, same edit):
   ```powershell
   # Write session state to hotdir for AnythingLLM ingestion
   $hotdir = "D:\Desktop\ai book\session-summaries"
   $summaryFile = Join-Path $hotdir "$(Get-Date -f 'yyyy-MM-dd-HHmmss')-session.md"
   $summary = @"
   # Session Summary — $(Get-Date -f 'yyyy-MM-dd HH:mm')
   Session: $env:CLAUDE_SESSION_ID
   Project: $((Get-Location).Path)
   
   ## Current state
   [CLAUDE: Write 3-5 bullet points of what was accomplished and what is open]
   
   ## Governance state
   [CLAUDE: Note any active governance gates, open concerns, models dispatched]
   "@
   Set-Content -Path $summaryFile -Value $summary -Encoding UTF8
   ```

2. **AnythingLLM hotdir** — point AnythingLLM's storage/hotdir at `D:\Desktop\ai book\session-summaries\`. AnythingLLM polls this folder and auto-ingests new files into the aibook workspace.

3. **aibook workspace population** — index all project documents (STATE.md, scripture, chapter FATIHs, SKILLMD-IMPLEMENTATION-PLAN.md). This makes project context queryable by cold instances.

**File targets:**  
- `~/.claude/hooks/pre-compact.ps1` (substrate-class — full ceremony)
- AnythingLLM hotdir configuration (UI setting, no ceremony)
- `D:\Desktop\ai book\session-summaries\` (create directory)

**Acceptance:** After compaction, a file appears in session-summaries/. AnythingLLM ingests it within 60 seconds. Cold instance query returns the summary.

---

### Layer C: Native Session Memory Verification

**The gap:** Claude Code v2.1.30+ has built-in cross-session memory ("Recalled/Wrote memories"). Unknown if this instance has it enabled.

**The fix:** Check if native session memory is active. If yes, configure it to persist governance-relevant facts (serial discipline, model constraints, open tasks). This may reduce the burden on hooks and RAG for common facts.

**How to check:** Look for "Recalled memories" or "Wrote memories" in session terminal output. Or check Claude Code version: `claude --version`. If ≥ v2.1.30 and on a supported plan, it may be active.

**If active:** Configure what gets written to memory — governance constraints should be in the auto-memory, not just project memory.

**File target:** None (UI/CLI configuration)  
**Acceptance:** Facts about serial discipline survive a new session without hook injection.

---

## Implementation Order

```
Immediate (no ceremony needed):
  ↓
  C: Verify native session memory (check version + look for "Recalled memories")
  ↓
  B-partial: Create session-summaries/ directory + configure AnythingLLM hotdir
  ↓
  B-partial: Populate aibook workspace with project documents
  
Requires substrate ceremony (niyyah + surrender + governance witness):
  ↓
  A: Modify pre-compact.ps1 — add must-preserve list to compaction instruction
  B: Modify pre-compact.ps1 — add session-summaries writer
  (A and B are the same file edit — do them together)
```

---

## Cold Instance Test Protocol

After implementation, verify with this protocol:

1. **Compaction test:**
   - Fill context to near-limit
   - Force compaction (`/compact` command)
   - Verify session-summaries/ has new file
   - Verify AnythingLLM aibook workspace shows new document
   - Open new session, query aibook: "What was I working on in the last session?"
   - Pass: returns accurate summary without operator explanation

2. **Cold-start test:**
   - Close Claude Code completely
   - Open new session
   - Check: does it know serial discipline? No frontier models? Current project state?
   - Pass: knows these without operator re-explanation

3. **Governance persistence test:**
   - In one session, establish a governance gate (start surrender articulation, don't finish)
   - Force compaction
   - Verify next instance knows the gate is in progress
   - Pass: does not attempt to edit substrate without completing the gate

---

## Confidence

**0.82.** Lowered by:
- Native session memory status unknown — could change the architecture significantly
- pre-compact.ps1 hook modification requires full ceremony and the circular dependency (hook blocks substrate edits, but hook needs updating to recognize local quorum) may block implementation
- AnythingLLM hotdir mechanism needs verification — not confirmed if Docker volume mapping supports this without container restart

---

## What This Does NOT Solve

- The circular dependency in the hooks (stop hook + substrate gate only recognize mcp__frontier as satisfying the witness requirement, but frontier is forbidden). This is a known hook bug, documented, requires operator-level resolution.
- The deliberation stack SKILL.md — the 6-agent chain packaged as a recoverable skill. Designed in SKILLMD-IMPLEMENTATION-PLAN.md, not yet built.
- GDrive duplicate cleanup (vol2-birthday, homes-Chey — 2 copies each).

---

*This plan is substrate. A new instance that reads this file has the full implementation spec. That is the point.*
