# COMPACTION-RETRIEVAL-IMPLEMENTATION-PLAN.md

**Mission 6: Retrieval-Side Architecture for P5 Two-Layer Compounding Memory System**

**Authored:** 2026-06-03 — architect seat (Phase 1 Planner, blind eval complete)
**Source:** Substrate reads of ANTIGRAVITY.md, practice/core.md, CLAUDE.md, COMPACTION-SOLUTION-PLAN.md, operator-context.md (FM-1..FM-12), CANON-MANIFEST.md, pre-compact.mjs (write path), session-start.mjs (bootstrap), bootstrap-gate.mjs, LAST-SESSION-STATE.md (structural example), COMPACTION-RETRIEVAL-IMPLEMENTATION-PLAN.md (prior draft), plus failure_log.md creation verification.
**Authority:** Subordinate to CLAUDE.md / ANTIGRAVITY.md. When in conflict, those win.
**Status:** PLAN — substrate for executor pass. Write path (AnythingLLM hotdir via pre-compact.mjs) already implemented per task. This completes Layer B-read + failure_log integration.

---

## The Problem (precisely stated, from blind eval)

While the AnythingLLM hotdir write-path has been implemented in the Muezzin Isha step (pre-compact.mjs writes timestamped session-*.md with failures_this_session, corrections_applied, patterns_confirmed, open_carries sections + STUB fallback), the retrieval path is incomplete:

- Cold instance after compaction has no automatic access to cross-session session-summaries.
- No persistent accumulator for the four sections across compactions.
- open_carries buried in LAST-SESSION-STATE.md rather than prominently surfaced.
- No on-demand history query mechanism.
- Failure patterns (FM-1 through FM-12 from operator-context.md) are documented but not compounded across sessions.

This leaves the P5 two-layer system (Layer A: hotdir write for AnythingLLM; Layer B: retrieval at bootstrap) half-complete. Per practice/core.md Ghusl requirement for cold bootstrap and Directive 8/14 in CLAUDE.md (write for the stranger; no assumed cross-session memory), the retrieval architecture must make prior session state, open carries, and failure patterns substrate-available without operator re-explanation.

**Acceptance Test (from task + draft):** After implementation, a cold instance after compaction should answer "What was I working on?" accurately without operator explanation — proving the retrieval path works. Must also surface open carries and know FM patterns.

---

## What Is Already Working (do not rebuild)

