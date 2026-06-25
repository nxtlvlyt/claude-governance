# Mission Inbox — dump freely, the conductor triages

Operator instruction (2026-06-09): Mark has many missions to queue and should NEVER
hold back to protect the conductor. Capacity is protected by STRUCTURE (this file),
not by the operator rationing his own ideas.

## How to use (Mark)
Add a line. Any format. Any device — edit here directly, via the Codeberg web UI
(codeberg.org/nxtlvl/muezzin-plugin), or just say it in any conductor chat and it gets
filed. One line is enough: "make X do Y" / "problem: Z keeps happening" / a URL and a
grunt. Raw is fine — shaping is the conductor's job, not yours.

## How it drains (conductor)
At every wakeup/session: triage NEW inbox items —
1. Shape: idea → Maqsad + niyyah (or a conductor-fix if it's small and spec'd).
2. Size: fits one mission, or splits.
3. Sequence: into QUEUE.md with its gate (or fires immediately if ungated and serial
   capacity allows).
4. Park: if premature, parked HERE with one line of why and what unblocks it.
Nothing fires straight from the inbox. Triaged items move out; this file stays short.

---

## NEW (untriaged)

- **BACKEND — moderation API (unblocks admin-moderation).** 2026-06-18: mt-admin-moderation-1 BLOCKED (receipt
  _logs/mt-admin-moderation-1.receipt.md) because there is NO endpoint to act on community content. The schema already supports it
  (`community_review.status` live|removed; `user_contributions.moderation_status` pending|approved|rejected|flagged) but the worker
  contribute-d1.js (E:\AI_Storage\muddytires-d1-wt) exposes only POST /spot, POST /review, GET /?count. BUILD: add an admin-role-gated
  moderation endpoint (e.g. `POST /moderate {target, target_id, action: approve|reject|remove|flag}`) that updates those status columns;
  deploy the worker (non-prod test like the others). THEN admin-moderation re-fires with the CORRECT contract path
  (E:\AI_Storage\muddytires-d1-wt\d1\RECEIPTS-WRITE.md — NOT frontend-wt/d1/, the wrong path that FAILED it x2) + the new endpoint.
  Likely command-class (wrangler deploy) once the endpoint is authored.

