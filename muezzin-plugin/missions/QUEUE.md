# Mission Queue — conductor's open work (substrate, not memory)

## OPERATOR RULING 2026-06-12 ~04:00 (his words: "we need to drop down to 1 mission at a
## time to manage our usage until Tuesday"): MAX_LANES 2 → 1 until Tuesday 2026-06-16.
## Applied: muezzin-daemon.mjs MAX_LANES=1 + restart (PID 116740, "up to 1 parallel
## lanes" receipted in daemon-events.log 03:42). RESTORE to 2 on/after 2026-06-16 by his
## word only — the standing 2-lane ruling in operator-rulings.md is the restore target.
## OPERATOR RULING 2026-06-12 ~11:30 (his words: "everything that's not related to the
## automated website pipeline and production I need to be putting that on hold until
## Tuesday when our usage resets so the sports group and anything else... the website
## pipeline and the video editing process takes precedence"): SCOPE-HOLD until Tuesday
## 2026-06-16. CG-INCREMENT STANDING ORDER SUSPENDED (not just downshifted — the
## corollary below is superseded until Tuesday). Mission queue triaged: pipeline/editor
## missions run; the rest carry HELD-until-2026-06-16 tags in AUTORUN (damm holds are
## DEFERRED debts, witnessed by this entry — never waived). RESTORE everything by his
## word on/after Tuesday.
## COROLLARY (conductor judgment 05:10, receipted not silent): the CG 45-min increment
## gate conflicts with this usage ruling — a conductor-direct port increment every 45m
## burns more Claude tokens than the mission lanes do. Until Tuesday: CG increments
## downshift to ~one per 3h (or when operator-idle time genuinely allows); the 45-min
## gate nags are answered on the board, not with token burn. Restore full cadence with
## the 2-lane restore. The standing order itself is NOT dropped — espn lift landed
## a151b4f7 this hour proves it.

