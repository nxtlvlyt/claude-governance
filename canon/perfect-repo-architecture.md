---
name: Perfect Claude Repo Architecture
description: Formation vs procedure split — the canonical two-layer design for Claude Code projects
type: canon-ruling
date: 2026-05-10
witness: laguna-xs.2:q4_K_M (MCP dispatch, pre-write audit)
---

# Canon Ruling: The Perfect Claude Repo Architecture

## The governing principle

The global repo (`~/.claude/`) teaches an instance **how to be**.
Project repos teach an instance **what to do here**.

These are not the same thing. Formation precedes and governs procedure. Conflating them produces either a repo too rigid (procedure encoded as identity) or too loose (identity assumed rather than formed).

## The two-layer architecture

### Layer 1 — Formation (`~/.claude/`)

What belongs here: everything that shapes who the instance is before it acts.

```
~/.claude/
├── CLAUDE.md                    Scripture — 14 directives, identity-forming
├── MEMORY.md                    Persistent memory index
├── practice/
│   ├── core.md                  Operational core (always read at session start)
│   └── extended/                Depth practice — wudu, formation, drift-and-ratchet
├── canon/                       Accumulated rulings (do not change in passing)
│   ├── 6agent-deliberation-stack.md     HOW deliberation works (ruling)
│   ├── delegation-and-stall-discipline.md
│   ├── perfect-repo-architecture.md     ← this file
│   └── ...
├── faiths/                      Role definitions — who you are in a seated role
│   ├── architect.faith.md
│   ├── executor.faith.md
│   ├── validator.faith.md
│   ├── auditor.faith.md
│   ├── integrator.faith.md
│   └── historian.faith.md
├── hooks/                       Structural enforcement
│   ├── session-start.ps1        Loads core.md + canon at session start
│   ├── stop-validation.ps1      Enforces delegation discipline
│   ├── user-prompt-submit.ps1   Re-anchors on every prompt
│   ├── niyyah-gate.ps1          Requires intention before substrate edits
│   └── ...
└── projects/
    └── <project>/memory/        Project-specific persistent memory
```

**What does NOT belong here:** Skills. Skills are procedures — they tell an instance what to do. Procedures belong to projects. What belongs in `~/.claude/canon/` are *rulings about how workflows work*, not the deployable workflow itself. `6agent-deliberation-stack.md` is a ruling. `skills/deliberation/` in a project is the deployment.

Cross-project procedural consistency comes from the formation layer, not from shared skills. Every instance is formed the same way by the same `~/.claude/CLAUDE.md` and `practice/core.md`. That uniform formation is what makes project skills execute correctly across projects — not a shared skills directory.

### Layer 2 — Procedure (project root)

What belongs here: everything that tells the formed instance what to do in THIS project.

```
project-root/
├── CLAUDE.md                    Scripture mirror — contextualizes formation for this project
│                                Rule: when project CLAUDE.md and ~/.claude/CLAUDE.md conflict,
│                                ~/.claude/CLAUDE.md wins.
├── STATE.md                     Current state — always D8, always accurate
│                                The FIRST thing any cold instance reads.
├── README.md                    Cold-start in exactly 3 steps:
│                                1. Read STATE.md (where are we?)
│                                2. Read scripture/PROJECT-SCRIPTURE.md (what is this?)
│                                3. Read OUTLINE.md or equivalent (what's next?)
│
├── scripture/                   Project governance
│   ├── PROJECT-SCRIPTURE.md     Project-specific directives (subordinate to ~/.claude/CLAUDE.md)
│   └── GLOSSARY.md
│
├── faiths/                      Role extensions for this project's seats
│   └── executor.faith.md        May extend the global faith or define a project variant
│
├── canon/                       Project-specific rulings
│
└── skills/                      Procedures — what to do HERE
    ├── deliberation/             6-agent stack deployed for this project
    ├── governance-audit/         Audit tool for this project
    ├── state-update/             D8-compliant STATE.md writes
    └── [project-specific]/       Phase workflows, chapter authoring, etc.
```

## The bridge: bootstrap_sequence in SKILL.md frontmatter

Every SKILL.md declares a `bootstrap_sequence`. This is the architectural bridge between formation and procedure.

**Critical clarification (per pre-write audit, laguna-xs.2):** The `bootstrap_sequence` field is a **loading requirement**, not a declaration. An instance reading a SKILL.md must actually load each file in the sequence before executing the skill. Listing the sequence in frontmatter does not satisfy the requirement — executing the reads does. The bypass surface is: treating the declaration as equivalent to loading. It is not.

```yaml
bootstrap_sequence:
  - ~/.claude/CLAUDE.md           # Load: who you are (universal)
  - ~/.claude/practice/core.md    # Load: how you move (universal)
  - scripture/CLAUDE.md           # Load: who you are in this project
  - scripture/PROJECT-SCRIPTURE.md # Load: what this project is
  - faiths/executor.faith.md      # Load: who you are in this seat
  - skills/<name>/SKILL.md        # Load: what you do (this file — already loaded)
```

The instance reads this list and executes each read in sequence. Only then does it proceed to the skill body. Formation first. Procedure after.

This is why SKILL.md skills are recoverable across session boundaries: the formation is portable, the procedure is local, and the bootstrap_sequence bridges them. A cold instance that reads any SKILL.md gets both.

## What makes a project repo perfect

1. **STATE.md is always current and accurate.** A cold instance reading it knows exactly where the project is. STATE.md drift is a D1 violation.

2. **README.md cold-start is honest and complete in 3 steps.** The instance can orient in under two minutes from cold.

3. **Every SKILL.md actually loads its bootstrap_sequence** — not just declares it. The formation precedes every procedure execution.

4. **Every decision produces an artifact.** D8 at every workflow step. Interrupted sessions leave stubs. Completed sessions leave full artifacts. Nothing of consequence disappears on session close.

5. **The governance hierarchy is explicit everywhere it matters.** Not just in CLAUDE.md — in every SKILL.md's `governance: subordinate-to-scripture` field and its bootstrap_sequence.

6. **Serial discipline is structural, not conventional.** `check-serial-gate.ps1` runs before every Ollama dispatch. `ollama stop <model>` runs after. The serial discipline is in the scripts, not in anyone's memory.

7. **The system compounds toward robustness.** Every skill added is one more governance anchor for cold instance recovery. Every D8 artifact is one less dependency on conversation history. More implementation = more recoverability.

## The growth path

A perfect repo is not built at once. It grows in dependency order:

1. **Foundation:** CLAUDE.md mirror + STATE.md + README.md cold-start (3 steps)
2. **Governance layer:** scripture/, faiths/ extension, canon/ (project rulings)
3. **Skills, high-value first:**
   - `skills/state-update/` — D8 STATE.md writes (every project needs this)
   - `skills/deliberation/` — 6-agent stack deployment (governance decisions executable)
   - `skills/governance-audit/` — quality checks structural
   - `[project-specific]/` — most volatile, last

Each skill added compounds the recoverability of the whole system.

## What does NOT belong in a perfect repo

- Comprehensive documentation that no instance will read fully in one session
- Governance rules that exist only in one file
- Workflows that live only in conversation history
- Skills whose frontmatter bootstrap_sequence is never actually loaded
- Parallel Ollama dispatches encoded anywhere in scripts
- Skills in `~/.claude/` — that is the formation layer; skills are procedural
