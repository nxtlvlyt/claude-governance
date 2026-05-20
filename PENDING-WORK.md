# Pending Work Inventory
# Last updated: 2026-05-20 (session 657b07d5 — C3 chain closed)
# Purpose: Comprehensive inventory so no future instance starts blind.
# Read this when resuming any work. Verify each item against substrate before acting.

---

## PRIORITY ORDER

1. FM-12 stop-validation.mjs extension — implementation-ready
2. session-hash-chain.mjs C2 implementation — approved in C2 chain, deferred until after C3
3. foreign-frontier-validators.md line 7 discrepancy — canon edit
4. Warroom Phase 1 — C3 now closed, prerequisite met
5. Container-optimization co-fixes — non-blocking
6. NAS Volume 3 — physical work, ~2 weeks
7. Windows Scheduled Tasks — 11 disabled tasks
8. BC1 smoke test — wire-server.py integration test

---

## CATEGORY 1 — Governance Repo (immediate)

### C2 — TSA SPoF: Parallel TSA + OpenTimestamps ✓ COMPLETE
**Status:** CLOSED — 6-seat chain unanimous CONDITIONAL_APPROVE (2026-05-19, task btjjhymvq).
**Decision log:** `C:\warroom\logs\decisions\2026\05\19\c2-tsa-spof-parallel-ots-architecture.md`
**Supersedes:** `C:\warroom\logs\decisions\2026\05\15\c2-tsa-spof-redundancy-design.md`
**Architecture decided:** D1 parallel TSA (8s global timeout, ASN.1 validation) + D2 JSON OTS pending-stub offline + D3 manifest v3 (ots_path/ots_status/ots_hash) + D4 War Room 2s tight TSA timeout
**Implementation pending:** Edit `hooks/session-hash-chain.mjs` after C3 closes
**Open Q1:** Does EU AI Act Art 12/15 require third-party timestamp certification? (gates whether binary OTS + javascript-opentimestamps required vs JSON stub sufficient)

### C3 — Memory Unification Interface ✓ COMPLETE
**Status:** CLOSED — 6-seat chain unanimous CONDITIONAL_APPROVE (2026-05-20, session 657b07d5).
**Decision log:** `C:\warroom\logs\decisions\2026\05\20\c3-memory-unification-routing-architecture.md`
**Architecture decided:** D1 four-tier categorical model (substrate→STATE.md→AnythingLLM→MEMORY.md) + D2 retrieval routing section added to practice/core.md + D3 commit-triggered AnythingLLM sync (pending impl) + D4 warroom separate workspace + D5 MEMORY.md audit (deferred)
**Implementation done:** practice/core.md routing section committed (D2)
**Implementation pending:** D3 AnythingLLM sync in git-anchor.mjs; D5 MEMORY.md coverage audit

### FM-12 stop-validation.mjs Extension
**Status:** Formation rule implemented in practice/core.md and operator-context.md (2026-05-19). Hook enforcement NOT implemented.
**What:** The governance-passive-gaps chain (APPROVE, confidence 0.88) recommended a state-file architecture:
  - `~/.claude/state/active-tasks-{session_id}.json` — updated by PreToolUse on TaskCreate/ScheduleWakeup
  - `stop-validation.mjs` reads state-file at Stop, verifies ScheduleWakeup was set before any background-task wait
**Why not done yet:** Was scoped as recommended future work, not blocking for the chain. Formation rule is the primary vehicle; hook is the structural backstop.
**No chain needed:** Architecture approved by governance-passive-gaps chain. Needs implementation chain question or direct implementation.
**Files to touch:** `hooks/stop-validation.mjs`, new hook `hooks/pre-tool-use-task-watcher.mjs`.

### foreign-frontier-validators.md Line 7 Discrepancy
**Status:** Known from warroom STATE S8. Canon edit NOT yet done.
**What:** `foreign-frontier-validators.md` line 7 says "WebSearch and WebFetch do not count toward the foreign-frontier dispatch requirement" — but `pre-tool-use-substrate.mjs` DOES accept them. Canon and hook are inconsistent.
**Fix:** Update `foreign-frontier-validators.md` line 7 to reflect that WebSearch/WebFetch DO satisfy the substrate gate (matching what the hook actually enforces).
**Ceremony:** Substrate-class edit — requires niyyah + surrender articulation + local quorum dispatch (laguna PASS minimum). No full 6-agent chain needed given the fix is clearly documented and the hook is the ground truth.

### Container-Optimization Co-fixes (non-blocking)
**Status:** Chain complete (CONDITIONAL_APPROVE). Three remaining open concerns, all non-blocking.
**What was implemented:** CPU embedding offload (Infinity), SFTP volume backup, Forgejo remote, pre-compact hook schema v2.
**Open concerns from chain:**
  1. **C1 (pre-compact.mjs):** Explicit `ollama stop laguna-xs.2:q4_K_M` after pre-compact summarization — prevent slot lingering. LOW priority.
  2. **C2 (volume-backup):** SHA256 checksum verification on NAS after SFTP backup — add SSH-based verification script. MEDIUM priority.
  3. **C3 (pre-compact JSONL parsing):** Length/content validation before dispatching to laguna — handle malformed lastPrompt fields. LOW priority.
**Note on Forgejo triple-remote concern:** git-anchor.mjs already pushes to all 3 remotes at session end. Concern may already be addressed. Verify before implementing.

---

## CATEGORY 2 — Warroom Phase 1 (after C2/C3)

**Prerequisite:** C2 ✓ CLOSED (2026-05-19). C3 ✓ CLOSED (2026-05-20). Decision logs written. Warroom Phase 1 is unblocked.

