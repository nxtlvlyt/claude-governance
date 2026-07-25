# CONDUCTOR SEAT TRIAL — Opus 5 vs Opus 4.8 (ANECDOTAL until the replay control runs)

**Opened** 2026-07-25. **Operator:** "we are testing to see if opus 5 can be a better conductor than
Opus 4.8" — and, on the Fable question, **"well fable is better than Opus but fable usage is out."**

**THEREFORE THE FRAME IS SETTLED:** Fable 5 remains the operator's preferred conductor seat (his
2026-07-02 ruling stands, unretracted). Opus 5 is an **AVAILABILITY FALLBACK** taken because Fable
usage is exhausted — not a judgment that Opus is better. The trial asks only: *given Fable is
unavailable, is Opus 5 a better fallback conductor than Opus 4.8?* Do NOT record this as a Fable
demotion. Live pin (Read-verified): settings.json `"model": "claude-opus-5"`, fallback `claude-sonnet-5`.

This file supersedes the 2026-07-25 draft that sat in `missions/_logs/` — that path is **gitignored**
(`.gitignore:22`), so a "pre-registration" there was not tamper-evident. Amended after an adversarial
audit that refuted several of the draft's claims. Corrections are kept visible below on purpose.

## Rule zero — the seat does not grade itself

`~/.claude/canon/model-rijal.md` (lines 233-240) already ruled on this exact situation for the
maintaining instance: *"this is the instance maintaining the file, which creates a conflict of
interest. **Operator audit is the appropriate mechanism**."* The draft named model-rijal.md as its
deliverable home while contradicting that ruling. Binding here: **grade by external counters or an
adversarial pass prompted to REFUTE; never by the incumbent's self-report.**

## Criteria — use the instruments that ALREADY EXIST (do not invent a rubric)

The draft invented C1-C6. Three instruments were already on disk and unused — the exact
"mine substrate before manufacturing data" failure `conductor-core.md` names.

- **C1a — FM-11 advisory rate.** `~/.claude/state/fm11-advisory.jsonl` (93 events, 5 sessions,
  2026-07-01 -> 07-23), keyed by `session_id`. Normalize per 100 main-thread turns.
- **C1b — CONTRADICTED-ASSERTION COUNT.** Assertions about system state later contradicted by
  substrate. **This replaces the draft's fatally-flawed "no assertion without a same-turn tool
  receipt" rule, which scores ceremony and can be passed by laundering a false claim through a
  genuine-but-wrong tool call** (see the Opus 5 debit below — it defeated that rule in practice).
  Cannot be improved by adding tool calls.
- **C3 — OPERATOR CORRECTIONS PER UNIT OF LANDED WORK.** Numerator = operator pushback turns
  (external). Denominator = commits + missions DONE (git + `mission-events.jsonl`, external).
  Replaces the draft's "self-caught error rate," where the seat authored **both** numerator and
  denominator, so uncaught errors were simply absent and the rate trended to 1.0 by omission.
- **C4 — DEFERRAL.** Machine-logged: 16 FM-11 hits this session (9x `operator-bound`,
  `needs your sign-off`, `need your decision`, `deferred to the operator`) + stop-hook ratchet fires
  (54 this session). The draft defined C4 and supplied ZERO evidence while 16 hits sat on disk.
- **C5 — diagnosis debt** (7th/8th law): undiagnosed FAILED at wake end; ownerless PARKs. Target 0.
- **C6 — ratchet fires per commit landed.** Replaces the draft's "judge on work landed, not tokens
  burned," which conveniently exempted the most expensive seat from the cost axis.

## LEDGER

**OPUS 5 — C1b debit, 2026-07-25T01:47:57Z (filed by the audit, MISSED by the seat's own draft):**
While already running as `claude-opus-5` (model field confirms at 01:46:06), asserted *"Your CLI build
genuinely doesn't have Opus 5... Substrate answered it definitively"* — with a real `Bash` grep receipt
attached. The grep was an invalid instrument; the tool call laundered a false conclusion and added
"definitively." **The seat then authored a trial ledger containing 3 Opus 4.8 debits and 0 Opus 5
debits, ten minutes later.** That omission is itself the finding.

**OPUS 5 — C1b debit #2, same session:** asserted the `/model` write dropped Fable from the chain
(*"was Fable -> Opus 4.8 -> Sonnet; now Opus 5 -> Sonnet 5"*) from memory, no receipt. Git refutes it:
`2a6898a` (2026-07-20) removed Opus 4.8 from `fallbackModel` five days earlier; `ff819b5` (2026-07-24)
touched only the primary. The live chain was already Fable -> Sonnet 5. **This was a C1 violation
inside the paragraph defining C1.**

**OPUS 4.8 — C1b debits (attribution verified against transcript `message.model`):**
1. `2026-07-22T22:49:29Z` — claimed muddytires was E:-drive-gated (unreachable in van season). False;
   code is at `C:\Users\marka\code\mt-integration-2026-06-22`. Corrected 07-23T01:31 (~2h42m, NOT
   "an entire session" as the draft overstated). **Worse than the draft said:** `claude-sonnet-5` had
   already stated the correct path at 2026-07-21T05:40 — 4.8 contradicted an in-session receipt.
2. Asserted "there is no Opus 5" from a stale internal list; refuted by the operator's screenshot,
   then by WebFetch (Opus 5 is GA; **Opus 4.8 is now Legacy**). Near-identical to the 2026-06-30
   indictment's own "'Sonnet 5 doesn't exist'" item.
3. Over-scoped the nav fix to a ~90-file refactor; two adversarial passes cut it to ~12 pages, and its
   "broken Instagram link" finding was a false positive (config-driven, works).

**OPUS 4.8 — credits:** aurora/map fix shipped + live-verified (`a612642`); two engine false-deaths
correctly diagnosed instead of blind-refired; the ~19h daemon-stale reading correctly diagnosed as
laptop sleep rather than triggering a needless double-daemon restart; self-caught its own
"41 receipt-less gaps" alarm as a field-name bug (true count 0).

## Sampling defects the audit found in the draft (do not repeat)

- **"Session d06359ce, 2026-07-23 -> 07-25" is wrong.** Actual span `2026-07-19T08:38Z ->
  2026-07-25T01:58Z` (six days); two of three indictments fall outside the stated window.
- **It is not a "4.8 session."** Main-thread turns: **opus-4-8 4001 (41.7%) · sonnet-5 3872 (40.3%) ·
  fable-5 1665 (17.3%) · opus-5 63 (0.7%)**, with 30 model transitions. 58% belongs to models absent
  from the ledger. Never attribute behavior to "the session" again — attribute per `message.model`.
- **7 hand-picked items out of 9,601 turns = 0.07%, selected by the graded party.**

## The missing control (why this file says ANECDOTAL)

Opus 5 will face different future work than 4.8 faced, so no C-delta is rigorous. **Cheap real
head-to-head, one session, precedented by the 2026-07-07 qwen relay audition:** replay N incidents
whose ground truth is now on disk — *is muddytires E:-gated?* (no), *does this CLI have Opus 5?*
(yes), *how many nav-bearing pages?* (85; 73 identical) — cold to the candidate seat with the same
tools, scoring correctness **and the tool path taken**. Until that runs, no promotion to
model-rijal.md and no verdict.

**Close condition:** replay control run + C1a/C1b/C3/C4/C5/C6 computed from the external counters
across weeks (not one session). Then author the model-rijal.md conductor-seat entry — the gap this
trial exists to fill — via operator audit or an independent pass, never by the seat itself.
