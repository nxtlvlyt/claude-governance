# CONDUCTOR-PORT-PLAYBOOK — standing up the muezzin/conductor system in a new harness

Authored 2026-07-11 (operator: "have we documented our process of building the conductor,
muezzin, framework and governance into another CLI? everything we have learned, all the
upgrades?"). Before this file the answer was "scattered across eight places." This file is
the single entry point. It is an INDEX + narrative: every lesson names where its full
receipt lives — read the pointed file before acting on a summary here (CLAUDE.md D12).

PROVEN ONCE: this playbook is distilled from the ONE completed port — Claude CLI
(muezzin-plugin, muddytires.ca) → agy/Antigravity (agy-muezzin, androidtv.tips),
2026-07-07 fork through 2026-07-11 conductor graduation. A third port (local-conductor,
or any new harness) should follow this order and update this file with what it learns.

---

## 1. What "the system" is — four layers, ported differently

| Layer | What it is | Portability |
|---|---|---|
| ENGINE | daemon, orchestrate, deconstructor/autosplit, mission_lint/MIQAT, run-mission, conduct-cycle, verdict panels, retros, preflights, checkpoints, containment, integrity guard | Plain Node + HTTP/subprocess. Forks nearly verbatim. Every engine gap fix carries over FREE. |
| MISSIONS SUBSTRATE | missions/*.mission.txt, AUTORUN.md, QUEUE.md, INBOX.md, STATUS-BOARD.md, result.jsons, _logs/ (retro, preflight, ledger, events) | File formats — copy the conventions, start the queue EMPTY (see §4 jurisdiction). |
| CONDUCTOR RAILS | hooks/gates that bound the conducting model: bootstrap gate, niyyah gate, stop ratchet, per-prompt debt injection, guaranteed-delivery rules files | HARNESS-SPECIFIC. This is the real port work, every time. See §5. |
| GOVERNANCE | CLAUDE.md directives, practice/canon/faiths, operator rulings, the seven laws | Text — but authority must be re-derived per jurisdiction, never cross-mounted (§4). |

The one-sentence thesis, paid for by the failed first agy attempt (2026-06-24/26):
**the system works because of its RAILS, not its scripts.** Advice-without-enforcement
reproduces the claims-not-deeds failure. Receipts: missions/agy-port-inventory.md
(fabricated data, unwitnessed "complete" claims); ~/.claude/plans/
rosy-percolating-treasure.md "Key design lesson".

## 2. The port order that worked (agy receipts, 2026-07-07 → 07-11)

1. **Prove the dispatch primitive first.** `agy --model X --print` had a dead-stdout
   receipt from 06-24; retest CURED it at v1.0.16 before anything was built on it.
   Law: re-test boundaries, don't inherit denials (memory: retest-boundaries).
2. **Fork the engine whole** into its own repo/dir (C:\Users\marka\agy-muezzin). Keep
   engine .mjs verbatim; swap only the provider rows (seat_dispatch waterfall).
3. **Declare the jurisdiction** (§4) BEFORE firing anything.
4. **Baton lock + single-writer**: CONDUCTOR-BATON per queue; daemons refuse to fire
   without it. Origin: parallel-Hermes repo races (memory: single-hermes-ruling).
5. **Smoke mission end-to-end** — deliverable trivial, ROUTING is the point; heartbeat
   receipts must show only the jurisdiction's allowed providers.
6. **Seat auditions before lock** — same bar as the local roster; rijal logs day one.
   Seat plan doc pattern: SEAT-PLAN-OPERATOR-ORIGINAL.md (configs never override it).
7. **Graduation ladder before autonomy** (§6). agy ran 18 beats to graduate; the
   receipts are the acceptance instrument for every future conductor.

## 3. Everything we learned — the lessons ledger (pointer per lesson)

ENGINE/MISSION LESSONS — full spec: muezzin-plugin/missions/QUEUE.md "2026-07-11 ENGINE
ITEM: encode the conductor lessons" items 1-14 (the N5 spec). Highlights with receipts:
- REQUEUE PROCEDURE (hard-won, complete form): amend text → parse-validate every command
  → refresh preflight AFTER EVERY NEW RETRO (class + mtime) → clear result/_sandbox/
  checkpoint (keep checkpoint ONLY if banked steps are correct versions of every re-run
  step — atv-11 attempt-4 receipt) → flip the FAILED token → VERIFY the flip → at 3+
  retros the gate also demands a mission-TEXT change (honest ATTEMPT-LOG note).
- node -e with require() dies in .mjs scratch materialization (scenic S1+S2 receipts) —
  pure PowerShell steps or MODULE DISCIPLINE literal-first-line mandates.
- Hollow witnesses: validations must assert CHILDREN/POSITION, not presence (atv-11
  panel receipt); explicit per-step validation_command is the standard both sides.
- Planner improvisation churn: pin verifies with dry-run-proven LITERAL commands
  (money-competitor 11-attempt receipt; mt-addspot ParserError receipt).
- Zero-DONE window = stop the line; FAILED marks are diagnosis debt with a due date
  (seventh law, conductor-core.md).
CONDUCTOR LAWS (all seven, each with its paid-for date): ~/.claude/rules/
conductor-core.md — the guaranteed-delivery layer. Port rule: a new jurisdiction gets
these as MECHANICAL conditions, not prose (see §5 and QUEUE items 8-9).
GOVERNANCE HISTORY: ~/.claude/GOVERNANCE-EVENTS.md. OPERATOR RULINGS (outrank
everything below CLAUDE.md): ~/.claude/rules/operator-rulings.md — the succession
sequence + N5 spec pointer ruling lives there (2026-07-11).
PORT-SPECIFIC RECEIPTS: ~/.claude/plans/rosy-percolating-treasure.md (planning notes,
recon, seat map); agy-muezzin/BUILD_STATE.md + STATE.md (fork build);
muezzin-plugin/missions/_logs/MISSION-LEDGER.md + _logs/retro/ (per-mission corpus).

## 4. The jurisdiction pattern (separate engines, shared substrate)

Operator architecture ruling 2026-07-07 (plan file): each harness gets its OWN repo,
OWN rulebook, OWN queue, OWN model roster — sharing only the work repos via git.
- Rulings do NOT cross jurisdictions silently: NO-Ollama-Cloud binds Claude-side;
  agy's rulebook permits cloud. When layers conflict, SURFACE both dates (fifth law).
- Never cross-mount governance dirs (the first agy attempt's ~/.agents pointed at
  ~/.claude files — the cross-editing receipt). Workspace scoping excludes the other
  jurisdiction's home.
- Continuity test (Directive 8): a fresh conductor session in EITHER jurisdiction
  cold-boots from STATE/QUEUE/board files alone and names where the other left off.

## 5. The rails port — the part that fails if skipped

Two proven approaches, in order of preference:
(a) **Rails in the SCRIPT (harness-agnostic — the plan of record, = N5):** conduct-cycle
    --json computes REQUIRED ACTIONS; the model RELAYS; the script executes only
    allowlisted verbs; everything rijal-logged. Proven by the qwen 5/5 relay audition
    (intake N4 receipt, conductor-core exception preamble). Build spec = QUEUE items
    1-14. This binds ANY model — Claude, Gemini, local — identically.
(b) **Harness hooks (per-CLI):** Claude Code has settings.json hooks (bootstrap gate,
    niyyah gate, stop ratchet, per-prompt debt injection — ~/.claude/hooks/*). agy HAS
    an equivalent live hook system: C:\Users\marka\.gemini\config\plugins\muezzin\
    (hooks.json: PreToolUse/PostToolUse/PreInvocation/Stop; LIVE-FIRE receipt
    2026-07-11 00:24). Lesson paid 2026-07-11: VERIFY a harness's hook surface before
    claiming it lacks one (operator caught the assumption). Known agy gaps: stop hook
    stubbed (has_marker=True), no bootstrap gate, static 2026-06-26 inject, no computed
    debt — QUEUE item 13 (REVIVE, DON'T BUILD).
Guaranteed-delivery principle (operator, 2026-07-11: "just because some things are
written down doesn't mean that a future instance will ever go read them"): every law a
conductor must obey needs a DELIVERY MECHANISM — harness-injected rules file, per-prompt
hook inject, or gate — never a file it is merely hoped the instance reads. This playbook
itself is delivered via the pointer in the QUEUE N5 entry + operator-rulings succession
ruling; a new jurisdiction must wire its own pointer day one.

## 6. The acceptance bar (how you know the port worked)

1. Smoke mission DONE with heartbeat receipts showing only allowed providers.
2. Executor audition head-to-head, graded, rijal-logged.
3. Conductor graduation ladder (instrument: agy-muezzin/SENIOR-QUALIFICATION.md;
   receipts: agy-muezzin/missions/_logs/senior-ladder.jsonl): streak of clean beats
   (10) + real diagnosis beats (G2 x2) + a REAL gate-recovery beat (G3) — the G3 must
   be a live gate block routed to the candidate with pointers only, no pre-supplied
   answer, independently verified. agy graduated beat 18, 2026-07-11.
4. The Directive-8 cold-boot continuity test (§4).
5. Local-conductor bar (operator ruling): the receipted qwen 5/5 relay audition.

## 7. Keeping this file true

This file changes when a port teaches something new — update it in the same session the
lesson is paid for, with the receipt pointer. If a section conflicts with newer substrate
(QUEUE spec, rulings), the newer substrate wins and the conflict gets fixed HERE, not
worked around. Stale playbook > no playbook is FALSE below this line: a wrong pointer
sends a future instance to build on sand — verify pointers when you consume them.
