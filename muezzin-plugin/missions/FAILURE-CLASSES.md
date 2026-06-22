# Muezzin Known Failure Classes — recognition + response (for a cold conductor instance)

Read this when a mission "fails." Most muezzin failures this era are FALSE-FAILS: the engine produced correct work but an
over-aggressive LLM/validation layer rejected it. **THE ONE HABIT: when a mission reports failed, check the DELIVERABLE deterministically
BEFORE believing the verdict — is it committed (git log)? does it pass node --check? does it meet Done-means by grep?** If yes, it's a
DONE-WITH-RECEIPT, not a failure. Built 2026-06-18 from the add-spot saga (5 attempts) + the day's receipts.

| # | Class | Recognize it by | Response |
|---|-------|-----------------|----------|
| 1 | **Witness truncation** [FIXED 59fcc06] | findings say "truncated"/"never shown being called" but the on-disk file is complete | Already fixed (orchestrate.mjs:361 cap 48000). If recurs, raise MUEZZIN_WITNESS_ARTIFACT_CAP. |
| 2 | **Verdict over-reject** (committed-correct-code) | result.json ok:False at phase=verify, BUT git shows the work committed + node --check passes + meets Done-means | Judge the committed code deterministically -> **DONE-WITH-RECEIPT** (quote node --check pass + the commit as refutation). Stop any pointless re-attempt. (account-ui, add-spot-ui-5) |
| 3 | **Reachability-gate-does-a-real-write** | step-1 `engine-exec` fail with a structured `{ok:false}` / "not found" from a worker probe | A structured {ok:false} (HTTP 200/400/422) = endpoint LIVE. Re-fire with Context forbidding synthetic-write liveness gates; use a READ probe or the documented contract. (reviews-ui-1, add-spot-ui-3.S1) |
| 4 | **Emit limit (in-place dense edit)** | seat-escalate-exhausted / emission-empty / empty 8-min opus timeout on a LARGE/minified file edit; file unchanged | Go **ADDITIVE**: new small file + a tiny additive `<script>`/hook; override at runtime. Never an in-place rewrite of dense minified code. (add-spot ui-4 -> ui-5; map.html is 358KB). Note: account-sized ADDITIVE map.html edits DO emit. |
| 5 | **Cloud-seat hang** | dispatch-heartbeat.log stuck + daemon-status ts NOT advancing + a cloud-seat attempt-start >6min past its timeout | kill the daemon PID + relaunch (MUEZZIN_ARCHITECT_ROUTE=panel + MUEZZIN_MAX_LANES=1). Usually transient (minimax-m3). |
| 6 | **Groundedness / runtime-verify misfire on code** | groundedness-flag or runtime-verify-fail on a CODE-authoring step where node --check passes | Deterministic check wins. runtime-verify FALSE-fails browser scripts (no window/document in Node) — Node-guard the file or DONE-WITH-RECEIPT. Search is conductor-side (seat_dispatch.mjs:393-395); the "cloud can't reach localhost" theory was WRONG. |
| 7 | **Panel divergence** | two competing step-descriptions authoring the SAME file differently | Re-fire with a SINGLE canonical approach specified (not "adapt or replace"). (add-spot-ui-2) |
| 8 | **Size-ceiling over-split** | a cohesive single-feature mission SPLITs into S1/S2 | Verify the children are coherent (usually fine); watch idempotency if the parent committed partial work. (ui-3, profile) |
| 9 | **Tartib not enforced** | a split child (S2) runs even though its predecessor (S1) FAILED | Block the moot child; the REQUIRES gate doesn't enforce predecessor outcome. |
| 10 | **Conductor mis-sequence** (self-inflicted) | a "harden/decorate X" mission grinds emission-empty on a not-yet-built X | Re-sequence it AFTER the mission that produces X. Check ALLOW-FILES dependencies before queuing. (security-hardening) |

## The deeper pattern
Classes 1, 2, 3, 6 are all the SAME root: **an LLM/validation check rejecting correct code.** The structural fix (INBOX, next-session
engine task) is **deterministic-first validation** — replace LLM-judgment with deterministic checks (compile/lint/grep-for-wiring/correct
HTTP read) wherever the criterion is mechanical; reserve LLM-judges for genuinely qualitative goals. Build that ONE thing and most of
this table stops happening. The rest (4 emit-limit, 5 cloud-hang, 9 tartib) are separate engine items, all in INBOX.md.

## How a cold instance uses this
1. A mission reports failed -> check the deliverable deterministically (git log + node --check + Done-means grep) FIRST.
2. Match the symptom to a row above -> apply the response.
3. Never blind-requeue; FAILED x2 -> diagnose against this table -> corrected re-fire OR DONE-WITH-RECEIPT OR block-with-receipt.
4. Never hand-build the deliverable or dispatch a one-off agent.