- **ENGINE BUG (HIGH) — windowed-edit NOT engaging on large files -> context-overflow HTTP 400.** 2026-06-18, reviews-ui-2 s2 (map.html
  review-display edit): `attempt-fail HTTP_400: "The prompt is too long: 265392, model maximum context length: 262144"`. The seat is fed
  the WHOLE 358KB map.html (~265K tokens) for an in-place edit, exceeding EVERY available model's context (262K cap; opus is only 200K).
  This is the DEEPER ROOT of the "map.html edits fail" saga (FAILURE-CLASSES #4): it's not only that dense in-place edits don't emit —
  the file physically DOES NOT FIT in any seat's context, so the edit can never even be attempted whole. There IS a windowedLargeFileForEdit
  helper (commit 2561abb) but it is NOT engaging for this step — the full file is still being sent. FIX (high priority, next-session): make
  the windowed-edit ACTUALLY engage for any target file over ~N KB / ~M tokens — send only anchor regions (the edit site + context), never
  the whole file; the apply step stitches back. Until then, ALL map.html (and any >250KB-context file) edits must be ADDITIVE/out-of-file
  (logic in a new js module, map.html only additively loads it) — that is why add-spot-ui-5 succeeded. Add to FAILURE-CLASSES #4.

- **ENGINE IMPROVEMENT — deterministic-first validation (loop-engineering principle, 2026-06-18, operator-sourced).** The real principle
  under the "loop engineering" discourse (Osmani/Cherny/Greyling): use DETERMINISTIC checks in the stop/validation condition wherever the
  acceptance criterion is MECHANICAL (compile / lint / test / HTTP-200 / required-symbol-present); reserve LLM-judge seats only for
  genuinely QUALITATIVE goals (UX quality, prose honesty). The muezzin is already PAST the naive self-grading-loop baseline — it HAS a
  separate witness (≠executor), a verdict panel, guardian+laguna, cross-run persistence, hooks, worktrees. So the fix is NOT "add a judge."
  The muezzin's #1 observed failure class this session is the OPPOSITE: FALSE-REJECTS by the LLM-judgment layer (witness-truncation [FIXED],
  verdict over-reject of correct code [account-ui DONE-WITH-RECEIPT], badly-designed deterministic gates [reachability-as-real-write killed
  reviews + add-spot-ui-3]). IMPROVEMENT (next-session engine task): audit the per-step witness + verdict + gate layer; wherever the criterion
  is mechanical, REPLACE the LLM-judgment with a deterministic check —
    - "is the file wired?" -> grep for the <script> tag + the init call (not an LLM reading a possibly-truncated emission)
    - "does it POST /spot?" -> grep the URL + node --check (not a witness opinion)
    - "is the endpoint live?" -> a READ probe (GET /?count) that treats a structured {ok:false} as LIVE (NEVER a synthetic write)
    - "did the commit land?" -> git diff --stat (already deterministic — good)
  This directly attacks the false-reject rate that cost most of 2026-06-18. Keep LLM-judges for the qualitative tail only. NOTE: this does
  NOT address the OTHER big failure this session (executor can't EMIT large/dense in-place edits — add-spot map.html); that's the
  windowed-edit/dense-file-edit engine-capability gap, a separate item below. (Also: do not let any doc call the muezzin an industry-SOTA
  "framework" — it's the operator's internal stack, not an external standard; that inflation was correctly flagged.)

- **ENGINE — per-step witness false-rejects large authoring.** Surfaced 2026-06-18 by mt-add-spot-ui-1 (receipt:
  _logs/mt-add-spot-ui-1.receipt.md); root-caused by an Explore survey of orchestrate.mjs.
  **(A) [RESOLVED 2026-06-18, witnessed guardian+laguna]** The witness model's PROMPT truncated the file under review to the first
  12000 chars (orchestrate.mjs:361 `String(artifact).slice(0, 12000)`), so a 468-line (>12KB) file was cut off and the witness
  false-rejected functions it simply couldn't see ("staged source is truncated... defined but never shown being called") — node
  --check passed, every flagged symbol was wired on disk. The engine already held the full file (cur = readTarget); only the prompt
  slice was short. FIX APPLIED: cap raised to `Number(process.env.MUEZZIN_WITNESS_ARTIFACT_CAP) || 48000` (~1500-line headroom; safe
  inside the nemotron-3-super 32K-ctx witness alongside the 8000-char staged-sources block). Guardian granite4.1-guardian:8b = yes;
  laguna laguna-xs.2 = APPROVE (NaN-guarded by `|| 48000`); node --check PASS; daemon restarted on it (PID 16828); mt-add-spot-ui-2
  re-fired under it. If a small local witness model is used (local-heavy mode), set MUEZZIN_WITNESS_ARTIFACT_CAP lower for its context.
  **(B) [CORRECTED — not a true bug]** The escalation is NOT unbounded: stepRetries (default 0) + maxRepairs (default 1) + a 2-rung
  seat ladder (sonnet->opus). The ~37min "loop" on ui-1 was each tier RE-RUNNING the big step and re-hitting the (A) truncation wall,
  each witness call slow on a CPU model. Fixing (A) moots this. Optional later polish: a clearer per-step FAILED-x2 when all tiers
  exhaust on the same reason.
  **(C) [OPEN — needs RE-DIAGNOSIS; my earlier hypothesis was WRONG]** groundedness-flag `<score>no</score>` / SEARCH_BLIND on
  steps. EARLIER HYPOTHESIS (now refuted, 2026-06-18 chain-health audit): "cloud seats can't reach localhost:8080 SearXNG." That is
  WRONG — the audit read seat_dispatch.mjs:393-395: **search runs CONDUCTOR-SIDE via the tool-call loop on THIS machine; the cloud
  model never touches localhost.** SearXNG IS up (curl :8080 -> 200, results>0). So the localhost-reachability theory does not hold.
  The real trigger of `<score>no</score>` is UNKNOWN — re-diagnose from the actual events (which seat emits the score, on what input,
  is it the witness groundedness gate mis-scoring valid work, or a genuinely unsourced emission?). Do NOT queue a "reachable grounding
  endpoint" fix — it targets a non-cause. Re-diagnose first (read the groundedness-scoring code + a real failing mission's events),
  THEN fix, witnessed. High leverage IF it's falsely tainting correct missions; verify that's actually happening before investing.

- **ENGINE — PHASE-1 panel-divergence on ambiguous approach freedom.** Surfaced 2026-06-18 by mt-add-spot-ui-2 (receipt:
  _logs/mt-add-spot-ui-2.receipt.md). When a mission says "the seats' call whether you adapt or replace" (freedom of means), and
  multiple valid approaches exist for the same deliverable, the panel sometimes generates TWO or more different implementations of
  that deliverable instead of converging. Example: mt-add-spot-ui-2 had step 2 and step 3 both authoring js/add-spot.js with
  different scopes. This violates the Done-means constraint ("there is exactly ONE add-spot flow").
  FIX DIRECTION (framework-layer): when a mission's freedom-of-approach creates ambiguity, the panel needs an explicit tiebreaker or
  convergence gate. Options: (1) the mission must specify ONE canonical approach (not "adapt or replace"); (2) add a panel-convergence
  step where the architects vote/merge/pick before step-level implementation; (3) tag the deliverable as "multiple valid approaches
  OK" in the Done-means, so divergence is not a defect. mt-add-spot-ui-3 uses option 1 (single canonical approach specified).
  Monitor whether ui-3 clears or if option 2/3 becomes necessary for future missions. DO NOT hand-patch divergence; fix at the
  mission-spec level or the panel-algorithm level.

- **ENGINE/MISSION-DESIGN — reachability HALT-gate does a real WRITE that fails referentially.** Surfaced 2026-06-18 by
  mt-reviews-ui-1 (FAILED x2; receipt _logs/mt-reviews-ui-1.receipt.md). The PHASE-1 panel, prompted by Context like "the worker is
  LIVE (proven)" + "deeds proven by receipts," generates a step-1 HALT-gate that does a SYNTHETIC write to the live worker to "prove"
  the endpoint. For POST /review this is structurally impossible to pass (it validates target_id against EXISTING spots; a fake spot
  -> `{ok:false,"Spot not found"}`), and the gate reads the structured {ok:false} as endpoint-dead -> kills the mission before any
  code is authored. SAME FAMILY as mt-add-spot's reachability gates (S1 has one for POST /spot — watch it; a POST /spot probe may
  instead CREATE a junk spot or fail attestation). Two-part FIX DIRECTION:
  (1) Mission-spec layer (used in mt-reviews-ui-2): Context must state that a structured JSON {ok:false} (HTTP 200/400/422) = endpoint
  LIVE; only connection-fail/5xx/timeout = dead; forbid synthetic-write liveness gates; prefer a READ (GET /?count) or the documented
  contract; never halt authoring on a probe.
  (2) Panel/engine layer (durable): the architects should not emit liveness gates that perform side-effecting writes with invalid
  referential data. A reachability check should be READ-only or interpret structured errors as liveness. Consider a standing rule in
  the architect faith / mission-construction guidance. DO NOT hand-fix per-mission forever — this is the third distinct gate/panel
  failure class this session (truncation [FIXED], panel-divergence, this); they point at a panel-quality upgrade.

