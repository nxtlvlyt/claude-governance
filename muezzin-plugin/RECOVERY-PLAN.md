# RECOVERY PLAN — written 2026-06-10 evening, by the drifted instance, for the fresh one
The operator asked "how do we recover." This is the answer, ordered. Execute top-down.
Everything referenced exists on disk (git-verified: zero deletions today).

## What needs NO session at all (already running)
- The daemon (PID at _logs/daemon.pid) keeps draining AUTORUN between sessions.
  agy-import + M28 were in lanes at write time; outcomes push to the operator's phone
  (ntfy topic nxtlvl-muezzin-rc9e4v) with real reasons + scoreboard.
- STATUS-BOARD.md self-renders. MISSION-STATUS.md is the numbered scoreboard.

## Step 0 — fresh session boots into (automatic, no action):
~/.claude/rules/operator-rulings.md (his law, loads every session) ·
MUEZZIN-SEAT-PLAN-LOCKED.md (the engine spec, 3 copies) · QUEUE.md · this file.
GHUSL applies: cold boot = full re-orientation; trust receipts, not this session's claims.

## Step 1 — CONVERT IDEAS → MISSIONS (the operator's core grievance: his ideas became
notes, not missions; he asked repeatedly and the conversion never happened)
- Read C:\vanlife\MUDDYTIRES-TASKS.md + QUEUE intake + SESSION-HANDOFF items 15-17.
- For each item: fireable-as-research-mission NOW (write mission file w/ REQUIRES,
  simple sequential number, append AUTORUN) / editor-session work (stays in
  SESSION-HANDOFF, say so) / conductor task (NAS checks etc — do them, receipt them).
- NUMBERING RULE: simple 1..N in MISSION-STATUS.md. The M28/M03.x scheme confused the
  operator badly (he believed missions 9-27 existed and were deleted). One list, plain
  numbers, no sub-numbers until the splitting engine exists.

## Step 2 — diagnose-or-block the two repeat failers (FRESH EYES ONLY)
- card-vanlife-muddy (5 cycles) + get-upgrade (4 cycles): receipts in their
  mission-events.jsonl. Real inputs ARE staged (vanlife-tree.txt; muddytires.html
  23,628 bytes verified live; bootstrap-current.ps1 8.1KB). If they failed again after
  that, the cause is engine-class — block them on the engine batch, do NOT requeue.

## Step 3 — THE ENGINE BATCH (makes everything else queueable; spec = locked seat plan)
ACCEPTANCE CRITERION FOR THE WHOLE BATCH (operator, 2026-06-10 evening: "instances
don't like this as missions, and only missions do work" — verified true): when the
batch lands, EVERY idea class the operator has must be missionable — research (works
today), gather/fetch (item 1), and CODE-IN-A-NAMED-REPO (scoped to a declared repo
root, witnessed, git-committed — the editor ideas in SESSION-HANDOFF items 15-17 are
the first three candidates). An idea class with no conveyor stalls on the operator
pushing, which defeats the system's purpose. "That can't be a mission" is no longer
an allowed answer — the allowed answers are "queued" or "engine gap named + queued".
1. Command-execution (#0): orchestrate runs 'command' steps itself via execReceipt —
   kills the fetch/listing failure class that ate 9+ mission cycles today.
2. Seat-plan wiring: 3 blind architects (glm/deepseek/minimax → opus/sonnet/haiku) +
   Opus integrator (→nemotron-3-ultra→local) + role-aware Claude fallback (nemotron-3-
   super = Opus-as-witness but NOT in phase 3 where it needs a different fallback) +
   3-auditor phase 3 (deepseek/glm/nemotron-super → sonnet/haiku/opus → local).
3. Sub-mission splitting (architect splits oversized missions; conductor stops hand-splitting).
4. Stale-gate cleanup (EVENT-002): strip gpt/grok/gemini/glm workers from hook/canon
   text + PreToolUse DENY on those tools (the operator was hurt by this twice today).
WITNESS every diff (laguna direct API; MCP wrapper returns canned greetings — don't cite it).

## THE MASTER PRINCIPLE OF 2026-06-10 (eleven receipts in one day)
Every fix that moved into CODE held: the deny gate, the engine-exec path, the tool-loop
cap, the pwsh witness, the conduct-cycle orders, the one-writer validator. Every fix
that stayed PROSE was ignored: the one-writer prompt rule (3 identical kills), the
plan-only-reads mission note, the literal-bytes wording (partial). When a rule matters,
the builder's question is never "where do I say it" — it is "which validator/gate/script
ENFORCES it, and what error does the violator receive." Prompts steer; only code stops.

## STANDING RULE — THE ABSENCE CHECK (operator diagnosis 2026-06-10 evening: "why can't
## you catch these things" — because every gate judges what EXISTS; nothing judges what
## is MISSING; the operator caught 5 foundation gaps in one evening that no gate flagged)
Before ANY gated build unparks (#11 Layna, #12 androidtv, the editor's day-video, the
big job): a COMPLETENESS-CRITIC mission runs first — backward-chain from the finished
goal, enumerate every dependency (knowledge/tools/decisions/credentials/artifacts),
mark each EXISTS/QUEUED/MISSING-UNQUEUED, and convert every MISSING item to a queued
mission. An empty MISSING list = failure to look, not success. Mission #19 (Layna) is
the template. The conductor never answers a foundations question from chat — it fires
the critic and reads the tree.

## Step 4 — M-CLEAN-1 + the gates that open
First mission through plan→implement→witness→verdict APPROVE→DONE = M-CLEAN-1 receipt.
Then the Layna gate auto-fires (M01.1 + S1-lite 3/3) and website work (the business)
flows. Notify the operator it FIRED; never ask permission.

## Standing context the successor must hold (from today's receipts)
- The operator was hurt today: plans flattened 3x, fake numbering, banned workers
  dispatched, ideas never queued, false "23.6KB staged" claim. Every fix that held was
  a GATE, not a promise. When a hook conflicts with operator-rulings.md, the RULING wins.
- Keep replies SHORT. Lead with the answer. He is often on mobile.
- The scoreboard (MISSION-STATUS.md) refreshes EVERY beat — he asked for 2 days.
- Engine-review debt: today's many engine diffs got per-diff laguna passes; a full
  independent review pass is owed.

## The operator's one action
Close this session; open a fresh one (or just walk away — the daemon works without us
and the phone reports). The fresh session reads this file and starts at Step 1.
