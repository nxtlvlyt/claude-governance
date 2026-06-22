# Conductor Session Handoff — muezzin engine upgrade + muddytires features
**Written 2026-06-18 by the Opus conductor, against verified substrate. THIS IS THE RESUME POINT.**

If you are a fresh instance with no memory of the session that wrote this: read THIS, then
`INBOX.md` (engine fix-specs), `PREFLIGHT-CHECKLIST.md` (proactive checks), and the receipts in
`_logs/*.receipt.md`. Verify everything against substrate — do not trust this doc over the files.

---

## THE WORK (two intertwined threads)
1. **Muezzin engine reliability "upgrade"** (what the operator keeps asking "is it done") — make the
   engine reliable AND PROACTIVE (verify every moving part BEFORE firing, not react after a failure).
2. **muddytires.ca features** — account (DONE+live), add-spot, reviews, profile, confidence, admin,
   security-hardening.

## DONE — committed / durable (verified)
- **Commit `59fcc06`** (muezzin-plugin, branch master): witness-cap fix (`orchestrate.mjs:361`,
  12000->`MUEZZIN_WITNESS_ARTIFACT_CAP||48000`, fixes the truncated-emission witness false-reject;
  witnessed guardian+laguna) + command-class verbatim path + autosplit recursion/exemption guards +
  `PREFLIGHT-CHECKLIST.md`.
- **muddytires.ca LIVE** — map+landing, deploy `ea13769f` (rollback `7b77010a`). Account auth worker
  LIVE at `muddytires-accounts.regulativity.workers.dev` (CSRF-gated, round-trip verified).
- **account-ui DONE** (js/account.js wired to /signup /login /logout /me).

## IN-FLIGHT — serial lane (1 lane; daemon PID changes on restart — read `_logs/daemon-status.json`)
Queue order in AUTORUN: **add-spot-ui-3.S1** (large map.html fold) -> ui-3.S2 (commit) -> reviews-ui-2
-> security-hardening (RE-SEQUENCED to here) -> profile-ui-1.S1/S2.
- **add-spot**: ui-1 + ui-2 BLOCKED (receipts in _logs). ui-3 = live re-fire (single canonical approach:
  fold submit into the EXISTING map.html reviewSpot flow, ONE flow not two), auto-split into S1/S2.
- **reviews**: ui-1 BLOCKED (reachability-gate false-fail — a synthetic POST /review on a fake spot
  returns {ok:false,"Spot not found"} which PROVES the endpoint is live; the gate wrongly read it as
  dead). ui-2 = re-fire whose Context fixes the {ok:false}=live rule.
- **security-hardening**: RE-SEQUENCED 2026-06-18 — it hardens js/add-spot.js + js/reviews.js, so it
  MUST run AFTER they are built. I originally (wrongly) queued it "independent"; it caused a 26min
  emission-empty grind hardening a not-yet-built file. Now after reviews-ui-2 in AUTORUN.
- **profile**: attempt-1 committed profile.html (`81ce012`) then split into S1/S2; children must be
  idempotent vs that partial commit.
- HELD: admin-moderation (UN-HOLD when ui-3 S1+S2 AND reviews-ui-2 DONE); confidence-badge (UN-HOLD
  when reviews-ui-2 DONE).

## NOT DONE — the real "upgrade" remainder (next FOCUSED session, not a long firefighting context)
- **Preflight MODULE** (daemon-integrated): only the spec (`PREFLIGHT-CHECKLIST.md`) exists. Build a
  module that runs the 8 checks at startup/before-firing and refuses/warns on non-GREEN. THIS is what
  makes the muezzin actually proactive (vs the conductor remembering to do it).
- **Cloud-seat-hang watchdog**: a hung cloud seat (minimax-m3) froze the daemon 13min past its own
  timeout this session. INBOX has the fix-spec: hard timeout-abort + heartbeat watchdog + circuit-
  breaker. HIGH priority — a moving part can silently freeze the whole chain.
- **Panel-quality**: 3 panel/gate failure classes this session — panel-divergence, reachability-gate-
  does-a-real-write, size-ceiling-splits-cohesive-UI-missions. All in INBOX.
- **Grounding SEARCH_BLIND**: RE-DIAGNOSE. My "cloud seats can't reach localhost SearXNG" theory was
  WRONG — search runs conductor-side (`seat_dispatch.mjs:393-395`). INBOX item (C).
- **Uncommitted engine pile** (durable-on-disk but NOT in git history): `executor.mjs`,
  `muezzin-daemon.mjs`, `seat_modes.mjs`, `seat_dispatch.mjs`, `git_steps.mjs`, `runtime_verify.mjs`.
  Review each diff, then commit. I deliberately did NOT blind-commit them (unreviewed). Do the review.

## DISCIPLINE THIS SESSION (operator-driven — carry it)
- **BE PROACTIVE, not reactive.** Run the PREFLIGHT-CHECKLIST liveness checks every beat; when a step
  grinds, dig into WHY (read the events) instead of waiting for x2. This session that caught a cloud
  hang, a conductor mis-sequence, and several false-fails before they cost more.
- **Don't make the operator the gate** on engineering calls (committing, queuing) — just do them (D2);
  surfacing a roadmap gate as "waiting on you" is blame-shifting.
- **Judge by deeds/receipts; never blind requeue.** FAILED x2 -> diagnose against the known failure
  classes -> corrected Hajj re-fire OR block-with-receipt. Never hand-build a deliverable or dispatch a
  one-off build agent (that is the same violation as building it inline).

## HOW TO RESUME (do this, in order)
1. Read this + INBOX.md + PREFLIGHT-CHECKLIST.md + _logs/*.receipt.md.
2. Verify daemon alive (`_logs/daemon-status.json`); run the 8 preflight liveness checks.
3. Judge the in-flight lane; keep it fed per the HELD conditions above.
4. The preflight-module + watchdog build is a FRESH focused session against PREFLIGHT-CHECKLIST.md +
   the INBOX watchdog spec. Review+commit the uncommitted engine pile.