## SUCCESSION PLAN — Fable retired 2026-06-22 (operator, 2026-06-10): make the process
## model-proof in 12 days. Principle: the less the conductor does, the less its model
## matters.
## ELEVATED (operator ruling 2026-06-10 ~10:15): "use Fable's resources to build the
## most SOTA plans/substrate a local LLM could take over from" — succession artifacts
## OUTRANK ordinary conducting for the remaining window. Fable-block order:
## (1) conduct-cycle.mjs [BUILT+SELFTESTED 8/8 this session; first live sweep ran clean
## and auto-flagged the kimi thinking-burn — receipts in session transcript], (2) owed
## engine pass (kimi thinking
## fix + #30 token capture + diff review, due today), (3) purification-state.mjs +
## hook-health, (4) seat-prep pack a+b (formation authoring), (5) Sonnet rehearsal
## ~June 20, (6) local audition = acceptance test. The gates are already model-agnostic (caught a frontier conductor ~10x on
## 2026-06-09). Ordered work:
1. **Finish the purification layer (days 1-2):** purification-state.mjs rebuild (fm11's
   ceremony pattern is proven and repeatable) + hook-health detector wired into
   session-start. A blind successor is the only truly dangerous successor.
   TUNING NOTE from live fire: fm11 re-flags its own quoted output ("I remember" inside
   the guard's receipt quote) — exclude quoted/code spans in a follow-up pass.
2. **Fix the 3 daemon validator bugs** (.ps1 impl-extension, EISDIR dir-deps,
   multi-file verify) so research+installer missions run end-to-end — then ANY conductor
   just writes missions and reads receipts.
3. **CONDUCTOR.faith + operating manual (the load-bearing deliverable):** tonight's
   lessons as rails for the weakest occupant — boot (Fajr auto-gated) → re-create the
   status cron (session crons die; this goes in the boot instructions) → read
   daemon-status + AUTORUN → fire missions → judge receipts → write state → close
   short. Include the failure museum: looks-done bias, dead-asks-stay-dead, assert-
   without-read (now hook-enforced), marathon-only-for-surgery.
4. **Layna cycle run conductor-light (days 3-7):** the M2/M3 work IS the rehearsal —
   target ≤50% conductor share, proving the machine carries the weight regardless of
   who conducts.
5. **SUCCESSION REHEARSAL (by ~June 20, while reversible):** a full operating session
   with a Sonnet-class conductor while Fable still exists as fallback — the conductor
   seat gets AUDITIONED like any other seat (rijal for conductors, logged per-turn).
   Operator history says Sonnet follows this governance well; verify with receipts,
   not recollection.
5b. **THE REAL BAR (operator ruling 2026-06-10): "this process needs to be so good a
   LOCAL model could be in your seat."** Sonnet-succession is the June-22 milestone;
   local-conductor is the design target that makes every decision correctly biased:
   judgment must keep DRAINING out of the seat into substrate. Mechanism: a
   CONDUCT SCRIPT (conduct-cycle.mjs) that does mechanically what the conductor now
   does by hand each cycle — read daemon-status + events + heartbeats, compute stall
   flags (heartbeat-age > budget), format the board report, list required actions per
   the faith's rules (requeue-on-small-fix, block-on-structural, never-loop) — so the
   seat RELAYS and APPROVES instead of derives. The cycle sweeps the Fable conductor
   runs today are already 90% script-shaped; freeze them into code. A seat whose every
   move is read-script -> relay -> approve-flagged-action is a seat qwen3.6:27b can
   hold. Local-conductor audition = the final acceptance test of the whole governance
   thesis: formation in substrate, not in weights.
6. **June 22 boundary ceremony (already specified in practice/core.md):** record new
   model_version in CURRENT-STATE.md, ghusl, re-validate key governance behaviors
   before any governance-depth work. The framework already knows what to do at a
   version boundary — the successor just has to be walked into it by the boot path.

## TOP PRIORITY — REBUILD fm11-assertion-guard (protects EVERY future instance)
The gate that catches conversational assert-from-memory-without-Read drift was CORRUPTED
June 5 and UNREGISTERED — DEAD the entire 2026-06-09 session. That deadness is WHY the
Fable-5 conductor asserted-from-memory ~12 times unchecked ("direct API fine", "3 bugs",
"Layna needs photos", "MCP has no waterfall") — operator caught each one by hand; the
hook would have caught them structurally. The next instance inherits this hook's STATE,
not this session's chastening: dead hook → it fails identically. Rebuild from the legible
logic in the corrupted dump (regex memory-assertion patterns + read-watcher current-
session-Read evidence + deny), re-register in settings.json on UserPromptSubmit + ollama
dispatch, self-test (assert-without-read → deny; assert-with-read → allow). This is the
substrate fix for "the one after you will fail the same way." Governance act: full
ceremony (wudu/niyyah/surrender + witness) — it IS a hooks/ substrate edit.
Sibling corrupted-and-dead hooks to rebuild same pass: purification-state.mjs (wudu-tier
gate). Both are the formation-enforcement layer; both died June 5.

## INTAKE 2026-06-10 (conductor session after the ~06:44 PC RESTART — initially
## misdiagnosed as a NAS crash; operator corrected: the NAS crash was weeks ago,
## recovered ~May 14. The reboot killed sessions+daemon and dropped the N: mapping;
## the NAS itself never went down today.)
- **LAYNA GATE — ROADMAP CONDITION, NOT AN OPERATOR ASK (corrected 2026-06-10 ~13:05;
  the operator is NOT the trigger — the conductor checks the conditions and unparks
  AUTOMATICALLY).** M01.1 (missions/m01-1-layna-dossier-assembly, written+ready) fires
  when BOTH hold: (a) **M-CLEAN-1 receipt exists** — one mission has completed the
  full 3-phase cycle clean (plan → implement → witnessed steps → verdict APPROVE →
  honest DONE on the ledger, no conductor hand-holding), proving the engine that will
  build Layna's site actually works; and (b) **S1-lite ingestion 3/3** — the
  vanlife/muddytires card lands DONE (2boots ✅ + regulativity ✅ already). Check both
  at every DONE notification / status beat; when both hold, append M01.1 to AUTORUN
  and notify the operator it FIRED (not ask permission). Operator may override either
  direction anytime, but silence ≠ blocked. The website-first ruling still governs
  PRIORITY (Layna outranks androidtv/non-critical foundations when it fires).
- **M28.0 DirectionRV competitor study QUEUED to AUTORUN** (research-class; feeds
  muddytires backlog C:\vanlife\MUDDYTIRES-TASKS.md — consolidated from the dead
  muddytires CLI session + operator's Facebook thread drop).
- **#29 CLAUDE-TIER WATERFALL — BUILT + WITNESSED + LIVE-PROVEN 2026-06-10 ~10:05.**
  Operator's seat map as ruled: Sonnet↔qwen3-coder-next (executor), Opus↔kimi-k2.6
  (architect/validator). seat_dispatch.mjs: attemptClaude (claude CLI print-mode,
  async execFile, stdin prompt, tree-kill timeout) + tier between cloud heals and
  local fallback; kill switch MUEZZIN_CLAUDE_TIER=off. RECEIPTS: under live 429 →
  "PROVIDER: claude-opus CONTENT: ok" (heartbeat 13:5x); after quota reset, same test
  → "PROVIDER: ollama-cloud" (cloud takes back per-dispatch, proven both directions).
  WITNESS: laguna direct-API verdict REVISE — finding 2 (grandchild survives Node
  timeout, orphaned quota burn) FIXED with manual timer + taskkill /T; findings 1/3/4/5
  answered by receipts (stdin-fed prompt, shape confirmed, tree-kill = abort path).
  MCP-wrapper laguna returned canned greetings 2x (stale-wrapper class, NOT cited).
  Daemon restarted on new engine PID 61656. STILL OWED: full engine-review pass within
  one day (standing rule); guanaco cutover after a passing canary (deployed, port 8081,
  dashboard live; needs operator's ollama.com session cookie for quota readout).
- **KIMI THINKING-BURN FIX — LANDED + WITNESSED 2026-06-10 ~10:51.** TRUE ROOT CAUSE
  (deeper than first diagnosed): think:false was ALREADY SENT — kimi ignores it on the
  v1 endpoint and reasons 40-70K chars; the fixed 8192 output budget starved content.
  FIX: seat.max_tokens override (clamped 1024-65536, laguna finding 4) + architect
  planning seat = 32768 (deconstructor.mjs). ALSO LANDED same pass: #30 prerequisite —
  attempt-ok heartbeats now carry real tokens=prompt+completion (usage accumulated
  across the tool loop). WITNESS: laguna direct-API REVISE → finding 4 honored (clamp);
  finding 2 (parser break) REFUTED by deterministic test 4/4 (suffix at line end,
  parsers are substring regexes); finding 3 answered (ceiling ≠ spend; kimi generates
  the reasoning regardless — the fix stops paying for it TWICE). Daemon restarted
  PID 44972; ntfy clean-format notify also activated. VERIFY NEXT BEAT: zero new
  EMPTY_CONTENT_THINKING lines + tokens= visible in attempt-ok.
  (original entry follows:)
  repeated attempt-fail kind=EMPTY_CONTENT_THINKING — 45-71K chars of reasoning per
  FAILED planning call, multiple per mission. This is what ate the cloud quota
  (rate-limited 13:4x). Fix class: planning dispatches get structured-output/JSON
  format constraint + larger output budget or think-suppression for kimi; the heal=1
  retry already succeeds — make heal=0 succeed. Engine change → witness review.
- **#30 USAGE-REPORT + PROJECTION (operator request 2026-06-10):** (a) capture the API
  response's usage tokens in attempt-ok heartbeat lines (attemptProvider drops
  data.usage today — 3-line touch, BATCH INTO the owed engine pass with the kimi
  thinking-burn fix, one witness review for both); (b) usage_report.mjs — standalone
  reader over dispatch-heartbeat.log + per-mission events: tokens per mission per model
  per phase, mission-class cost comparisons, failed-attempt burn (kimi quantified),
  rolling burn-rate; (c) projection: burn-rate x guanaco live quota readout (needs
  operator cookie in dashboard) = "out of usage in ~N hours" line on the status beat
  + STATUS-BOARD. SCOPE NOTE: guanaco sees only proxied traffic — Ollama Cloud after
  seat cutover; the Claude tier bypasses it (CLI->Anthropic, no quota API) so Claude
  visibility comes from our heartbeats, not the dashboard.
- **ENGINE PASS COMPLETE — ALL LIVE 12:14 (daemon PID 83804). Three fixes in one
  restart:** (1) tool-loop cost cap (below); (2) WITNESS SHELL → pwsh/PS7 in
  execReceipt (receipts: agy-import + vanlife-muddy witness-halted on
  "'Get-ChildItem' is not recognized" — cmd.exe judged PS-flavored validation
  commands; arg-array execFileSync, no quoting surface, && proven live; laguna
  APPROVE); (3) PLANNER APPEND-RULE in QUEUE_INSTRUCTION (receipt: m28
  integrity-block WEAKENED-VERIFICATION — append-steps must carry the target file
  as a context dep or the full-file-emitting executor silently drops earlier lines).
  All three FAILED missions requeued onto the fixed engine (vanlife-muddy re-firing
  immediately). NOTE: fetch-class steps remain structurally impossible for seats —
  improvement #0 (muezzin executes command steps) is still THE missing engine piece;
  conductor pre-fetched artifacts as the interim pattern.
- **PROMPT-SIZE DIET — FIX BUILT + WITNESSED 11:5x, was awaiting restart, NOW LIVE (see above).**
  attemptProvider: MAX_TOOL_ROUNDS=6 (past cap the request omits tools — seat answers
  from gathered context), tool results trimmed to 8K after round 2 (early reads keep
  full 20K), TOOL_LOOP_CAP throw if a server emits tool_calls past cap (laguna witness
  finding 1 — termination belt; finding 2 by-design: ≤2 early reads at full size;
  findings 3/4 confirmed correct). RESTART CONDITION: first mission completion OR
  quota refresh, whichever first — NOT during the 429 window (re-planning would land
  on Opus). Expected effect: the 714K-class call drops to ≤ ~6 rounds × bounded
  transcript. VERIFY POST-RESTART: max tokens= per call on the next 10 attempt-oks.
  (history below:) DIAGNOSIS CORRECTED 11:30
  (executor.mjs read: per-dep framing already capped 30K chars / 200 dir entries —
  framing is NOT the bug):** tokens=713998 is the SUM across the seat's tool-call
  loop — every file_read/search round re-bills the whole growing transcript
  (attemptProvider while-loop, usage accumulated per round). FIX TARGETS: (a) cap
  tool rounds per attempt (e.g. 6) — throw into heal path beyond it; (b) trim tool
  results echoed into the transcript (file_read already 20K — consider 8K for loop
  rounds past the 2nd); (c) check Ollama Cloud prompt-caching support (would zero
  the re-bill). Fix lands on disk + witnessed; daemon restart at first lane boundary
  (mission completion) so paid mid-implement progress isn't discarded. Original finding:
  receipts: executor qwen3-coder call tokens=174552+4359 (174K prompt) AND kimi
  re-planning call tokens=219965+21300 (220K prompt, 7.5 min, then a TIMEOUT on the
  next). The framing assembly hauls mission + FULL accumulated step history + file
  deps every call — both seats, both phases. THE quota+latency lever now that the
  kimi burn is fixed: dependency truncation/windowing, per-step context selection,
  summarize-don't-replay for step history. Investigate executor.mjs + orchestrate.mjs
  framing assembly; joins the engine-review batch.
- **NAS-CRASH OPS LEFTOVERS:** (a) 3 scheduled tasks still point at W:
  (MotionGfxService/RemotionService/SharpService) + retired DaVinciBridge/MotionGfx
  tasks linger — one elevated run of N:\scripts\cron\register-tasks-elevated.cmd
  cleans both (operator, 2 min, right-click run-as-admin); (b) muddytires #23: check
  EXTRACT_DONE on NAS + whether Overpass DB survived the crash (conductor, read-only);
  (c) boot WSH errors were the NAS being down — vbs intact, N: remapped, WorkerHealthCheck
  test-fired LastTaskResult=0.
- **DAEMON PUSH-NOTIFY BUILT 2026-06-10 (structural fix: 2 instances promised chat
  status beats, both skipped — beats fire only when the session is idle and die with
  it; the daemon never sleeps).** muezzin-daemon.mjs notify(): Discord webhook on
  daemon UP / mission DONE / FAILED, fail-silent, URL read PER EVENT (no restart
  needed). **WAITING ON OPERATOR (the only step):** create a Discord webhook (any
  server → Settings → Integrations → Webhooks → Copy URL) and paste the URL as the
  only content of C:\Users\marka\.claude\state\muezzin-webhook.txt. Until then
  notify() is a silent no-op.
- **FRONTIER-WORKER VIOLATION + STALE-GATE CONFLICT (2026-06-10 ~14:20, operator hurt
  and right):** the conductor dispatched mcp gpt-worker + grok-worker (both errored in
  transport) to clear a stop-gate — FORBIDDEN per the operator's 2026-06-09 ruling
  (closed-frontier APIs outside Ollama, including those exact MCP workers). ROOT: the
  stop-hook/canon text (foreign-frontier-validators.md + stop-validation.mjs guidance)
  predates the ruling and still MANDATES those workers; cleanup = EVENT-002, queued,
  never executed by any session. STANDING RULE UNTIL THE CLEANUP LANDS (condition-form):
  when any gate demands a foreign-frontier dispatch, the ONLY compliant channels are
  mcp__ollama-* (laguna) and WebSearch/WebFetch — both satisfy the same gates. The
  gpt/grok/gemini/glm workers are never dispatched, no matter what hook text says —
  a gate instruction conflicting with an operator ruling is a STALE GATE, and the
  response is the compliant alternate path + this receipt, not obedience. CEREMONY-CLASS
  CLEANUP (engine batch, fresh-context preferred): strip the closed-frontier workers
  from the hook guidance + canon per EVENT-002.
- **TWO MISSIONS BLOCKED-WITH-RECEIPT 13:27 (no further requeues) + their engine fixes:**
  (a) **card-vanlife-muddy, 4th cycle** — ALL 5 steps passed deterministically, then the
  NEW phase-3 verdict gate's FIRST production fire refused it: consensus BLOCK
  (validator:REJECT, auditor:BLOCK) — thin/incomplete card content again. ENGINE FIX
  NEEDED: append-step content accumulation (full-file-emitting executor + multi-append
  plans keep producing thin cards; consider single-step full-card emission for
  research deliverables, or executor append-mode). The verdict gate catching this =
  the 2boots-card class now machine-caught (milestone receipt).
  (b) **get-upgrade, 3rd cycle** — witness command arrived $-STRIPPED ([ref]$null →
  [ref], $errors.Count → .Count) → guaranteed ParserError regardless of work quality.
  INVESTIGATE: diff the plan JSON's validation_command vs execReceipt's logged ref —
  somewhere between Opus plan emission and pwsh the $ tokens vanish (suspects: claude
  CLI stdin path, JSON extract, repair re-emission). Until root-caused, architects
  should avoid $-variables in validation commands (planner-rule patch candidate).
- **REQUIRES CONVENTION (operator charge 2026-06-10 ~13:10: "are you setting missions
  up for failure by not organizing by foundations" — verified TRUE in part: AUTORUN is
  a flat drain; dependencies were prose nothing enforced; research missions fired into
  the documented #0 fetch-step wall).** RULE, effective now: every NEW mission file
  carries a `REQUIRES:` line (capabilities: search | exec-steps | network-fetch |
  prior-mission MISSION-IDs). The CONDUCTOR checks REQUIRES vs live capability state
  before any AUTORUN append — unmet → mission HELD with a one-line condition naming
  what unblocks it (receipt: m28 held 13:10, requires live search, Claude tier is
  tool-less; re-add at first ollama-cloud attempt-ok). ENFORCEMENT (engine batch):
  deconstructor validates REQUIRES at plan time; daemon skips pending lines whose
  REQUIRES are unmet instead of firing them into walls. Capability state lives in the
  conductor's head today — conduct-cycle.mjs should compute it (429-active = no
  search/fetch; #0 unbuilt = no exec-steps) so a local conductor inherits the check.
- **VERIFY PHASE — BUILT + WITNESSED ~12:55, ON DISK awaiting daemon restart (restart
  at vanlife-muddy completion; then retro-verdict that card through the new phase
  before trusting it for the Layna gate).** orchestrate.mjs: defaultVerdictPhase —
  validator(kimi)+auditor(deepseek) read the ARTIFACTS vs the mission's done-means,
  verdict contracts → mergeVerdicts gate; consensus≠APPROVE → mission fails with
  findings; throwing phase fails SAFE; omitted-artifact floor = REVISE (laguna
  finding 2 honored); serial seats kept deliberately (GR10 local-fallback tail —
  finding 1 declined with reasoning); findings-feed-forward to re-plan = documented
  v1 limit (finding 3, queued). Selftest 13/13 incl. 3 new phase-3 gates. Claude map
  now covers ALL verdict seats (Sonnet) so a 429 can never skip verification.
  ORIGINAL GAP RECORD (operator catch 2026-06-10 ~12:40, verified
  vs ACCEPTANCE.md + orchestrate.mjs):** the governing spec (operator 2026-06-09,
  criteria 1+2) is THREE model phases — Plan → Implement → adversarial VERIFY
  (validator/auditor seats, blind-eval, producer≠verifier, verdict_merge) — THEN the
  muezzin's deterministic gate. The shipped loop runs Plan → Implement → deterministic
  gate only; verdict components are built+tested but NEVER dispatched by orchestrate
  (grep receipt: no dispatchSeat for validator/auditor in the loop — why deepseek/
  minimax/glm/nemotron-ultra logged zero calls today). LIVE COST RECEIPT: the 2boots
  card passed deterministic checks while missing the capability inventory — exactly
  the question only a model Verify seat can ask ("does this satisfy the done-means?").
  BUILD: after a mission's steps complete, dispatch validator+auditor with verdict
  contracts on the mission artifacts vs the Maqsad/done-means; merge via verdict_merge;
  non-APPROVE → heal pass or FAILED-with-findings. Claude-tier map should cover these
  seats (Sonnet) for outage continuity. Witnessed engine change; sequence FIRST in the
  engine batch — it is acceptance-criteria work, due before June 22 like the rest.
- **2BOOTS CARD ADDENDUM NEEDED (operator catch 2026-06-10 + card read):** the verified
  card covers portal modules/pricing-funnel/data-model and critiques the admin page's
  FILE STRUCTURE (monolith warning L108) — but does NOT inventory the 13+ admin tabs as
  a CAPABILITY SET, the portal-editable pattern (customer manages own content/pricing —
  the thing the operator said the library should surface unprompted), or
  pricing-by-SOTA-search. PORTAL-EXTRACT (#14) depends on that inventory. Small
  research-class addendum mission once lanes free; the card stays valid, incomplete.
- **NTFY CHANNEL LIVE 2026-06-10 (replaces the Discord plan — operator hates Discord):**
  topic nxtlvl-muezzin-rc9e4v on ntfy.sh; muezzin-webhook.txt holds the URL; daemon
  notify() speaks both ntfy plain-text and Discord JSON (clean format activates at next
  daemon restart — bundle with the engine pass). VERIFIED TWO-WAY: test push received
  on the operator's phone AND his reply ("Got it") read back off the topic by the
  conductor. QUEUED FOLLOW-UP — PHONE→INBOX BRIDGE: a poller (daemon cycle or the
  status beat) GETs ntfy.sh/<topic>/json?poll=1&since=<last-id>, appends any operator
  message to missions/INBOX.md NEW section with timestamp+source tag, tracks last-id
  in a state file. Operator drops mission ideas from his phone anywhere; triage rule
  stays the same (nothing fires from INBOX directly). Small build; after engine pass. (verified: no stitch entry in .claude.json) —
  remains a queued setup item below; it has never worked in any session.

# (original queue below)

## PRIORITY RULING (operator, 2026-06-09): WEBSITE-FIRST
Missions that lead to the best websites outrank foundations — people are WAITING on
sites, and websites are most of the business. Foundations proceed only where they sit
on the website critical path, or between website beats. Concretely:
1. **M2-LAYNA starts NOW, not after corpus.** The corpus gate on M2 was wrong: the
   dossier needs BRAND-TO-SITE Phase 0 + her materials + a books smoke-test — not the
   full pattern library. The library enriches M3 and can land in parallel.
2. **Planning-bug bypass available immediately:** orchestrate accepts an injected
   deconstructFn — the CONDUCTOR can hand it a pre-validated micro_queue (conductor
   plans, muezzin implements+witnesses+commits). Website missions need not wait on the
   architect-seat failure investigation.
3. **Corpus S1-LITE pulled forward — and now GATES M3 (operator refinement
   2026-06-09: "finish ingesting before building"):** pattern cards for 2boots/vanlife/
   muddytires/regulativity. M2 dossier work proceeds freely; **M3-LAYNA build waits for
   S1-lite** — the 2boots card must capture the PRICING-BY-SOTA-SEARCH + portal-editable
   pattern (operator named it; the library should have surfaced it unprompted — that
   miss is the proof ingestion belongs before building). Full census/inventory/library
   still slides behind the Layna chain.
4. agy-import, seating init, /get, doctor → between website beats.
5. Open intake: OTHER waiting customers ("some people are waiting") — names go in
   INBOX.md or said in chat; each becomes an M2 instance behind Layna.
6. **M-ANDROIDTV** (LOW priority, DEADLINE 2026-07-07; mission file
   E:\AI_Storage\website-pipeline\missions\m-androidtv.mission.txt): Mark's own
   androidtv.tips off Wix → static Astro on CF Pages. Before-capture DONE 2026-06-09
   (homepage/blog/news/shop + blog-feed.xml — content is ~1 post; Wix pages are
   ~1MB each = before/after perf ammunition). Domain Wix-registered (paid to 2028,
   no DNS risk-taking; never cancel Wix pre-propagation). Sequenced behind the Layna
   chain; must START by ~June 25 for the deadline.

Updated 2026-06-09 by the Fable 5 conductor session. Each item becomes a
*.mission.txt fired via run-mission.mjs, or a direct conductor fix with receipts.
The wakeup loop harvests this file; a fresh conductor session resumes from it.

## SESSION NOTE (2026-06-09 close)
This session's live MCP process predates the ollama-mcp waterfall fix — witness calls
returned empty 3x with laguna loaded. The wrapper fix is on disk and in git; a fresh
session's MCP reconnect activates it automatically. The integrity gate correctly
rejected the empties — no witness theater occurred. Census attempt 2 PID is 575512
(the PID below is attempt 1's, retained for provenance).

## RUNNING
- **P0-CORPUS-S0** (census) — detached PID 580492, mission file
  missions/p0-corpus-s0.mission.txt, sandbox missions/p0-corpus, logs
  missions/_logs/p0-corpus-s0.*. Wakeup monitors. On success: fire S1 archaeology
  per the census verdicts (split per-source if large).

## DONE 2026-06-09 — P0-CORPUS-S0 (census): COMPLETE. Mission attempt 3 (post-fix)
planned cleanly and committed 5/6 steps; seat-written API partials were placeholders →
conductor assembled the REAL sources.json from session-verified receipts
(missions/p0-corpus/sources.json: 15 sources, 3 named gaps). Lesson banked below.

## MILESTONE M-CLEAN-1 (operator asked "when is the first mission 100% done with
## auto-heal + auto-advance + honest ledger" — 2026-06-09). ACCEPTANCE (falsifiable):
ONE mission runs plan→implement→self-heal→commit→DONE, the AUTORUN ledger shows DONE
(not a mislabel), AND the daemon advances to the next — all confirmed by a foreign-tribe
witness reading the receipts, not by the conductor. GATED ON exactly 3 fixes (all
surfaced 2026-06-09 by running):
  (1) marking bug — outcome re-match fails on RUNNING-prefixed line (DONE→FAILED lie);
  (2) multi-file verify step — split, or allow a dir/glob witness;
  (3) readDep EISDIR — handle/ reject directory dependencies at validation.
re-run card-regulativity + card-vanlife-muddy through the fixed pipeline = the proof.
SEPARATE, LATER milestone: AUTO SUB-MISSION SPLITTING (architect splits oversized
missions itself; tonight the conductor split by hand). Not required for M-CLEAN-1.
NEAREST HONEST DATE: next working session fixes the 3 bugs + re-runs = M-CLEAN-1
candidate; witness verdict makes it real. No date I control beyond that — a session
has to run.

## NIGHT-SHIFT TRUE OUTCOMES (marking bug lied; disk is truth — 2026-06-09 ~01:55)
- card-2boots: **TRUE DONE** — pattern-card-2boots.md, 8.7KB, all sections, file-cited.
  (Bug overwrote its DONE with FAILED.) Needs only a next-session quality skim.
- agy-import: **TRUE PARTIAL-STRONG** — 5 artifacts (anti-patterns 13KB, salvage 12KB,
  verdict-table, inbox-entries); halted on a multi-file verify step. Usable now.
- card-regulativity: **TRUE PARTIAL** — card exists but thin (faith section only; missing
  worker + single-file sections). RE-RUN after the verify-step + content-witness fixes.
- card-vanlife-muddy: **TRUE FAIL, useful** — executor tried to READ A DIRECTORY
  (C:\vanlife) as a file → EISDIR. BUG: readDep must handle dir deps (enumerate, or
  reject at validation). RE-RUN after fix.
- get-upgrade: was still running at cycle time.
NEXT-SESSION FIXES (join engine-review): (1) marking bug — outcome-match fails because
the line is RUNNING-prefixed when re-found (DONE→FAILED mislabel); (2) multi-file verify
steps (deconstructor should split or allow a dir-glob witness); (3) readDep EISDIR on
directory dependencies. All three are daemon/engine bugs the night surfaced by running.

## OWED — ENGINE-REVIEW (retroactive, FIRST ACT of next session; operator question
## 2026-06-09: "who checked your work tonight, since you didn't want to use the chain")
Tonight's muezzin ENGINE diffs (containment, sandbox-repo, research-class relaxation,
singleton, events surface, seat_dispatch thinking fix — commits 82b39b5..c7728ad) were
checked by: my self-tests + the deterministic syntax gate + behavior-gates on me — but
NO independent model reviewed the diffs. Review dispatch attempted twice tonight
(laguna via MCP) — blocked by the session's pre-fix wrapper (empty returns; fix is
committed, activates on session restart). NEXT SESSION FIRST ACT: dispatch the diff
review (laguna or cloud seat, verdict-form) — priority: the containment relaxation in
deconstructor.mjs (security-relevant). STANDING RULE (condition-form): engine-code
diffs receive independent seat review within one day of landing; un-reviewed engine
diffs older than that are a governance event for the ledger.

## QUEUED — muezzin improvements (from P0-CORPUS attempt-1 failure, 2026-06-09)
0a. **DAEMON SINGLETON LOCK (from the 00:30-00:38 triple-daemon race):** THREE daemon
   processes ran concurrently (restart kills missed spawns), racing AUTORUN.md —
   double-FAILED marks, refires of failed missions. Fix: pidfile lock at startup
   (exists+alive → exit), heartbeat into daemon-status.json. The pidfile doubles as an
   INSTANCE REGISTRY entry for the dashboard (operator asked: "can we see how many
   instances are running at the same time" — yes: pidfiles + transcript-mtime heartbeats
   for Claude sessions + api/ps for local models + guanaco for cloud in-flight).
   Daemons STOPPED until this lands — the queue drains via conductor/wakeups meanwhile.
0b. **RESEARCH-MISSION RULES (from agy-import's x2 plan failures — the validator is
   code-mission-shaped):** two rules block research missions structurally: (i) 'edit'
   steps demand exactly 1 IMPL-extension file — research deliverables are .md (found 0);
   (ii) path containment bans absolute paths even in context_dependencies — research
   missions must READ external sources (.agents/*, brain/*). Fix: a mission-class flag
   (research): .md counts as the deliverable file; absolute context_deps allowed
   READ-ONLY (targets stay contained, always). Until then: research missions route to
   conductor or (with operator go-word) Claude workflows. agy-import marked
   blocked-on-this in AUTORUN.
0c. **DISPATCH HEARTBEAT + HARD TIMEOUT (bug #5, receipts 2026-06-10 10:04):** two lanes
   hung 39-46 min SILENT (get-upgrade in plan since 09:19, regulativity mid-step since
   09:26; daemon CPU 6s = sockets parked, no timeout firing). From outside, "working"
   and "hung" were indistinguishable — the conductor had to set manual deadlines and
   restart. Fix: seat_dispatch emits dispatch-start/dispatch-end events into the
   mission's events file AND enforces a hard wall-clock cap per call (e.g. 10 min) that
   throws into the heal path. Watchdogs are for the watcher, not the worker.
0. **COMMAND-STEP EXECUTION (top of the improvements list — from S0's hollow receipts):**
   action_type:'command' steps currently route to the executor seat, which can only
   WRITE FILES FROM TEXT — so "call this API" steps produced schema-shaped fiction that
   passed parse-witnesses. Fix: orchestrate executes 'command' steps via execReceipt
   (the muezzin runs the command, output IS the artifact), seats never fabricate data
   files. Also: data-producing steps need content witnesses (non-placeholder checks /
   held-out value assertions), not just parse checks. Receipts: S0's anythingllm.json
   placeholder ("workspace-id","Workspace Name") vs the real API's 'business-books'.
1. **Implement sub-mission splitting** — MISSION_ARCHITECTURE promises budget-triggered
   splits; deconstructor has no schema/mechanism for it (live failure receipt:
   p0-corpus.mission.result.json, "no valid JSON micro_queue" on an oversized mission).
   Until built, the CONDUCTOR splits manually (as done for S0).
2. **Persist architect raw output on plan failure** — deconstructor discards failed
   seat output; diagnosis had to infer. Small change: write plan-attempt-N.raw.txt
   into the sandbox on every failed attempt.
3. (Lower) **seat_dispatch fallback transparency** — local-fallback (laguna-as-architect
   suspected in attempt 1) should be visible in the mission result, not only inferred
   from api/ps residue. The waterfall-labeling rule from the ollama-mcp wrapper applies
   here too: identity changes are never silent.

## MISSION-ID CONVENTION (operator question 2026-06-10: "if they don't have mission
## numbers how are sub-missions queued" — answer: today by FILENAME only; the
## number→file join lives nowhere durable). RULE, effective for all NEW mission files:
- Every mission file's SECOND line: `MISSION-ID: M<parent>.<sub>` (e.g. M03.2 =
  mission #3 from MISSION-SUMMARY.md, sub-mission 2). Conductor missions: sub=0.
- Filenames going forward: m03-2-card-regulativity.mission.txt (existing files keep
  their names; their IDs get added in-file at next touch).
- The daemon's board + retro lines read MISSION-ID from the file and display it, so
  the operator's board answers "which lane is part of which numbered mission" without
  asking anyone. (renderBoard/writeRetro enhancement — apply at next daemon code touch;
  not worth killing the running lanes for alone.)
- MISSION-SUMMARY.md numbers are STABLE and never reused — they are the registry.

## QUEUED — boot-context integrity (operator questions 2026-06-10, both same root:
## content that isn't INJECTED is dead weight; content that OVERFLOWS isn't injected)
- **SESSION-START PAYLOAD DIET:** the boot payload (~21-30KB) exceeds the 10K
  additionalContext cap (docs-verified) — arrives as 2KB preview + file path. The
  practice files survive via bootstrap-gate forced Reads; LAST-SESSION-STATE /
  CURRENT-STATE / model-version check ride in the overflow a fresh instance may NEVER
  read — a cold-start handoff hole, critical before June 22. Fix: session-start
  injects a compact ≤10K index (state HEADLINES + version check + pointers); gates
  force the full reads. Hooks edit = ceremony.
- **OPERATOR-CONTEXT MINING:** operator-context.md (45KB) is defused (env-flag off,
  costs nothing) but UNMINED (delivers nothing) — "defused" has been passing for
  "fixed" since 2026-06-09. Mine it with the now-proven pattern: distill into
  rule-sized always-loaded cores (~/.claude/rules/) + per-seat framing material for
  the seat-prep pack. Research-class mission once #0 lands, or conductor block.

## QUEUED — process upgrades (operator asked "can our process be upgraded", 2026-06-09)
- **Mission status surface** — the runner appends phase events to a per-mission
  .events.jsonl (planning started / step N implementing / witnessing / healed /
  committed) so "what's running and where is it" is ONE file read, not process
  archaeology. Feeds Mark's status asks, the wakeup loop, and a future /muezzin status
  command. Small build, high leverage — today's polling was the friction receipt.
- **Schema-constrained plan output** — the architect seat is asked for JSON by prose
  instruction; two of three plan attempts failed "no valid JSON micro_queue." Add
  format/json-mode constraint (Ollama structured outputs) to plan-phase dispatches —
  kills the failure CLASS structurally instead of re-prompting harder.
- **Parallel mission lanes + in-mission seat parallelism (post-soak)** — OPERATOR FACT
  2026-06-09: the Ollama Cloud plan allows **3 models running concurrently**. Serial
  discipline is a LOCAL-RAM rule; cloud-side it leaves 2/3 of paid concurrency unused.
  Unlocks, in order of safety: (a) IN-MISSION PANELS — the visual-QC judge panel and
  seating-audition screeners run their 3 seats simultaneously (a judge panel IS 3
  parallel models — the plan limit matches the design exactly); (b) the daemon runs up
  to 3 cloud-only mission lanes in parallel (post-soak; status surface is the shared
  board); (c) seating auditions batch candidates 3-at-a-time. Local seats stay serial
  per GR10 — the concurrency budget is per-provider, never global.

- **Seat preparation pack** (operator: "prepare these models for success", 2026-06-09) —
  formation applied to seats, sourced from today's failure receipts:
  (a) CAPABILITY-TRUE FAITHS: audit every seat faith against what that seat can DO — the
  gr10 refusal came from demanding path-verification of a toolless completion seat; a
  one-shot seat's faith says "everything you need is below; emit the file," never
  "verify before acting." Formation must fit the body it's poured into.
  (b) GOLD-EXAMPLE FRAMINGS: every role's dispatch template carries ONE worked example of
  a perfect response (BRAND-TO-SITE's own highest-leverage finding, applied to seats —
  models pattern-match examples more reliably than they follow rules).
  (c) PER-ROLE SAMPLING MAP: deterministic temps for verdict/format seats, looser for
  ideation — encode in roster, not per-call habit.
  (d-DATA-SOURCE, operator insight 2026-06-10 "a file alone means the model reaches for
  it after failure — i.e., never": the retro corpus (_logs/retro/ + MISSION-LEDGER.md)
  feeds (d) MECHANICALLY — retros are ore, delivery is: 1) structural absorption (halt
  receipts become validator rules/gates — asks nothing of the model), 2) dispatch-time
  injection (this item — failure patterns pushed INTO the framing), 3) repair-seat
  retrieval (similar past halts in the repair prompt; weakest, last resort). Never rely
  on a model reading a file it wasn't handed.)
  (d) RIJAL-INFORMED DISPATCH HINTS: inject each seat's known failure pattern into its
  own framing ("prior observation: you tend to X — check before emitting") — the canon
  already does this for the old chain; port it.
  (e) PLANNING SIZE CEILING: missions get a char/scope budget before the architect ever
  sees them — right-sizing the ask is the cheapest success-preparation there is.
  WHO DOES WHAT: (a)+(b) are FORMATION — conductor authors them directly (identity and
  exemplar authoring is the examiner's lane; the seats being formed can't write their
  own formation — same conflict-of-interest rule as auditions). (c)+(d)+(e) are CODE —
  small seat_dispatch/roster/deconstructor changes, batched INTO the seating-init
  mission so the auditions measure whether the preparation actually worked: prepare →
  audition → compare against the unprepared baseline. The preparation itself gets a
  receipt. Sequenced after the census lands.

## QUEUED — seating initialization (ROSTER_AND_SEATING_SPEC.md Process 1 — NOT YET RUN)
The formal init: full-catalog discovery → eligibility gate → screening canaries →
per-faith auditions (Claude-administered, faith-file rubric, SearXNG SOTA grounding —
prerequisite REPAIRED 2026-06-09) → seat winners → generate ROSTER.json + bench + rijal
records. Until it runs, the roster is the handoff's hand-locked seats (kimi-k2.6,
deepseek-v4-pro, nemotron-3-ultra, qwen3-coder-next, minimax-m3, glm-5.1) flagged
'unestablished' in model_rijal.mjs — operational but unaudited. Run AFTER P0-CORPUS
(its receipts double as live qualifying evidence for the current seats) and BEFORE
M3-LAYNA if feasible (the build deserves auditioned seats; the visual-QC panel
especially).

- **Mission records → AnythingLLM** (advisory search layer): pipe mission texts +
  results + retro notes into an AnythingLLM workspace for semantic "which mission
  touched X" lookup. Files/git stay the authoritative record (retrieval-routing canon:
  RAG is advisory, never truth). Depends on fixing the stalled ingestion path
  (hotdir/embedding stall observed 2026-06-03).

- **CONDUCTOR-SHARE METRIC (falsifiable trajectory test, banked 2026-06-09):** the
  pipeline's health verdict is trajectory under load, condition-form: each customer
  cycle's Claude-share of the artifact must FALL — Layna dossier ≈90% conductor
  (baseline, hand-built); Layna build target ≈50%; next customer's dossier = seat-drafted,
  conductor-graded. VERDICT CONDITION: if after three customer cycles dossiers are still
  conductor-built, the pipeline judgment changes from "young" to "failing its purpose" —
  and the dashboard (below) must print the ratio as a number, not a feeling.
- **CONDUCTOR RIJAL — per-turn model attribution (operator question 2026-06-10: "it
  switched to Opus… is it a model problem?"):** no one can currently answer which model
  served which turn — that lives in vibes. The usage governor's telemetry must log the
  serving model per session/turn (transcript metadata carries model IDs) so "was it the
  model" becomes a substrate query: stalls, gate-fires, and drift events attributed per
  model = a rijal biography for CONDUCTORS, same as the seats already get. FIRST RECEIPT
  banked 2026-06-10: every stall this session had a structural cause (wakeup-chain lapse,
  stale MCP process, validator vocabulary) — none model-attributed; fm11 fired live on
  the Fable-5 conductor within minutes of rebuild. Pairs with the dashboard's instance
  panel.
- **USAGE-GOVERNOR (operator idea + github.com/evangit2/guanaco, triaged 2026-06-09):**
  week-aware model routing from combined usage awareness. (a) Deploy guanaco (MIT,
  self-hosted FastAPI proxy for Ollama Cloud — token tracking, dashboard, fallback;
  verified active) on The Factory; point seat_dispatch's cloud provider URL at it →
  every seat call tracked + visible. (b) Claude-side: no official plan-quota API —
  estimate from session/turn telemetry (SALVAGE TARGETS: agy M21 turn monitor + M9
  usage-hub dashboard, already on the agy-import salvage list). (c) Policy: as the
  Claude week depletes → conductor tier drops (Fable/Opus → Sonnet), judgment work
  batches, cloud seats absorb more; roster gains a budget dimension next to rijal.
  Between website beats; pairs naturally with the agy-import salvage.

## QUEUED — P0 pipeline (per E:\AI_Storage\website-pipeline\missions\P0-MISSIONS.md)
- P0-CORPUS S1 (archaeology, per census) → S2 (knowledge inventory) → S3 (library)
- M2-LAYNA S1–S4 (gated on corpus completion; Layna question list goes out during corpus
  — operator side: her 10 best photos, prices, pickup/delivery, story; see LAYNA-SCOPE.md)
- Factory faiths authoring (MASTER-PLAN formation layer; pitch.faith needs Mark)
- M3-LAYNA S1–S5 (gated on Mark's dossier approval)

## QUEUED — setup items (one-time)
- **Laptop parity (operator requirement):** push muezzin-plugin + site-factory repos to
  the gits (GitHub private at minimum); every client-site repo likewise from day one;
  laptop setup = clone repos + env keys (OLLAMA_API_KEY, GOOGLE_PLACES_API_KEY, AIMLAPI)
  + wrangler login + clone claude-governance for ~/.claude. Runbook: LAPTOP-SETUP.md.
- **`muezzin doctor` command** — one-shot environment check for a fresh machine: tools,
  keys, wrangler auth, ROSTER.json freshness, per-seat cloud canary ping, governance
  repo currency. The "open laptop → green light → conduct" UX depends on it.
- **Update nxtlvl.studio/get bootstrap** (source likely NAS web root /volume1/web/) —
  add muezzin-plugin clone+registration (codeberg.org/nxtlvl/muezzin-plugin, PRIVATE:
  check SSH key/token first), three env-key prompts, wrangler login offer, `muezzin
  doctor` finish. Also mirror /get to CF Pages (NAS-served installer = road fragility).
- DONE 2026-06-09: muezzin-plugin pushed to git — codeberg.org/nxtlvl/muezzin-plugin
  (private) + local Forgejo nxtlvl/muezzin-plugin. GitHub mirror still pending PAT/gh.
- gh CLI or GitHub PAT for private-repo census enumeration
- Stitch MCP install (stitch.withgoogle.com/docs/mcp/setup) + session restart
- Places key: API-restriction + $5 budget cap in Cloud Console (operator, 5 min)
- lefthook still absent from PATH (global laguna pre-commit unaffected after restore;
  noted in GOVERNANCE-EVENTS EVENT-003)

## GOVERNANCE (carried from ~/.claude ledger — not factory work)
- 5 born-corrupted artifacts: rebuild-or-retire via muezzin missions (GOVERNANCE-EVENTS
  EVENT-001; 4 old-chain skills likely retire, gr10 rebuild mission spec exists)
- June 5 corruption root-cause hunt (check muezzin repo git history for the writer)
- Frontier-text cleanup in hooks/canon per EVENT-002 condition-form ruling

- **CGSPORTS IDLE-TIME RULE (operator, 2026-06-10 ~17:12):** idle system cycles burn the CGSports upgrade backlog (SOTA-UPGRADE-PLAN.md once authored); deliverables preview on CF Pages FREE via wrangler (auth proven in census) with the front-end on Pages + NAS API through the existing cloudflared tunnel. Missions where the engine can; sessions where it can't (until 0.4).

- **PORTAL DOCTRINE — OPERATOR RULING 2026-06-10 18:20:** resolved §1 NOT as A-or-B but as BOTH, CLIENT-SELECTABLE + TRANSPARENT. Offer each client BOTH generation paths and LABEL what's what: LOCAL (ComfyUI on the 4090 — private, no per-image cost, SOTA models, but down when the box is) vs CLOUD-API (external generation — always-on, survives a NAS/workstation outage, per-image cost, vendor VERIFY). Golden Rule 3 ('everything local') is AMENDED by operator word: local stays DEFAULT, cloud is an OPT-IN client choice + the automatic failover when local is offline. UI must show which path served each image. This is the resilience fix tonight's outage proved necessary.

- **SELF-HEAL RULE (operator catch 2026-06-10 18:36: 'why did you wait for me to ask'):**
  a BLOCKED mission whose receipt names a fix the conductor can perform (split it, stage
  an input, restructure the plan shape) is a REQUIRED ACTION at the next beat — not a
  parked label. 'Never blind-requeue' forbids retrying WITHOUT a fix; it never licenses
  sitting on a named fix. Receipt of the failure: vanlife card diagnosed 'split into
  halves' at 21:42, conductor filed it and waited 50 minutes for the operator to ask.

- **READ-JAIL HARDENING (laguna witness finding, 2026-06-10 19:58):** the Claude-tier
  executor's new Read grant is machine-wide (claude CLI Read takes absolute paths).
  Receipted equivalence: executors ALREADY had arbitrary-path read via readDep framing
  context_dependencies, so the trust surface is unchanged - but jail it anyway in the
  engine batch: deny-rules for secret paths (.env, credentials) in the spawned session's
  permission settings, or a sandbox-rooted read wrapper. Cost cap: CLAUDE_TIMEOUT bounds
  per-call reads; flat-rate auth.

## TIDALTREASURES.CA — operator intake 2026-06-11 ~04:00 ("needs missions")
Chey's resin-art Next.js e-commerce store, DOWN since NAS outage (DNS gone), 65% built,
source intact at D:\Desktop\tidaltreasures, brand kit on NAS /volume1/homes/Chey/.
FULL RESEARCH + ORDERED MISSIONS: D:\Desktop\tidaltreasures\TIDALTREASURES-RELAUNCH-PLAN.md
(conductor-authored from a full repo sweep). 7 missions ordered; relaunch = fix 1 import +
wrangler.toml + Stripe keys + DNS. The CODE missions need a code session (or muezzin engine
0.4 code-in-repo). OPERATOR DECISIONS gating the build: Stripe keys (Chey), domain/DNS status,
SQLite-vs-D1, R2-now-or-later, AIMLAPI key (currently EXPOSED in plaintext .env — rotate).

- **PORTAL OUTAGE ALARM = FALSE (corrected 2026-06-11 07:00, clean container check):** the ~18:00 'portal containers GONE' finding was a BAD CENSUS (grepped wrong names / truncated docker ps). TRUTH: the portal stack is UP 2-3 weeks continuously — urmomis-php, urmomis-db(healthy), urmomis-web, mailserver(healthy), urmomis-hyperframes, nxtlvl-motiongfx — storefront nxtlvl.studio HTTP 200. comfyui-urmomis is NOT on the NAS because it runs on the WORKSTATION (:8188), as designed. Mission #22 (portal-outage-triage) is therefore premised on a false alarm — RECLASSIFY: not an outage, the PORTAL-SOTA-UPGRADE-PLAN's improvement items (resilience monitor, worker-migration, Phase-6 API tiers) still stand, but there is NO outage to recover. Same lesson as the AnythingLLM wrong-instance catch: verify the live state before alarming.

## PENDING SEAT-PLAN AMENDMENT (operator proposal 2026-06-12 ~11:30): Qwopus3.6-27B-Coder-MTP
## (hf.co/Jackrong, Apache 2.0, Q4_K_M pulled to local Ollama) becomes the phase-2 CODE-
## IMPLEMENTATION seat, audited by laguna — PROVISIONAL on the Tuesday audition (bootstrap-pass
## doctrine: earned under scrutiny, never grandfathered off a self-reported 67% SWE-bench).
## ACCEPTANCE GATE: (a) get-upgrade part 3 (the x8 installer-correctness wall) passes its
## witnesses; (b) one empty-emission-class authoring step emits real content. On pass: local-
## first executor for code-class steps, existing cloud waterfall demoted to badal fallback
## (usage win: code authoring moves off Claude-tier onto the 4090). GPU sharing allowed per the
## same-day infra amendment; GR10 serial discipline unchanged.
## QWOPUS DISPATCH CONSTRAINTS (smoke-tested 2026-06-12): model string
## hf.co/Jackrong/Qwopus3.6-27B-Coder-MTP-GGUF:q4_K_M — COMPATIBLE, GPU-resident,
## 32 tok/s on the 4090. REQUIRED: think:false TOP-LEVEL (thinking burns the whole
## num_predict inside think-tags and returns EMPTY — receipted). temp 0 gave clean
## correct PowerShell with zero ceremony on first ask.
## QWOPUS AUDITION PRE-RECEIPTS (head-to-head 2026-06-12, operator-requested, all-local zero
## Claude tokens): A) Qwopus codes + laguna audits — Qwopus wrote near-perfect Backup-File
## (LiteralPath, exact spec naming) with ONE subtle WhatIf return-path bug; laguna CAUGHT it
## precisely. B) laguna codes + Qwopus audits — laguna got WhatIf right but deviated from the
## spec filename + skipped LiteralPath; Qwopus caught the deviation WITH the exact fix line
## AND showed severity calibration (explicitly downgraded a minor finding — the exact judgment
## the verdict panel lacks). OPERATOR-RATIFIED DIRECTION: A (Qwopus implements, laguna audits).
## BONUS for Tuesday: audition Qwopus as a verdict-panel CALIBRATION seat too (the merge
## six-cycle kill is the test case).

## OPERATOR RULING 2026-06-12 14:15 — TOTAL HOLD EXCEPT SOCIAL MEDIA until Tuesday 2026-06-16
- His words: 'I need all missions paused except this social media process until Tuesday'.
- Effect: hyperframes-render-proof-b HELD mid-run (parts 1-2 banked, resume from parts); ALL prior holds stay; the ONLY fireable mission is stitch-design-mastery (social-media library design loop). The cron's un-hold-m28 standing duty is SUSPENDED by this ruling (m28 is not social media).
- Restore only by the operator's word.

## OPERATOR RULING 2026-06-12 15:34 — BUDGET EXHAUSTION PREP (local-first mandatory)
- His words: Ollama Cloud already capped; Claude budget will be exhausted before the weekend ends. Everything must run on LOCAL models, plus his Gemini account IF cleanly possible; otherwise local-only.
- Verified: seat_dispatch.mjs already carries the local rung (waterfall = cloud -> 3 heals -> claude window -> ollama-local) — missions degrade to slow-local, never stall. Pipeline is fully local after today (whisper/nemotron/qwen3.6/laguna/Flux/LTX/ffmpeg).
- Gemini channel: identity-bound — only he can mint an AI Studio key or enable the Gemini API on the Stitch GCP project. Until then: no new frontier wiring (standing security constraint on the consumer account holds).
- Conductor expectation: when Claude exhausts, conducting pauses; daemon+processor grind on; judge from receipts at usage return.

## OPERATOR RULING 2026-06-12 15:38 — GEMINI CHANNEL BLESSED (his word: do this with local models + my Gemini account; I thought you already have AI Studio API)
- VERIFIED LIVE 15:40: the official Gemini CLI (gemini.cmd, his Google login) responds — receipt: GEMINI-CHANNEL-OK. This is THE Gemini channel for the social pipeline: taste-grader + vision-arbiter seats, dispatched as a local subprocess (his account, free quota, no key).
- STILL FORBIDDEN: gemini-api-worker (= AIMLAPI reseller, compromised key, rotation owed), gpt/grok/glm workers, any new closed-frontier API wiring.
- Stack ruling final: LOCAL models carry everything; Gemini CLI is the quality topper where taste matters; degrade to local-only gracefully when its daily quota runs dry.

## OPERATOR CLARIFICATION 2026-06-12 16:12 — scope = the social media PIPELINE itself
- His words: 'I thought I was pretty direct when I said I only want to be working on the social media project right now.' The conductor had classified the stitch-design mission as in-scope; he overrules. Stitch design thread = HELD-BY-OPERATOR-WORD (banked artifacts kept; no requeue without his word). The ONLY running work: the intake pipeline and its direct fixes.

## CONDUCTOR NAS-AWARE SEQUENCING NOTE 2026-06-14 (operator asked "reorder missions so NAS-free ones go first" during the NAS power-outage crash; daemon HALTED + total-hold still in force, so this is a RESUME ordering, not a live refire)
Finding: the mission engine (daemon/AUTORUN/sandboxes) lives on C:, not the NAS — so the
research/card/assembly missions are ALREADY NAS-free. On the Tuesday un-hold, fire in this order:
- **TIER 1 — NAS-FREE, fire first** (write to local sandbox + git, run local/cloud models):
  Layna dossier (m01-1), card-merge-vanlife-muddy, books, m28-1b iOverlander, the damm
  completions (west/tidal/fb-v3), quirky POIs, hyperframes-render-proof-b, the *-sota-check
  research missions, stitch-design thread (still HELD-BY-OPERATOR-WORD separately). Social
  pipeline PROCESSING (whisper/nemotron/qwen3.6/Flux/ffmpeg) is local too.
- **TIER 2 — WAIT FOR NAS (or for the Cloudflare migration that supersedes the dependency):**
  social-pipeline PUBLISH/INTAKE (muddytires.ca + /post are NAS-hosted = down now), CGSports v3
  (NAS API/container), tidaltreasures relaunch (brand kit on NAS), the /get installer bootstrap
  (NAS web root), muddytires #23 EXTRACT_DONE check (NAS read). These carry an implicit
  REQUIRES:nas-up — hold them with that condition rather than firing into the down NAS.
Note: the muddytires→Cloudflare migration (first post-Tuesday code-mission) is what permanently
removes Tier 2's NAS dependency — after it, the public site + intake stop needing the NAS at all.

## OPERATOR RULING 2026-06-15 11:37 UTC — HOLD LIFTED, NAS UNTOUCHABLE (his words: "you may
## remove the hold as long as you do not touch the NAS")
- TOTAL-HOLD (2026-06-12 14:15) is LIFTED. Tier-1 NAS-free missions resume.
- STANDING CONSTRAINT (until he says otherwise): DO NOT TOUCH THE NAS — no SSH, no mounts,
  no reads/writes, no mdadm/btrfs/fsck ops. Tier-2 NAS-dependent missions stay held with
  REQUIRES:nas-up. The NAS is still recovering; the read-only mount work from the crash is DONE.
- EXECUTED 11:41: daemon RESTARTED (PID 101184, 1 lane — conservative); un-held in AUTORUN =
  hyperframes-render-proof-b (fired, RUNNING on claude-opus route-window), m28-1b-ioverlander,
  damm-fb-v3, auth-sota-check-b, damm-tidal, damm-west. KEPT HELD: sota-pipeline-dossier
  (Ollama-cloud cap → would burn metered budget) + stitch-design-mastery-b (operator's separate
  no-requeue-without-explicit-word standing on the stitch thread).
- NOT lifted by this: engine-gap-blocked missions (empty-emission gremlin / verdict-calibration /
  installer-correctness) stay BLOCKED pending the engine batch — un-holding them = blind relaunch.
- MAX_LANES stays 1 (budget-conservative) until operator restores 2 by his word.