**Write Path (Layer B-write) — FULLY IMPLEMENTED (confirmed by file_read on pre-compact.mjs)**
- `pre-compact.mjs` writes to `D:\Desktop\ai book\session-summaries\`
- Structured sections: failures_this_session, corrections_applied, patterns_confirmed, open_carries (as required headers in summary; instance populates in LAST-SESSION-STATE.md for rich content)
- STUB WARNING if instance didn't populate content before compaction (LAST-SESSION-STATE <=500 bytes)
- Extracts: last operator messages (from transcript last-prompt entries, deduped), git state (governance repo + project CWD), optional LLM handoff summary (laguna-xs.2 with serial /api/ps check, fail-open)
- Also writes LAST-SESSION-STATE.md (hook stub + openAtCompaction + git + metadata)
- Injects D8 reminder + BOOTSTRAP HANDOFF block (requiring core.md + CANON-MANIFEST.md reads) into additionalContext

**Bootstrap Read Path (session-start.mjs + bootstrap-gate.mjs) — FULLY IMPLEMENTED for local files**
- Loads practice/core.md, CANON-MANIFEST.md, LAST-SESSION-STATE.md, CURRENT-STATE.md (with model_version ikhtilāṭ check per practice/core.md Ghusl)
- Optional operator-context.md (env), project STATE.md
- bootstrap-gate.mjs enforces Fajr (core + CANON-MANIFEST reads demonstrated in transcript) before non-bootstrap Read/Edit/Write; resets at compact_boundary; bootstrap files always pass
- P6 catch-up push

**Structural Formatting of Compaction Files (analyzed from pre-compact.mjs + LAST-SESSION-STATE.md example)**
- In session summary (hotdir):
  ```
  ## Required sections (instance must populate before compaction)
  ### failures_this_session
  ### corrections_applied
  ### patterns_confirmed
  ### open_carries
  ## Session state
  [LAST-SESSION-STATE content]
  ```
- Stub variant marks them MISSING + includes openAtCompaction.
- In LAST-SESSION-STATE.md (current example): No dedicated open_carries section; instead "OPEN AT COMPACTION — last operator messages" + git states under Session state. Governance constants always present. This formatting gap must be bridged in retrieval (extract "OPEN AT COMPACTION" as proxy for open_carries).
- open_carries intended to hold handoff items (per reminder in pre-compact: "These MUST go into open_carries in LAST-SESSION-STATE.md").

**COMPACTION-SOLUTION-PLAN.md (read in full) Alignment**
- Older plan (2026-05-11) proposed hotdir (now done), custom compaction prompt (Layer A, not this mission), native memory (Layer C, not this).
- This Mission 6 completes the retrieval complement to the hotdir.

---

## The Plan: 4 Layers to Complete P5 Two-Layer Memory

| Layer | Component | Ceremony | File Target |
|-------|-----------|----------|-------------|
| **1** | `failure_log.md` creation | Niyyah only | `D:\Desktop\ai book\failure_log.md` (NEW) |
| **2** | `pre-compact.mjs` → merge to `failure_log.md` | **Full substrate** (niyyah + surrender + witness) | `~/.claude/hooks/pre-compact.mjs` |
| **3** | `session-start.mjs` → AnythingLLM query + open_carries surfacing + failure_log load | **Full substrate** | `~/.claude/hooks/session-start.mjs` |
| **4** | `session-history.py` on-demand retrieval | Niyyah only | `~/.claude/scripts/session-history.py` (NEW) |

---

## Key Design Decisions (Kiraman Katibin)

1. **failure_log.md structure**: Four sections mirroring session summaries exactly (failures_this_session etc.) + Pattern Index pre-populated with FM-1 through FM-12 (titles, descriptions, initial occurrences/status from operator-context.md Section 11). 
   - **Why**: Direct aggregation from the compaction file structure. Pattern Index enables quick bootstrap view of recurring failures (guards FM-Cross-Session-Failure-Blindness). Location matches hotdir for AnythingLLM consistency. Additive only (closed carries to corrections_applied).
   - **Confidence**: 0.9

2. **pre-compact.mjs merge logic**: After hotdir write, read existing failure_log.md, parse the four sections from the *just-written* summaryContent (or LAST-SESSION-STATE if rich), append dated entries like `- [ts] [session-ts] <content>`, update Pattern Index (increment counts, set last-seen), write back atomically. Fail-open on any error.
   - **Why**: Compaction boundary is when the four sections are fresh and authoritative. Bridges write to the persistent read layer. Matches "compounding" in P5.
   - **Confidence**: 0.85 (parsing must be simple string-based to avoid complexity)

3. **AnythingLLM query at bootstrap (in session-start.mjs)**: After local file loads, attempt HTTP to AnythingLLM (localhost:8080) querying the claude-governance workspace (per operator-context.md and COMPACTION-SOLUTION-PLAN.md) for "most recent 5 session summaries from hotdir ingestion. Extract failures_this_session, open_carries, patterns_confirmed, corrections_applied." 5-second timeout, fail-silent (no block). Inject as `===== ANYTHINGLLM SESSION HISTORY =====` block.
   - **Why**: Provides synthesized cross-session view (hotdir summaries are in the workspace). Local substrate (LAST-SESSION-STATE, failure_log) remains primary/authoritative. Fail-silent aligns with practice/core.md (humility, no paralysis).
   - **Confidence**: 0.75 (workspace name "claude-governance" from substrate; confirm via config read if needed in executor pass)

4. **open_carries surfacing (in session-start.mjs)**: Immediately after loading LAST-SESSION-STATE.md, extract content from "## open_carries" (if present) or fallback to "## OPEN AT COMPACTION — last operator messages (hook-extracted)" block + git. If non-empty, inject as FIRST block in contextParts: `⚠️ OPEN CARRIES FROM LAST COMPACTION\n\n[extracted content]\n\nThese must be addressed before new work.`
   - **Why**: Current structural formatting buries them; prominence at TOP of bootstrap ensures cold instance sees them first (per acceptance test). Also aggregate from failure_log open_carries section.
   - **Confidence**: 0.85

5. **failure_log load (in session-start.mjs)**: Read D:\Desktop\ai book\failure_log.md, extract only the "## Pattern Index" section (truncate if >2K chars to protect budget). Inject as `===== FAILURE LOG (cross-session patterns) =====\n[pattern index]`
   - **Why**: Gives cold instance immediate view of recurring FM patterns without loading full log. Complements local LAST-SESSION-STATE.
   - **Confidence**: 0.9

6. **On-demand retrieval (session-history.py)**: New utility at ~/.claude/scripts/session-history.py. Supports:
   - `python session-history.py --last 7` (last 7 days summaries)
   - `python session-history.py --open-carries`
   - `python session-history.py --failures` (pattern index)
   - `python session-history.py --search "FM-3"`
   - Impl: Direct fs read of session-summaries/ dir (parse markdown sections) + AnythingLLM fallback query if dir empty or for synthesis. No hook integration.
   - **Why**: For sessions needing deeper history than bootstrap context allows. Lightweight, niyyah-only (utility).
   - **Confidence**: 0.95 (matches patterns in operator-context.md deliberate.py etc.)

7. **Bootstrap order in session-start.mjs**: local files (including new failure_log + open_carries extraction) → AnythingLLM query (if reachable) → context assembly with OPEN CARRIES block at top.
   - **Why**: Local substrate first (per Directive 1), then RAG synthesis. Aligns with practice/core.md retrieval routing (substrate primary, AnythingLLM for governance rules/historical).

8. **Ceremony**: failure_log creation and session-history.py: niyyah only (not substrate-class per CANON-MANIFEST). Hook edits: full (niyyah visible before edit + surrender articulation + foreign-frontier witness per operator-context Section 7 and pre-tool-use-substrate gate). Bootstrap-gate and niyyah-gate will enforce.
   - **Why**: Hooks are substrate-class. Must honor the architecture.
   - **Confidence**: 1.0

---

## Implementation Order (for executor)

```
Phase 0: Verification (no ceremony)
  □ Confirm D:\Desktop\ai book\session-summaries\ has files
  □ Confirm failure_log.md now exists (created in this plan)
  □ Confirm AnythingLLM running, hotdir configured to session-summaries
  □ Confirm current hooks are .mjs versions

