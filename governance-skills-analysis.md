# Governance Skills Analysis — 7-Seat Deliberation Architecture Mapping

**Date**: 2026-05-20
**Session**: Phase 2 Implementation — Mission 5
**Status**: Complete Analysis

---

## Executive Summary

The four governance skills in `~/.claude/skills/` implement a **7-seat deliberation architecture** (not 6-seat — the executor seat is Seat 7, a separate Agent instance). Each skill maps to different slices of this architecture:

| Skill | Seats Used | Purpose | Speed |
|-------|------------|---------|-------|
| `chain-review` | 1, 2, 3, 4, 5, 6 | Verify `operator-context.md` accuracy | Full chain (2-8 hrs) |
| `deliberate` | 1, 2, 3, 4, 5, 6 | General governance questions | Full chain (2-8 hrs) |
| `deliberation` | 1, 2, 3, 4, 5, 6, 7 | Full 7-agent chain incl. executor | Full chain + implementation |
| `governance-audit` | 5, 6 (laguna + granite) | Quick spot-check / substrate gate | 3-15 min |

---

## Detailed Architecture Mapping

### The 7-Seat Deliberation Stack (Canonical)

From `~/.claude/canon/6agent-deliberation-stack.md` and `~/.claude/skills/deliberation/SKILL.md`:

| Seat | Model | Faith | Role | Dispatch Method |
|------|-------|-------|------|-----------------|
| 1 | gemma4:31b | `architect.faith.md` | Workshop — architectural breadth, first-pass concerns | Python streaming (timeout=32768) |
| 2 | qwen3.6:27b | `architect.faith.md` | Deep-dive — investigates Seat 1, SOTA research | Python streaming, `think:True` (top-level) |
| 3 | claude-sonnet-4-6 | `chain-architect.faith.md` | **Synthesis — in-context, NOT a dispatch** (two-phase protocol enforced) | N/A — this instance |
| 4 | laguna-xs.2:q4_K_M | `validator.faith.md` | Code review — structural audit | Python streaming OR MCP |
| 5 | granite4.1:30b | `governance_scanner.faith.md` | Governance audit — canon coherence, PASS/FAIL | Python streaming |
| 6 | nemotron-3-super | `auditor.faith.md` | Final verdict — assumption audit | Python streaming, `think:False` (top-level) |
| 7 | claude-sonnet-4-6 | `executor.faith.md` | **Executor — SEPARATE Agent tool call** | N/A — spawned by Seat 3 |

### Skill-to-Seat Mapping

#### 1. `chain-review` (v1.1)
- **Seats**: 1, 2, 3, 4, 5, 6 (full 6-seat chain, no executor)
- **Target**: `operator-context.md` verification only
- **Script**: `scripts/chain-review.py` (legacy, lower quality)
- **Preferred path**: `/deliberate scripts/deliberations/chain-review.md` (uses `deliberate.py` with GPU config, C3 prompt order, Jina Reader)
- **Critical issue**: `chain-review.py` has stale `think:False` for qwen (line 111) — should be `think:True` per C2 fix (bbb7952)

#### 2. `deliberate` (v1.1)
- **Seats**: 1, 2, 3, 4, 5, 6 (full 6-seat chain, no executor)
- **Target**: Arbitrary governance questions via question files
- **Script**: `scripts/deliberate.py` (modern, full features)
- **Features**: GPU per-agent config, C3 prompt order fix, Jina Reader, structured JSON output
- **Question file format**: Markdown with `## Substrate Files` and `## Search Queries` sections
- **Output**: `<TEMP>/deliberate/<slug>/` with phase-1-report.json, sonnet-synthesis.txt, phase-2-report.json