- **ENGINE — a hung CLOUD seat can FREEZE the whole daemon past its own timeout.** 2026-06-18: minimax-m3 (Ollama Cloud architect)
  degraded mid-session (262s ok -> 239s timeout -> heal=1 retry HUNG 9+ min past its 360s timeout). The dispatch timeout-abort did NOT
  fire on the heal retry; profile PHASE-1 made ZERO progress for 13 min; daemon-status ts froze. Only the conductor's liveness check
  (dispatch-heartbeat.log stuck + ts not advancing) caught it; recovery = kill + relaunch (PID 35996). FIX DIRECTION: (1) enforce the
  dispatch timeout HARD — the heal-retry's 360s timeout was not honored, the cloud HTTP call must be aborted when it elapses; (2) a
  daemon watchdog: if dispatch-heartbeat is stuck > N min while state=running, self-abort the dispatch / self-restart so it never
  silently freezes; (3) a circuit-breaker that routes the panel OFF a cloud seat after K consecutive timeouts. This is the literal
  "a moving part can silently freeze the chain" gap — the core of the proactive-monitoring ask. HIGH priority for the engine batch.
  RECURRED 2026-06-18 ~21:25 with a DIFFERENT seat — kimi-k2.6 (data-audit-1.S1) hung ~2.3min past its 180s timeout, heartbeat frozen
  ~5min, daemon main-loop alive (ts advancing) but dispatch blocked; conductor liveness-caught + kill+relaunched (PID 27844). So it's
  NOT seat-specific (minimax-m3 AND kimi-k2.6) — it's the dispatch-timeout-abort not firing across cloud seats. 2 occurrences in one
  session = the watchdog is the highest-value self-heal after #1; the conductor is the only thing catching these.