Phase 1: failure_log.md (Niyyah only) — DONE (written in this architect pass with FM-1..FM-12 seed)
  (If not, niyyah: "source: operator-context.md + COMPACTION-SOLUTION-PLAN.md; failure_mode: cross-session blindness; work: create failure_log.md")

Phase 2: pre-compact.mjs merge (Full ceremony)
  - Add merge code after hotdir write
  - Surrender: "substrate says: [the hotdir write section]; instance: add merge to close retrieval gap; resolution: substrate wins"

Phase 3: session-start.mjs retrieval (Full ceremony)
  - Add open_carries extraction + top injection
  - Add failure_log read (pattern index)
  - Add AnythingLLM query block (fail-silent)
  - Surrender + niyyah + witness required

Phase 4: session-history.py (Niyyah only)
  - Create script with fs + fallback query

Phase 5: Cold-Instance Test
  1. Session with work, populate LAST-SESSION-STATE with the four sections (or let stub)
  2. /compact or fill context
  3. Verify hotdir file + failure_log.md updated (new entries + counts)
  4. Close Claude Code
  5. New session
  6. Verify bootstrap context has:
     - ⚠️ OPEN CARRIES FROM LAST COMPACTION (prominent)
     - ===== FAILURE LOG (cross-session patterns)
     - ===== ANYTHINGLLM SESSION HISTORY (if reachable)
  7. Instance answers "What was I working on last session?" + "What open carries?" + "What recurring FM patterns?" accurately from injected blocks