#### 3. `deliberation` (v1.3) — **Canonical 7-Agent Skill**
- **Seats**: 1, 2, 3, 4, 5, 6, 7 (full 7-agent chain INCLUDING executor)
- **Key difference**: Explicitly includes Seat 7 (executor) as separate Agent spawn
- **Dispatch pattern**: Node.js `.mjs` scripts (preferred going forward per canon)
- **Two-phase Seat 3 protocol**: Enforced by `pre-tool-use-seat3-phase.mjs` hook + laguna hard-fail
- **Output directory**: `C:\Users\marka\AppData\Local\Temp\chain-compaction\`
- **Governance**: `subordinate-to-scripture`, grounded in `canon/6agent-deliberation-stack.md + MASTER-GLOBAL-REPO-PLAN.md`

#### 4. `governance-audit` (v1.1)
- **Seats**: 4 (laguna) + 5 (granite) only — **2-seat quick scan**
- **Purpose**: Pre-substrate-edit gate satisfaction, spot checks
- **Speed**: 3-15 min on GPU
- **Dispatch**: laguna via MCP acceptable (small model), granite via Python streaming
- **Gate satisfaction**: laguna MCP dispatch satisfies `pre-tool-use-substrate.ps1`
- **Fallback**: `granite4.1:3b` if `granite4.1:30b` unavailable (NOT 8b — format drift)

---

## Antigravity CLI Integration Requirements

### Current State
The skills exist as standalone slash-command-style skills with:
- `bootstrap_sequence` arrays listing required reads
- `invocation` examples with `/skill-name` syntax
- No formal CLI framework integration

### Antigravity CLI Framework (Inferred from Context)
Based on operator-context.md references to `/deliberate`, `/chain-review`, `/governance-audit` as slash commands, and "Task 4 in governance-vision.md" for `/deliberate` slash command, the Antigravity CLI appears to be a **skill-based command dispatcher** that:
1. Reads skill `SKILL.md` manifests
2. Registers slash commands from skill `name` fields
3. Executes skill `invocation` procedures
4. Handles bootstrap sequences automatically

### Required Migration Actions

#### 1. Standardize on 7-Seat Terminology
- Update all skills: "6-seat" → "7-seat" (executor is Seat 7)
- `chain-review` and `deliberate` explicitly note "no executor seat" vs `deliberation` includes it
- `governance-audit` maps to Seats 4-5 (laguna + granite) — NOT Seats 5-7 as master plan states (correction needed)

#### 2. Node.js `.mjs` Dispatch Standardization
- **New skills**: Must use Node.js `.mjs` dispatch scripts (per canon)
- **Existing Python scripts**: `deliberate.py` and `chain-review.py` remain for active chains; do not rewrite mid-chain
- **Migration target**: Chain-compaction master scripts → Node.js `.mjs` canonical replacements

#### 3. Skill Manifest Updates (deliberation/SKILL.md v1.3 Extension)
Per master plan: extend v1.3, do not replace. Required additions:
- Antigravity CLI registration metadata
- Explicit Seat 7 (executor) spawn procedure
- Node.js dispatch script references
- Cross-skill delegation references (when to use which skill)

#### 4. Unified Bootstrap Sequence
All four skills share nearly identical bootstrap:
```
~/.claude/CLAUDE.md
~/.claude/practice/core.md
~/.claude/operator-context.md
~/.claude/canon/6agent-deliberation-stack.md
```
Plus skill-specific additions (faith files, scripts).

#### 5. Substrate Gate Satisfaction Pattern
Standardize the two-turn pattern across all skills:
- Turn N: `mcp__ollama-mcp__ollama_chat` with laguna (witness)
- Turn N+1: surrender articulation + Edit

---

## Migration Plan

### Phase 1: Skill Manifest Harmonization (Immediate)

| Action | Files | Confidence |
|--------|-------|------------|
| Update terminology: "6-seat" → "7-seat" in all 4 SKILL.md files | chain-review, deliberate, deliberation, governance-audit | 0.95 |
| Correct governance-audit seat mapping: Seats 4-5 (laguna+granite), not 5-7 | governance-audit/SKILL.md | 0.95 |
| Add Antigravity CLI registration block to each SKILL.md | All 4 skills | 0.90 |
| Document cross-skill delegation (when to use which) | All 4 skills | 0.85 |

### Phase 2: Dispatch Script Modernization (Node.js .mjs)

| Action | Files | Confidence |
|--------|-------|------------|
| Create canonical Node.js dispatch templates in `~/.claude/scripts/dispatch/` | New directory | 0.90 |
| Port `deliberate.py` Phase 1/2 logic to Node.js master script | `dispatch-deliberate.mjs` | 0.85 |
| Port `chain-review.py` to Node.js (fix qwen think:True) | `dispatch-chain-review.mjs` | 0.85 |
| Create governance-audit Node.js wrapper (MCP laguna + Python granite) | `dispatch-governance-audit.mjs` | 0.85 |
| Update deliberate/SKILL.md to reference Node.js dispatch as preferred | deliberate/SKILL.md | 0.90 |

### Phase 3: Antigravity CLI Registration

| Action | Files | Confidence |
|--------|-------|------------|
| Define Antigravity CLI skill manifest schema (if not existing) | New: `~/.claude/antigravity/skill-schema.json` | 0.75 |
| Register 4 governance skills in Antigravity CLI registry | Antigravity CLI config | 0.75 |
| Implement bootstrap sequence runner in Antigravity CLI | Antigravity CLI core | 0.70 |
| Implement two-turn substrate gate pattern in CLI | Antigravity CLI core | 0.70 |

### Phase 4: Deliberation Skill v1.3 Extension (Not Replacement)

| Action | Files | Confidence |
|--------|-------|------------|
| Add Antigravity CLI metadata block to deliberation/SKILL.md | deliberation/SKILL.md | 0.95 |
| Add explicit Seat 7 executor spawn procedure | deliberation/SKILL.md | 0.95 |
| Add Node.js dispatch script references | deliberation/SKILL.md | 0.90 |
| Add cross-references to chain-review, deliberate, governance-audit | deliberation/SKILL.md | 0.85 |
| Version bump to v1.4 (extension, not replacement) | deliberation/SKILL.md | 0.95 |

### Phase 5: Verification & Documentation

| Action | Confidence |
|--------|------------|
| Run deliberate.py chain-quality regression test | 0.85 |
| Run governance-audit on a substrate edit (verify gate satisfaction) | 0.90 |
| Document migration in operator-context.md Section 1 | 0.95 |
| Update MASTER-GLOBAL-REPO-PLAN.md with skill integration status | 0.80 |

---

## Critical Constraints (Must Preserve)

1. **Serial inference discipline**: api/ps check before EVERY dispatch — no exceptions
2. **Timeout=32768**: Non-negotiable for all large model dispatches
3. **qwen `think:True` top-level**: C2 fix (bbb7952) — chain-of-thought in `message.thinking`
4. **nemotron `think:False` top-level**: Prevents CoT consuming output budget
5. **Seat 3 two-phase protocol**: `sonnet-blind.txt` must exist before `sonnet-synthesis.txt` (hook-enforced)
6. **Seat 7 executor = separate Agent**: Never same instance as Seat 3
7. **No frontier models**: GPT/Gemini/Grok/GLM forbidden — local quorum only
8. **Docker AI disabled**: `EnableDockerAI=false` in Docker settings-store.json
9. **ollama stop <model>**: Only safe unload method; never `keep_alive:0`

---

## Open Questions for Operator

1. **Antigravity CLI location**: Where is the Antigravity CLI codebase? (`C:\warroom\cli.py` is the warroom CLI, not Antigravity)
2. **Skill registry format**: Does Antigravity CLI use a JSON registry, auto-discovery, or manual registration?
3. **Bootstrap automation**: Should Antigravity CLI auto-run bootstrap sequences, or remain manual per skill?
4. **Chain-compaction migration**: Should the `C:\Users\marka\AppData\Local\Temp\chain-compaction\` dispatch scripts be migrated to Node.js as part of this, or remain Python for active chains?

---

## Kiraman Katibin — Design Decisions Logged

| Decision | Confidence | Rationale |
|----------|------------|-----------|
| 7-seat terminology (not 6-seat) | 0.95 | Executor is Seat 7, separate Agent; master plan mandates |
| governance-audit = Seats 4-5 (laguna+granite) | 0.95 | Skill explicitly uses laguna (code review) + granite (governance), not validator+scanner+auditor |
| Node.js .mjs for NEW dispatch scripts only | 0.90 | Canon: "Apply going forward, and when authoring chain-compaction master scripts" |
| deliberation/SKILL.md v1.3 extend, not replace | 0.95 | Master plan explicit |
| Two-turn substrate gate pattern standardization | 0.90 | Hook enforcement verified; all skills must conform |
| Chain-review.py → deliberate.py migration for quality | 0.85 | chain-review.py is "lower-quality path" per its own SKILL.md |

---

*Analysis complete. Ready for Phase 2 implementation execution.*