- **ENGINE — size-ceiling splits cohesive single-feature UI missions (tuning + a partial-commit wrinkle).** 2026-06-18: BOTH
  mt-add-spot-ui-3 AND mt-profile-ui-1 hit the size ceiling on (re)plan and auto-split into S1/S2. The splits have been COHERENT
  (verified on ui-3), so not broken — but two observations: (1) TUNING: a normal UI feature's micro_queue (HALT-gates + authoring +
  witness-gates + commit) routinely exceeds MUEZZIN_SIZE_CEILING, so cohesive features keep fragmenting into 2 missions + REQUIRES
  chains + sequencing overhead. Consider whether the ceiling is too tight for code-repo UI work, or count gates differently from
  authoring steps. (2) WRINKLE: mt-profile-ui-1 attempt-1 COMMITTED step 2 (profile.html, commit 81ce012) and THEN attempt-2
  re-planned + split — so a mission can land partial work and then re-split, risking the split children re-doing/conflicting with the
  already-committed file. The split children must be idempotent against partial parent progress (read existing state before authoring).
  Low urgency (splits work); fold into the engine batch.

- **ENGINE — split REQUIRES/tartib gate does NOT enforce; a child runs after its predecessor FAILED.** 2026-06-18: mt-add-spot-ui-3.S2
  (commit step, `REQUIRES: predecessor S1 DONE`) was FIRED by the daemon even though S1 FAILED x2 — so the commit ran with nothing to
  commit (S1's authoring never landed). The tartib REQUIRES on the split child is not gating on the predecessor's actual outcome. Fix
  dir: the daemon must check the predecessor REQUIRES status (DONE vs FAILED) before firing a child; a FAILED predecessor should block
  or fail the dependent child, not let it run into a wall. Related to the known "REQUIRES auto-promote doesn't match by MISSION-ID"
  gap. Medium priority — it wastes a mission cycle and can commit incomplete work.

- **PATTERN — reachability-gate-does-a-real-write false-fail is SYSTEMIC (hit reviews AND add-spot).** The panel-generated pre-authoring
  HALT-gate that probes the worker with a real write now killed BOTH mt-reviews-ui-1 (POST /review, "Spot not found") AND
  mt-add-spot-ui-3.S1 (step1 engine-exec gate, likely POST /spot). It blocks BEFORE the real authoring runs. This is the strongest
  candidate for the panel-quality fix: the architect faith / mission-construction guidance must forbid side-effecting-write liveness
  gates and teach {ok:false structured}=live. add-spot has now failed 3x (orphan/divergence/gate), NONE reaching the actual map.html
  fold — if ui-4 fails too, the engine likely cannot land this feature unaided; escalate to operator with the pattern.

## PARKED (with reasons)

- **OPERATOR'S BIG JOB (2026-06-10, undisclosed):** Mark has a major task for the
  conductor to do PERSONALLY — while simultaneously conducting missions as muezzin —
  "when you get good enough." UNPARKS when the readiness receipts exist: M-CLEAN-1
  passed (clean mission cycle, honest ledger, witness-confirmed), MISSION-LEDGER.md
  rows showing self-healing without conductor intervention, conductor-share falling.
  Do not ask what the job is — earn the receipts and the operator will say.
  Whichever instance reads this: that is the bar.

- **nxtlvlcrypto.com** (operator, 2026-06-09, "lowest priority… maybe building that out
  one day") — owned domain, currently empty. PARKED because it has no Maqsad yet: a
  domain isn't a mission until there's an intent (content site? tool? affiliate?
  portfolio piece?). UNPARKS when Mark names what it's for — then it's a standard
  dossier→build through the factory, and the content engine (videos/posts) is the
  natural angle given the niche. Zero cost while parked; the domain just renews.

### MUDDYTIRES BACKLOG — externally gated (2026-06-18; in the system, awaiting their unblock)
These are part of "que everything" but cannot fire into a wall — each names exactly what unblocks it.
- **fire-ingest** (Cloudflare Cron Worker pulling CWFIS/NASA VIIRS into D1) — UNPARKS once the operator OKs creating the Cron Worker
  in his Cloudflare (real infra, his account). Command-class once OK'd; author with a fenced ```sh deploy block so the verbatim
  engine path runs it.
- **wire live frontend → D1 Workers** — UNPARKS on the operator's go to touch LIVE (his standing cutover rule; live scope is
  map+landing only today). The preview already calls the workers.
- **photos → R2 (spot photos)** — UNPARKS when the R2 perms wall is cleared (operator) — earlier attempts hit a permissions wall.
- **off-machine backup of the 1.4 GB DB tar** — UNPARKS on an upload path (fix R2 perms / install rclone / accept it stays on E:).
- **AI track (mt-25 NL-Oracle / mt-26 moderation / mt-27 POI-enrichment)** — missions already drafted in _blocked/; model decided
  (aimlapi + Gemma-4-31b). UNPARKS on the operator's AIMLAPI key rotation + a security review (the key was exposed). Rotation is
  identity-bound (his aimlapi.com dashboard — probed: no programmatic rotation).
- **community / social platform ("create once, post everywhere")** — the operator's biggest-leverage idea. Gated behind accounts
  live (the account UI/add-spot/reviews/profile missions are running now) + a cost decision: rent Post-for-Me ($10/mo) to validate
  him+wife first. UNPARKS when accounts land + the operator OKs the MVP rental. Port reference (don't rebuild): nxtlvlyt/website-pipeline.
- **map core → MapLibre GL (tilt/pitch/vector tiles)** — deliberate, resourced REWRITE of the whole Leaflet map core. PARKED as a
  future call; only if a modern tilting map becomes a core selling point. Path A (leaflet-rotate) already shipped.

- **ENGINE BUG (HIGH) — path-doubling in mkdir.** 2026-06-25: daemon b13 retry FAILED(x2) with `ENOENT: no such file or directory, mkdir 'C:\Users\marka\.claude\muezzin-plugin\missions\C:\Users\marka\.claude\muezzin-plugin\missions'` — the engine is `path.join(MISSIONS_DIR, missionPath)` when missionPath is already absolute. Reproduce: `node muezzin-daemon.mjs` with any AUTORUN.md entry that resolves to an absolute path. Fix: guard the join with `path.isAbsolute(missionPath) ? missionPath : path.join(MISSIONS_DIR, missionPath)`.

- **ENGINE BUG (HIGH) — spam-loop NOT actually closed despite selftest claiming so.** 2026-06-25: b13 marked FAILED(x2) at 19:56:34, but engine fired it AGAIN as `attempt 1/2` at 19:56:36 (2 seconds later). Selftest at `--selftest` claims "WITH the ledger, FAILED-x2 is NOT re-promoted; spam-loop CLOSED." Reality contradicts. Possible cause: ledger entry not being written before the next pick cycle, OR AUTORUN.md still references the mission and re-promotes from there, OR the dedup is by mission_id rather than file path. Daemon was burning cloud cycles in a tight loop on this for 28+ min until manually killed 2026-06-25 ~20:00Z. Selftest passes the synthetic case but the real environment fails it — gap between test fixture and production substrate.

- **ENGINE BUG (HIGH) — pickPromotion ignores FAILED prefix when same mission_id appears as both base AND splits.** 2026-06-25: AUTORUN.md has 54 b13-* lines, all prefixed FAILED after senior intervention. Engine STILL picks `b13-sitemap-prune-cf-limits.S2.mission.txt` as next mission. The selftest's "FAILED-x2 dedup via ledger" works on synthetic case but fails in production because: (a) the engine considers ALL mission.txt files in missions/ directory, not just AUTORUN lines — AUTORUN is a manifest, not the sole source; (b) the dedup may be by mission_id stem (e.g. "b13-sitemap-prune-cf-limits") not by file path — base + .S1 + .S2 are different files but maybe same mission_id; (c) AUTORUN-duplicates of b13 (27 lines all "BLOCKED-WITH-RECEIPT" then re-prefixed to "FAILED") might be confusing the count. The b13 mission family needs to be removed from missions/ directory OR the engine needs path-level dedup, not just mission_id dedup. Until fixed, no mission can be processed because b13 always pre-empts the queue.

- **OPERATIONAL — no way to "park" a mission without removing the file.** Operator/senior conductor needs a way to say "this mission is broken, ignore it, don't fire it again" without (a) deleting the mission.txt file, (b) blanket FAILED-prefixing every AUTORUN line. Proposal: add a `PARKED` terminal status to engine STATUS_RE alongside DONE/FAILED/SPLIT/RUNNING, and have pickPromotion exclude PARKED missions by path absolutely.