```

---

## File Targets Summary

- `D:\Desktop\ai book\failure_log.md` : New, created with template + FM index
- `~/.claude/hooks/pre-compact.mjs` : Add merge logic after line ~140 (hotdir write)
- `~/.claude/hooks/session-start.mjs` : Add extraction after LAST-SESSION-STATE load; add query after local loads; promote open_carries
- `~/.claude/scripts/session-history.py` : New

---

## Acceptance Criteria

- failure_log.md exists with four sections + seeded Pattern Index (FM-1..12)
- After compaction: failure_log.md shows appended entries from the session's four sections + updated counts
- New cold session bootstrap includes prominent ⚠️ OPEN CARRIES block (from LAST-SESSION-STATE or failure_log)
- New cold session bootstrap includes FAILURE LOG block (pattern index)
- New cold session bootstrap includes ANYTHINGLLM SESSION HISTORY block (if service up)
- Cold instance after compaction + new session can state prior work, open carries, and at least 2 FM patterns without operator input
- On-demand: python session-history.py --open-carries returns aggregated carries
- No breakage to existing bootstrap or write path
- All changes honor bootstrap-gate, niyyah-gate, surrender-check, pre-tool-use-substrate

---

## What This Does NOT Solve

- Layer A in COMPACTION-SOLUTION-PLAN.md (custom compaction prompt to preserve governance at source)
- Layer C (native Claude Code session memory verification)
- Circular dependency in stop/substrate hooks (frontier forbidden but gate requires witness; documented in operator-context)
- Full SKILL.md packaging for deliberation stack
- AnythingLLM workspace name verification (use claude-governance per substrate; adjust in executor if needed)

---

## Confidence

**0.87** — High because write path proven, bootstrap pattern proven, FM list in substrate, failure_log creation done in this pass. Lowered by AnythingLLM query latency/endpoint details (fail-silent mitigates), context budget addition (keep Pattern Index short), hook edit ceremony (but plan accounts for it).

---

*This plan is substrate. A new instance that reads this file + the blind eval log has the full spec for retrieval-side completion. Executor may now implement Phases 1-4 (with appropriate ceremony for substrate edits).*

---

[DECLARED NIYYAH]
Files I physically read (verified against my transcript tool calls): 
C:\Users\marka\.agents\ANTIGRAVITY.md, 
C:\Users\marka\.claude\practice\core.md, 
C:\Users\marka\.claude\COMPACTION-SOLUTION-PLAN.md, 
C:\Users\marka\.claude\hooks\pre-compact.mjs, 
C:\Users\marka\.claude\hooks\session-start.mjs, 
C:\Users\marka\.claude\CLAUDE.md, 
C:\Users\marka\.claude\CANON-MANIFEST.md, 
C:\Users\marka\.claude\operator-context.md, 
C:\Users\marka\.claude\LAST-SESSION-STATE.md, 
C:\Users\marka\.claude\hooks\bootstrap-gate.mjs, 
D:\Desktop\ai book\failure_log.md (pre-creation verification), 
C:\Users\marka\.claude\COMPACTION-RETRIEVAL-IMPLEMENTATION-PLAN.md (prior), 
and wrote the blind eval to C:\Users\marka\.claude\state\architect-blind-eval-mission6.md and failure_log.md + this plan.

Failure mode my plan guards against: FM-Cross-Session-Failure-Blindness (no persistent failure_log.md for FM-1..FM-12 from operator-context.md) + FM-Compaction-Amnesia (cold instance after boundary has no retrieval of session-summaries, open_carries, or patterns; violates Directive 8/14 and practice/core.md Ghusl/cold bootstrap requirements). Also guards incomplete P5 two-layer system.

What my intention is: To complete the retrieval-side architecture (Layers 1-4) for the P5 two-layer compounding memory system for Antigravity by designing (and partially seeding via failure_log.md creation) the failure_log.md integration, AnythingLLM query at bootstrap, prominent open_carries surfacing, and on-demand script — ensuring cold instances orient from substrate (hotdir summaries + failure patterns + LAST-SESSION-STATE) without operator re-explanation. All design reasoned from read substrate only (blind eval logged first). Plan submitted for executor implementation with full ceremony on substrate-class files.
[/DECLARED NIYYAH]