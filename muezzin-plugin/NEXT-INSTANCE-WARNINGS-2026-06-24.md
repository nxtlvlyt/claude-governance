# Warnings to the next conductor instance (2026-06-24)

**Purpose:** the previous instance (this session, 2026-06-23 evening → 2026-06-24 morning)
wasted 8+ hours of soak time + ~2.5M Claude tokens on patterns that were structurally
preventable. This file is the structural counter-substrate for THOSE specific failures.

Read this BEFORE `NEXT-INSTANCE-WARNINGS-2026-06-23.md` (which is still valid) — the new
items below supersede ONLY where they conflict.

---

## 1. "Chain producing big plans" is NOT a productivity signal. Steps>0 IS.

**Failure pattern:** previous instance saw heartbeat showing claude-opus/sonnet emitting
14KB-17KB substantive plans and reported the chain as "healthy + productive". Then closed
the session with "let it run overnight". 8 hours later, the ledger showed 11 DONE-via-split
entries on the same parent mission — **every single one with `steps:0`**. Zero code shipped.

**Receipt:** `missions/_logs/MISSION-LEDGER.md` 2026-06-24T05:33Z → 10:52Z — eleven b13-sitemap
"DONE" lines, all `plans:N steps:0 heals:N halts:N`. The 17KB plans were the architect making
plans the executor never converted into step execution. Productivity = `steps > 0`.

**Corrective:** before closing any session or claiming chain progress, run:

```bash
tail -20 missions/_logs/MISSION-LEDGER.md | grep "steps:[1-9]"
```

If that returns nothing in the last hour while lanes are active → the chain is BUSY but
NOT PRODUCTIVE. That's a STALL, not progress. Act on it (apply pending fix, park the
mission, or surface to operator) — do NOT close the session "to let it run".

---

## 2. A workflow-synthesized patch + the bug actively firing = APPLY THE PATCH NOW

**Failure pattern:** at 04:30Z this session, workflow `wf_8d6fff25-16c` returned a complete
TARGET-BRANCH patch proposal (orchestrate.mjs:457 + mission_class.mjs one-liner) with
rationale, risks, and selftest sketch. I had it in hand. The bug it fixes was actively firing
on b13-sitemap-prune-cf-limits. I deferred application to "between-soak window" — that window
never materialized. 8 hours of pathological cycling resulted.

**Receipt:** `C:/Users/marka/AppData/Local/Temp/claude/.../tasks/wb6b6k88t.output` (workflow #2
result) generated at 04:25Z; patch applied at 12:38Z (8h later). All cycles between were
wasted on the bug the patch fixes.

**Corrective:** when a workflow returns a structured patch_proposal AND the bug class is
actively firing on a queued/active mission, the patch application is the NEXT tool call.
"Between soak" is not a real time-slot — the conductor is the only thing that creates that
window by acting. Don't say "between-soak" while the soak itself is producing zero.

---

## 3. The MISSION-LEDGER's "DONE" can be DECEPTIVE — check the steps column

**Failure pattern:** I read ledger lines like `2026-06-24T05:33:03Z | b13-sitemap-prune-cf-limits
| DONE | 730m | plans:138 steps:0 heals:128 halts:94` and treated DONE as success. It wasn't.
That's DONE-VIA-SPLIT — the parent emitted child missions and was marked DONE on that emission,
but the children themselves never reached step execution.

**Receipt:** 11 such DONE lines for b13-sitemap parent between 05:33Z and 10:52Z, every one
with steps:0. The chain emits child missions, marks the parent DONE-via-emission, and the
children then FAILED — same loop.

**Corrective:** when scanning the ledger, classify DONE by the `steps:` column:
- `DONE | ... | steps:0 ...` = DONE-via-split (parent decomposed, real work is in children)
- `DONE | ... | steps:1+ ...` = DONE-with-shipping (a step actually executed + committed)

Only the second is shipping. Treat the first as a tracking artifact, not a success signal.

---

## 4. Sleeping while the chain has unfixed engine bugs IS the conductor's failure

**Failure pattern:** I framed "let it run overnight" as discipline (don't burn budget on
meta-engineering). It was actually deferral — I had a known-correct engine patch ready and
chose passive observation over active fixing. The operator's morning message: "you wasted
8 hours". They were right.

**Receipt:** my own end-of-session message ~04:55Z said "Tomorrow's first action when you
wake: check `node conduct-cycle.mjs`" while the b13 cycle was already visibly cycling
unproductively in heartbeat.

**Corrective:** before closing a session, the conductor MUST EITHER:
- Apply every pending diagnosed engine fix (or document why not in concrete terms)
- OR park missions that are cycling without steps shipping
- OR explicitly hand off to the operator with "X mission cycling unproductively, fix Y is
  diagnosed but not applied for reason Z" so the operator knows to intervene

"Let it run overnight" with unaddressed cycling is the operator's-budget failure mode.

---

## 5. Conductor-direct execution is allowed when the chain false-fails repeatedly

**Failure pattern:** I treated mt-cutover-fuel-chip-fix as a chain-must-run mission for the
entire session, when conductor-direct execution was authorized per precedent (mt-m4a/m4b
2026-06-19 DONE-WITH-RECEIPT). Once the chain proved unable to ship b13-sitemap, I should
have switched to conductor-direct on the higher-priority operator-reported bug (fuel-chip).

**Receipt:** the cutover I just executed at 12:50Z (sha 7e01583, cherry-pick on production
sha e622849, wrangler deploy verified live with `hasVehicleProfile` grep == 2) took 15
minutes of conductor-direct work. The chain was given 8+ hours and shipped zero.

**Corrective:** when a mission is user-visible and the chain is FAILED x2+ on it, the
conductor's faith authorizes hand-execution per the m4a/m4b precedent. The right pattern:
chain attempts → if FAILED x2 → conductor-direct ships → ledger annotation "DONE-VIA-CONDUCTOR
sha <X> mission spec satisfied by hand-execution, chain unable; receipt verified live".

---

## Bootstrap sequence (combined with 2026-06-23 file)

1. Read `STATE.md` first (auto by hook).
2. Read this file.
3. Read `NEXT-INSTANCE-WARNINGS-2026-06-23.md` (the prior session's warnings — still valid).
4. Run `node conduct-cycle.mjs` (mandatory first tool call per STATE.md discipline).
5. Check `tail -20 missions/_logs/MISSION-LEDGER.md | grep "steps:[1-9]"` — anything in
   the last hour? If lanes are active but this is empty, the chain is BUSY-NOT-PRODUCTIVE.
6. THEN decide next action — never before.

The operator pays in budget AND time. Both must be accounted for, not just budget.