### warroom status command
**Status:** NEXT warroom task (pending from S8 and confirmed in S9). No implementation yet.
**What:** `python cli.py status` exists but `warroom status` as a named subcommand may not. The STATUS stub must be wired to real health checks.
**Reference:** warroom STATE.md 0-MAY-15-S9 — "Phase 1 item 2: warroom status command — first item in resumption sequence."

### Autonomous Mode Wiring (Phase 1 Gap 1)
**Status:** `FailoverDetector` detects Claude Code absence (5 trigger types) but CLI doesn't auto-act. Manual fallback only.
**What:** Wire FailoverDetector verdict → automatic mode switch in CLI (no operator confirmation required for offline fallback to local models).
**This is the most important Phase 1 gap** per warroom STATE S9.

### Seat 3 Tryout (qwen3.6:27b)
**Status:** Not yet validated. Recommendation documented in warroom STATE S9.
**What:** Validate qwen3.6:27b as Seat 3 substitute for offline mode. Requires chain restructure: gemma solo Phase 1, qwen takes Seat 3.
**Why qwen:** gemma has documented void-output failure mode (blocks it from synthesis seat). qwen think:True is structured chain-of-thought. qwen already first governance consultation model.
**Validation run needed:** Run a tryout mission with qwen in Seat 3. Grade output quality.

### GR11 Post-Cycle Governance Scanner
**Status:** Not implemented. Documented as Phase 1 gap 3 in warroom STATE S9.
**What:** Automatic drift check after every mission cycle. GR11 is the governance rule requiring post-cycle scan.

### Rebase Artifact Cleanup
**Status:** Pending from S8. Safe to delete.
**What:** `rebase-seq-editor.ps1` and similar rebase artifacts in warroom directory. Confirmed safe to delete.

---

## CATEGORY 3 — NAS/Infrastructure

### NAS Volume 3 (DX517 SHR1)
**Status:** Deferred ~2 weeks (new drives ordered/arriving). Task #8 in current task list.
**What:** Create Volume 3 on DX517 expansion unit using SHR1 with new drives.
**Prerequisite:** 6-agent review of `D:\NAS-BACKUP\REBUILD.md` before physical work begins (documented in operator-context.md Section 9).
**Memory reference:** project_nas_crash.md has all credentials and architecture.

### Windows Scheduled Tasks
**Status:** 11 tasks disabled. Script ready.
**What:** Run `C:\Temp\post-extraction-step12.ps1` AS ADMIN. Remaps N: homes→web, registers tasks.
**Note:** This was from the NAS extraction chain — the extraction completed 2026-05-14/15. This cleanup step was never run.

### BC1 Smoke Test
**Status:** Unverified from 2026-05-17 session.
**What:** POST /v1/assemble to wire-server.py at port 5010 with real InfiniteTalk output as revoiced_base + synthetic source + 2-chapter polished_chunks JSON.
**Prerequisite for:** text-to-video processor going live.
**NAS reference:** wire-server.py running at port 5010. InfiniteTalk output format confirmed in 2026-05-17 session.

---

## CATEGORY 4 — Media (auto-resolving / low effort)

### South Park S01-S25 ShieldBearer Import
**Status:** IN PROGRESS. Background poll+trigger script (b3j08cplj) running.
**What:** RDTClient building 363 file links from AllDebrid cache (hash 4c235de23a50a987e36b21039504420860fdd0e6, 259GB). Script will auto-fire Sonarr DownloadedEpisodesScan + Radarr DownloadedMoviesScan on completion.
**Note:** Movie file (South Park: Bigger Longer & Uncut) will be in same folder as TV episodes. Radarr scan should pick it up.

### Monster Hunter Re-search
**Status:** Triggered. Should auto-resolve.
**What:** 22GB 4K Bluray file was deleted. Re-search command 188844 was queued. Radarr will find a 720p version via the 4K-Block custom format (CF ID 26, score -10000 in HD-720p profile).

---

## CHAIN RUNS NEEDED (in order)

| Priority | Chain | Question File | Status |
|----------|-------|---------------|--------|
| 1 | FM-12 hook impl | Not written yet | Write then run |

---

## CHAIN RUNS COMPLETE (reference)

| Chain | Date | Verdict | Key co-fixes |
|-------|------|---------|--------------|
| chain-quality | 2026-05-14 | CONDITIONAL_APPROVE | qwen think:True, substrate at position 2, GPU per-agent config |
| c1-search-refinement | 2026-05-14 | CONDITIONAL_APPROVE | JINA_FETCH_N=1 for phase 1, query-pass pattern |
| c1-hook-language-agnosticism | 2026-05-14 | CONDITIONAL_APPROVE | Node.js .mjs migration (all 10 hooks) |
| agent-platform-design | 2026-05-14 | CONDITIONAL_APPROVE | 7-layer architecture, C1 PowerShell hook latency blocking |
| bootstrap-gate-fix | 2026-05-19 | APPROVE (all 6 seats) | Line 151 "both" → "all required files"; operator-context.md as 3rd required read |
| governance-passive-gaps | 2026-05-19 | APPROVE (confidence 0.88) | FM-11/FM-12 formation rules committed |
| container-optimization | 2026-05-19 | CONDITIONAL_APPROVE | 3 non-blocking concerns (see Category 1 above) |
| c2-tsa-spof | 2026-05-19 | CONDITIONAL_APPROVE (unanimous 6-seat) | D1 parallel TSA + D2 JSON OTS stub + D3 manifest v3 + D4 warroom 2s; Q1 EU Act open |
| c3-memory-unification | 2026-05-20 | CONDITIONAL_APPROVE (unanimous 6-seat) | D1 four-tier model + D2 routing protocol in core.md + D3 commit-triggered sync (pending) + D4 separate warroom workspace + D5 MEMORY.md audit (pending) |
