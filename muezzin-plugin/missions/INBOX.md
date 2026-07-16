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

(empty — 10 items dated 2026-06-18 triaged out 2026-07-03; dispositions in QUEUE.md
"2026-07-03 INBOX TRIAGE" block; full original text preserved in this file's git history)

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
  (aimlapi + Gemma-4-31b). ~~UNPARKS on the operator's AIMLAPI key rotation + a security review (the key was exposed).~~
  **SUPERSEDED by operator ruling 2026-07-03 ~16:5x (QUEUE.md "AIMLAPI KEY: BUILD NOW, ROTATE AT THE END"): build/wire/test on the
  current budget-capped key; rotate ONCE at the end (end-gate reminder owed).** mt-25 is LIVE (nl-brief probe receipt 16:0x). mt-26
  stays blocked separately (worker source on E:, Test-Path False this day). mt-27 free to shape+queue. Rotation remains
  identity-bound (his aimlapi.com dashboard — probed: no programmatic rotation).
- **community / social platform ("create once, post everywhere")** — the operator's biggest-leverage idea. Gated behind accounts
  live (the account UI/add-spot/reviews/profile missions are running now) + a cost decision: rent Post-for-Me ($10/mo) to validate
  him+wife first. UNPARKS when accounts land + the operator OKs the MVP rental. Port reference (don't rebuild): nxtlvlyt/website-pipeline.
- **map core → MapLibre GL (tilt/pitch/vector tiles)** — deliberate, resourced REWRITE of the whole Leaflet map core. PARKED as a
  future call; only if a modern tilting map becomes a core selling point. Path A (leaflet-rotate) already shipped.

- RESOLVED 2026-07-01 (re-verified against live code, not just re-asserted): all three engine bugs below were fixed same-day 2026-06-25 — `muezzin-daemon.mjs` carries inline `BUG 1 GUARD` / `BUG 2 FIX` / `BUG 3` comments at lines 538-552 matching each description exactly (`path.isAbsolute()` guards the mkdir join at line 552; `terminalIds.has(rel) || terminalIds.has(base)` at line 546 matches by full path with PARKED included in `terminalMissionIds`). STATUS-BOARD.md's "PARKED ... engine bugs filed in INBOX + fixed in this session" annotation on the b13 family is accurate, not just asserted. Left the original text below struck through for the record rather than deleted.

~~- **ENGINE BUG (HIGH) — path-doubling in mkdir.** 2026-06-25: daemon b13 retry FAILED(x2) with `ENOENT: no such file or directory, mkdir 'C:\Users\marka\.claude\muezzin-plugin\missions\C:\Users\marka\.claude\muezzin-plugin\missions'` — the engine is `path.join(MISSIONS_DIR, missionPath)` when missionPath is already absolute. Reproduce: `node muezzin-daemon.mjs` with any AUTORUN.md entry that resolves to an absolute path. Fix: guard the join with `path.isAbsolute(missionPath) ? missionPath : path.join(MISSIONS_DIR, missionPath)`.~~

~~- **ENGINE BUG (HIGH) — spam-loop NOT actually closed despite selftest claiming so.** 2026-06-25: b13 marked FAILED(x2) at 19:56:34, but engine fired it AGAIN as `attempt 1/2` at 19:56:36 (2 seconds later). Selftest at `--selftest` claims "WITH the ledger, FAILED-x2 is NOT re-promoted; spam-loop CLOSED." Reality contradicts. Possible cause: ledger entry not being written before the next pick cycle, OR AUTORUN.md still references the mission and re-promotes from there, OR the dedup is by mission_id rather than file path. Daemon was burning cloud cycles in a tight loop on this for 28+ min until manually killed 2026-06-25 ~20:00Z. Selftest passes the synthetic case but the real environment fails it — gap between test fixture and production substrate.~~

~~- **ENGINE BUG (HIGH) — pickPromotion ignores FAILED prefix when same mission_id appears as both base AND splits.** 2026-06-25: AUTORUN.md has 54 b13-* lines, all prefixed FAILED after senior intervention. Engine STILL picks `b13-sitemap-prune-cf-limits.S2.mission.txt` as next mission. The selftest's "FAILED-x2 dedup via ledger" works on synthetic case but fails in production because: (a) the engine considers ALL mission.txt files in missions/ directory, not just AUTORUN lines — AUTORUN is a manifest, not the sole source; (b) the dedup may be by mission_id stem (e.g. "b13-sitemap-prune-cf-limits") not by file path — base + .S1 + .S2 are different files but maybe same mission_id; (c) AUTORUN-duplicates of b13 (27 lines all "BLOCKED-WITH-RECEIPT" then re-prefixed to "FAILED") might be confusing the count. The b13 mission family needs to be removed from missions/ directory OR the engine needs path-level dedup, not just mission_id dedup. Until fixed, no mission can be processed because b13 always pre-empts the queue.~~

- RESOLVED 2026-07-01 (re-verified against live code): `STATUS_RE` at muezzin-daemon.mjs:329 already includes PARKED (`/^(DONE|FAILED|RUNNING|SPLIT|PARKED)\b/`), same 2026-06-25 batch as the three bugs above; `pickPromotion` excludes PARKED by path via `terminalMissionIds`. Struck through, not deleted.

~~- **OPERATIONAL — no way to "park" a mission without removing the file.** Operator/senior conductor needs a way to say "this mission is broken, ignore it, don't fire it again" without (a) deleting the mission.txt file, (b) blanket FAILED-prefixing every AUTORUN line. Proposal: add a `PARKED` terminal status to engine STATUS_RE alongside DONE/FAILED/SPLIT/RUNNING, and have pickPromotion exclude PARKED missions by path absolutely.~~

## BACKPORT INTAKE 2026-07-08 (from agy-muezzin fork's first live project — 8-attempt arc, all receipted in fork QUEUE.md/STATE.md)
The fork found 7 real engine bugs under live fire; the Claude engine shares the code lineage, so EACH needs evaluation here (receipts + fixes + selftests exist fork-side to port):
1. AUTOSPLIT DEP-LOSS (fork fix e1cba9e): mission_split child serializer drops context_dependencies; child re-plan invents substitute paths. Port parseDeclaredDeps/injectDeclaredDeps + serializer emit.
2. AUTOSPLIT GATE-LOSS (fork fix 9ae0072): same serializer drops validation_command; anti-fabrication gates re-invented at child re-plan. Port parseDeclaredValidations/injectDeclaredValidations.
3. STALE-SANDBOX ON REQUEUE: child sandbox + _checkpoint.json persist across FAILED requeues → verdict panel re-judges old artifacts; checkpoint resumes by STEP INDEX across text changes. Fix owed: sandbox reset on requeue + content-hash checkpoint keys + verdict ignores artifacts older than run-start.
4. TARTIB OUTPUT-PASSING: DONE child's artifacts invisible to its successor (S2 assembled without S1's parts; verify gate caught it). Fix owed: stage DONE artifacts where successors resolve them.
5. DAEMON LINE-RESURRECTION: daemon full-file AUTORUN rewrites resurrect externally-purged pending lines from memory/files; conductor queue edits only stick when... (fork workaround: park mission FILES). Evaluate Claude daemon for same.
6. SINGLETON LIVENESS: pidfile pid can be RECYCLED to an unrelated process (fork receipt 23788) → false-alive; and CommandLine-based checks must match bare "node muezzin-daemon.mjs" (no repo substring). Harden liveness = pid+CommandLine.
7. BOOT-STATUS GHOST: fresh daemon re-renders inherited RUNNING/FAILED marks from stale status/mark state.
Also proven useful fork-side, consider adopting: RELOAD-REQUEST flag exists Claude-side? (fork daemon honors it; fork lacks a supervisor — separate fork item.)

## INTAKE 2026-07-08 (from writing the two operator manuals side-by-side)
1. THE CLAUDE CONDUCTOR HAS NO LADDER: agy's conductor is graded per-beat against 7
   receipt-scored gates (fork SENIOR-QUALIFICATION.md); the Claude conductor is "born
   senior" with no scorecard — yet today's receipts show it committing G5-class violations
   (double-daemon via pidfile-rm; ghost-lane kill). PROPOSAL: the same gates grade Claude
   conductor beats into a ladder ledger; self-accountability, same standard both sides.
2. RAILS-INTO-ENGINE DIRECTION: agy proved engine-level gates (verdict, retro-repeat,
   miqat) discipline ANY conductor, while harness-level hooks don't port and can misfire
   (niyyah gate vs wakeup-transcript quirk, receipted today). Standing direction: when a
   discipline can live in the engine instead of a hook, move it there.

## INTAKE 2026-07-08 (retro-mining audit of the muddytires mt-integrate corpus, 131 files, 07-01 to 07-03)
REAL FINDING (receipted, not manufactured): the retro system's "learning material" field
(Halts/blocks) is EMPTY — literally "- none" — in ALL 131 mt-integrate retros with zero
exceptions, even for missions that retried up to 9 TIMES (mt-integrate-trip-cost-split-2026-06-23.S2:
9 retro files, every one blank). The quantitative fields (events/heals/halts counts) are also
mostly 0 across the same window — the retro generator wasn't capturing real telemetry during
this sprint. So: we do NOT have a mineable diagnosis corpus from the first ~20-131 muddytires
missions. We know THAT many retried; we don't know WHY, because it was never written down.
TIME-BOUND (not permanent): a 2026-07-07 retro (qc-concern-poi-affiliate-cards) DOES carry
real content ("witness REJECT unrepaired") — the capture defect improved since, though still
shows truncation ("step 1: " with nothing after — half-written fields).
THE ACTUAL LESSON (this IS the efficiency finding, just not the one expected): a retro whose
"learning material" field can silently write "none" through 9 straight retries is a retro
system that isn't enforcing its own purpose. FIX OWED: (1) the retro writer should REFUSE to
emit "none" when heals>0 or retry_of is set (a repeat attempt with no captured reason is a
contradiction, not a valid state); (2) audit whether the current (07-07+) capture still
truncates fields ("step 1: " empty) — cheap grep sweep, same method used here.
This intake IS the deliverable — mining for pre-existing lessons found that the mining
apparatus itself was the broken thing, which is more valuable to know than any specific
mission-level tip would have been.

## RESOLVED 2026-07-09: Stitch status across all three surfaces (operator asked, verified live)
- nxtbeast Claude CLI: HAS Stitch, working (OAuth via gcloud ADC, node C:/Users/marka/.claude/tools/stitch-launch.mjs -> npx @_davideast/stitch-mcp proxy; verified live 2026-06-11, "Connected to Stitch, discovered 14 tools").
- Laptop Claude CLI (this session): does NOT have it. One-line fix, no file editing:
  claude mcp add stitch --transport http https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: <key>" -s user
- agy-muezzin fork: config staged (mcp_config.json), placeholder key only.
ONE operator step covers BOTH remaining gaps: mint one API key at stitch.withgoogle.com ->
Settings -> API Keys -> Create API Key, then (a) paste into agy's mcp_config.json, (b) run
the claude mcp add command above on the laptop with the same key.

## NEW 2026-07-11 (operator screenshots, conductor pre-triaged)
- MT COMPETITOR/CONTENT LEAD — Indigenous BC app (VERB Interactive, 3.8star/47 reviews/10K+ installs): regional discovery app, winnable-quality niche. Two angles: (a) add to the money-competitor analysis corpus; (b) evaluate an Indigenous-tourism POI/content layer for muddytires (licensed/respectful sources only — Destination BC / Indigenous Tourism BC open data first). Mission-class research, shape after amendment backlog clears.
- DESIGN TOOLING (friend advice, receipted screenshot): (a) evaluate+install Claude design skills — github.com/greensock/gsap-skills (official GreenSock), impeccable.style, ui-ux-pro-max-skill.nextlevelbuilder.io — SECURITY REVIEW FIRST (third-party skills are injection surface: read every file before installing to ~/.claude/skills); (b) ADOPT THE DESIGN-MD PATTERN: iterate visuals in a vision model (we have agy/Gemini instead of AI Studio), then have it emit a design-spec .MD, then the implementer builds from that contract — this is exactly what atv-11 lacked (prose specs drifted 7 attempts); file as the design-mission format for atv/mt going forward.
- NOTEBOOKLM CLI+MCP (jacob-bd/notebooklm-mcp-cli): scriptable notebooks + podcast generation. Van-fit use: pipe business-context corpus / weekly board reports into audio digests for driving. PARKED: needs operator Google-account setup (identity-bound) + fits after core lanes; zero cost while parked.

## LEAD 2026-07-12 (operator screenshot, Sentry Settings > MCP & CLI): SENTRY MCP SERVER — INTERACTIVE COMPLEMENT TO ITEM 19
Sentry ships an official streamable-HTTP MCP server (https://mcp.sentry.dev/mcp, org/project-scopable) + a CLI (sentry auth login). BOTH authenticate INTERACTIVELY (browser OAuth) — neither replaces the item-19 read token, which exists precisely because unattended cron polling needs a headless Bearer credential (interactively-authed MCP servers are absent in headless runs — port-playbook receipt). ADOPT AS COMPLEMENT: register the Sentry MCP in Claude CLI (project-scoped to muddytires per its own recommendation) for live interactive triage during conductor sessions — search errors, stack traces, root-cause without operator screenshots. Same cross-jurisdiction registration pattern as Stitch MCP (Claude/agy/warroom-as-config). Low priority behind the design-pipeline fix set; zero effect on item 19's build.


## 2026-07-12 TRIAGE — 3x "lighthouse-ci.yml: No jobs were run" emails (operator forwarded)
Benign: rapid consecutive mission pushes to muddytires-pages main; the workflow's
concurrency cancel-in-progress kills queued audits when a newer push lands (HYPOTHESIS
— consistent with 3 bursts tonight; refute by checking the runs' cancellation state on
the Actions page). Production unaffected (wrangler deploys, not Actions). CHECK next
wake: one solitary push should produce a real Lighthouse run with score deltas; if it
ALSO reports no-jobs, the cause is repo Actions config (billing/disabled) and needs a
real diagnosis. Mail hygiene: these thread-subscription emails are lifecycle noise —
operator can mute the thread; outcome-only reporting stays our push channel.


## 2026-07-12 UPDATE — lighthouse no-jobs emails: HYPOTHESIS REFUTED, real cause FOUND
The concurrency-cancellation hypothesis is DEAD (refuted per its own check): gh run
list shows EVERY run since 2026-07-01 concluding failure in 0s, and gh run view says
"workflow file issue". Dup-key scan receipt: DUPLICATE KEY "env" at line 121 (first at
line 75) in .github/workflows/lighthouse-ci.yml — GitHub's strict YAML parser refuses
the file; python/lenient parsers hide it. IMPACT: zero Lighthouse audits have ever run
from this file. FIX (staged, applies at the copy-clarity lane boundary — the running
mission's scoped-cleanliness check forbids editing its repo mid-lane): merge the two
env blocks in the step, commit, push; the next push then fires the FIRST real audit.
The 5 operator emails were all this one defect.

- 2026-07-14 ~23:5xZ FIELD-UX (operator, live at Abraham Lake, two screenshots): the
  4-step onboarding tour (js/onboarding.js) blocked him from the map on a fresh
  origin — he reported "can't get passed this" TWICE (step 1, then step 2). Headless
  repro on fresh Pixel-7 profile: both Skip and Next-x4/Finish dismiss cleanly, flag
  written, zero pageerrors — so the mechanism works; the FRICTION is the design: a
  modal 4-step tour gating a map someone urgently needs, with a small text-link skip.
  Proposed fix-shape (product pass, not urgent surgery): backdrop-tap dismisses;
  bigger Skip target; or collapse tour to a single dismissible tip card. Also noted
  from his second screenshot: 223 POIs rendering as a dense green cluster wall at low
  zoom — worth a look at cluster thresholds on mobile (separate item, needs repro).
  Owner when picked up: product mission for js/onboarding.js after ITEM 24 clears.

- 2026-07-15 ~03:3xZ NXTBEAST DOCKER FORCE-RESTART (owner line for
  gap-nxtbeast-docker-desktop-wedged-remote, dormant): the remote Docker Desktop
  Linux engine 500s on every API call; graceful "docker desktop restart" failed
  (wedged processes, context deadline); conductor force-kill over ssh is
  classifier-blocked. NO LONGER BITES — laptop SearXNG is the primary search
  backend and was restored 2026-07-15. Run when next at the home machine or when
  a nxtbeast-docker service is needed:
  ssh nxtbeast "powershell -NoProfile -Command \"Stop-Process -Name 'Docker Desktop','com.docker.backend','com.docker.build' -Force -ErrorAction SilentlyContinue; wsl --shutdown; Start-Sleep -Seconds 5; Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'\""
  Then: docker restart searxng (the nxtbeast fallback instance) + control query.

## 2026-07-15 ~19:2xZ — PROD-DEPLOY GUARD REFUSAL: e2e overlap detector, lane-fix candidate (conductor, deploy-ruling chain)
Ran the guard chain for a conductor-called production deploy of the lane-fix (preview 0220f15b, both operator pairs CLEAR there). e2e-runner exit 2 -> NO DEPLOY per the mechanical ruling. Violations are ALL PRE-EXISTING (production serves them today plus the two now-fixed pairs): (a) DESKTOP #mt-search-icon intersects .mt-locate AND .leaflet-control-zoom (the mobile fix scopes to max-width:480px; desktop lane never got one); (b) MOBILE #stamp intersects .mt-locate (noted during the mobile fix's own dry-run as out-of-scope); (c) TAP_TARGET floor: #filtbtn 132x33, #mt-pd-gear 30x30, .leaflet-control-zoom 34x66; (d) DETECTOR-CALIBRATION items, not defects: #add measured while visibility:hidden off-screen, #stamp (non-interactive attribution) counted as a tap target, and DETECTOR_ERROR 'failed to enter plan mode' both viewports (detector's own flow, needs its own diagnosis). NEXT CONSTRUCTS: (1) mt-desktop-lane-fix (measure-first, literal CSS, the receipted mobile fix-shape); (2) stamp/locate mobile separation; (3) tap-target floor pass for filtbtn/gear/zoom; (4) detector calibration (hidden-element + non-interactive exemptions, plan-mode entry repair). Report: e2e-lanefix-prod-gate.json (session temp). Production deploy PENDING until the gate passes clean.

## 2026-07-15 ~19:3xZ — OPERATOR PROCESS SUGGESTION: Firecrawl as the digestion layer beside SearXNG (tryout item)
Operator shared a Firecrawl-vs-SearXNG comparison asking 'might this help our process?' Conductor assessment YES for two receipted pain points from THIS DAY: (1) gap-imagery-contract-missing's corpus-honesty receipt — the competitor corpus has ZERO imagery data because our research pipeline is text-extraction only; Firecrawl's screenshot + clean-markdown capture is the missing layer, and its screenshots feed the receipted-capable local vision-QC seat (gemma4:12b blind-test receipt, agy INBOX same day); (2) research-mission snippet-hallucination class — local seats need full-page content in few tokens; deterministic markdown extraction beats snippet-only SearXNG and token-heavy raw HTML. SCOPE: SELF-HOSTED ONLY (Docker on laptop beside SearXNG; cloud API is paid = identity-bound cost decision, not assumed). Marginal value = extraction + /crawl site mapping (we already own playwright rendering). TRYOUT SPEC: docker-compose Firecrawl locally; one competitor visual sweep mission (screenshots of 3 competitor homepages -> vision-seat imagery notes -> IMAGERY-CONTRACT v2 upgrade from DERIVED to competitor-grounded); one research mission A/B (same question, snippets-only vs firecrawl-markdown, judge groundedness). Adoption rides the engine QUEUE after tryout receipts. Owner: this line until promoted.

## 2026-07-16 ~01:0xZ — OPERATOR PROCESS SUGGESTION: HyperFrames video pipeline (tryout item, product-class)
Operator asked whether Remotion/HyperFrames-class tools help the process. Conductor assessment: YES for the parked social-distribution thread — HyperFrames is ALREADY INSTALLED in the conductor toolkit (skills: hyperframes, hyperframes-cli, website-to-hyperframes) and fits the receipted-pipeline style: HTML composition in, deterministic mp4 out, frames witnessable by the receipted-capable local vision seat (gemma4 blind-test receipt 2026-07-15). Remotion SKIPPED: same job, and the toolkit carries a Remotion->HyperFrames translator — one horse. FIRST DELIVERABLE when the gap line clears (or on operator word 'make the promo'): a 15-30s muddytires map promo rendered from the live site (website-to-hyperframes), vision-seat frame QC, staged for the operator's look before any posting. PRODUCT-CLASS: stands behind open bite gaps per the standing gap ruling. Owner: this line until promoted to a mission.

- 2026-07-16T04:06:40.726Z EXTERNAL SIGNAL: NEW CI FAILURE on nxtlvlyt/muddytires-pages — 18 new failed run(s) (.github/workflows/lighthouse-ci.yml@main#29462140348, .github/workflows/lighthouse-ci.yml@main#29460644175, .github/workflows/lighthouse-ci.yml@main#29448332999, .github/workflows/lighthouse-ci.yml@main#29434799180, .github/workflows/lighthouse-ci.yml@main#29394792063, .github/workflows/lighthouse-ci.yml@main#29392728395, .github/workflows/lighthouse-ci.yml@main#29388316654, .github/workflows/lighthouse-ci.yml@main#29383484235, .github/workflows/lighthouse-ci.yml@main#29381221517, .github/workflows/lighthouse-ci.yml@main#29375636500, .github/workflows/lighthouse-ci.yml@main#29372759372, .github/workflows/lighthouse-ci.yml@main#29369360151, .github/workflows/lighthouse-ci.yml@main#29362316739, .github/workflows/lighthouse-ci.yml@main#29357192853, .github/workflows/lighthouse-ci.yml@main#29235014268, .github/workflows/lighthouse-ci.yml@main#29185712123, .github/workflows/lighthouse-ci.yml@main#29184863472, .github/workflows/lighthouse-ci.yml@main#29184800561). Auto-filed by external-signals-poller (gap-external-signals-poller); verify with: gh run list -R nxtlvlyt/muddytires-pages --json conclusion,workflowName,headBranch,createdAt,databaseId -L 20

- 2026-07-16T04:06:40.726Z EXTERNAL SIGNAL: NEW SENTRY ISSUE(S) on muddytires — 1 new unresolved issue(s) (7588474264). Auto-filed by external-signals-poller (gap-external-signals-poller); verify at https://sentry.io/organizations/abass-inc/issues/?project=&query=is%3Aunresolved

- 2026-07-16T04:33:43.188Z EXTERNAL SIGNAL: NEW CI FAILURE on nxtlvlyt/muddytires-pages — 1 new failed run(s) (.github/workflows/lighthouse-ci.yml@main#29471383398). Auto-filed by external-signals-poller (gap-external-signals-poller); verify with: gh run list -R nxtlvlyt/muddytires-pages --json conclusion,workflowName,headBranch,createdAt,databaseId -L 20

## 2026-07-16 ~06:0xZ — PRODUCT FINDING (unmasked by detector round 2): plan-day bar's interactive children under the 44px tap floor on mobile
The fixed detector's first honest plan-mode measurement: #mt-planday-bar renders 303x32 on mobile plan state. The BAR is a status container (role=status, exempted under the stamp-class ruling), but plan-day.js styles buttons + fuel/carbon chips inside it and plan-day-gpx-export.js injects a GPX button into .mt-pd-actions — every tappable child in a 32px bar is under the 40-44px floor. NEXT CONSTRUCT: measure-first mission (the receipted lane-fix shape) — probe the children's boxes in plan mode at 375px, pin literal CSS (min-height/padding on the bar's buttons or a taller bar), witness with the calibrated gate. Owner: this line until the mission is queued (queue it before other new mt product work — it is a WCAG-class defect on a live feature).

- 2026-07-16T08:44:58.560Z EXTERNAL SIGNAL: NEW CI FAILURE on nxtlvlyt/muddytires-pages — 1 new failed run(s) (.github/workflows/lighthouse-ci.yml@main#29483876345). Auto-filed by external-signals-poller (gap-external-signals-poller); verify with: gh run list -R nxtlvlyt/muddytires-pages --json conclusion,workflowName,headBranch,createdAt,databaseId -L 20

- 2026-07-16T09:44:18.747Z EXTERNAL SIGNAL: NEW CI FAILURE on nxtlvlyt/muddytires-pages — 1 new failed run(s) (.github/workflows/lighthouse-ci.yml@main#29487648335). Auto-filed by external-signals-poller (gap-external-signals-poller); verify with: gh run list -R nxtlvlyt/muddytires-pages --json conclusion,workflowName,headBranch,createdAt,databaseId -L 20

## 2026-07-16 ~10:0xZ — LIGHTHOUSE CI DIAGNOSIS (the poller's first live catch, class root-caused)
Receipts (gh run 29487648335 --log-failed, read directly): landing.html PASSES; map.html FAILS with Lighthouse runtimeError NO_FCP ('the page did not paint any content'), ~6 min per attempt, Lighthouse 12.1.0. TIMELINE: last green run 751018e 2026-07-14T20:10Z; failures begin 2026-07-15T05:55Z and on EVERY run since (19+ auto-filed by the poller) — the causing change lies in the 07-14 20:10Z -> 07-15 05:55Z window's deploys/commits. NOTE: production shipped 2026-07-16 ~07:5x passed the calibrated e2e gate (map paints fine under playwright, FCP-equivalent selector visible <15s warm), so this may be Lighthouse-environment-specific (throttled emulation + the map's continuous tile/API traffic — the known networkidle-unfit class, QUEUE ITEM 24 receipts) OR a real slow-first-paint regression from that window. NEXT PROBE (named, mission-able): run lhci/lighthouse locally against https://muddytires.ca/map.html with matching version + throttling; if NO_FCP reproduces, bisect the window's commits (fdda468 is in-window) by deploying each to a preview and re-running; if it does NOT reproduce, the fix is CI-config class (raise Lighthouse's maxWaitForFcp / pass --throttling adjustments for the map page or exclude map.html from the throttled profile with a receipted reason). Owner: this entry -> promote to a mission next wake; the auto-filed gap-ci-failure-* entries close when the class closes.

## 2026-07-16 ~11:2xZ — LIGHTHOUSE NO_FCP: LOCALLY REPRODUCED (env-independent) + graded hypothesis
EXECUTED receipt: local lighthouse (npm global, headless) against https://muddytires.ca/map.html dies in waitForCPUIdle (wait-for-condition.js:262) — same class as CI's NO_FCP. The page never satisfies Lighthouse's CPU-idle load detection; real browsers paint it fine (calibrated-gate receipts). So the fix target is the PAGE's continuous activity or Lighthouse's wait budget — not the CI environment.
HYPOTHESIS (ungraded until the A/B runs, fifth law): the continuously-animating Northern Lights ticker (visible in every map render since 2026-07-15; a marquee-class animation = continuous rAF/CPU) landed in the exact 07-14 20:10Z -> 07-15 05:55Z failure window and is a textbook waitForCPUIdle killer. ADVERSARIAL CHECK, mission-able: inject 'animation-play-state: paused' (or remove the ticker node) via a local proxy/CSS override and re-run lighthouse — if it passes, the fix is pausing the ticker until first idle (or prefers-reduced-motion respect + a Lighthouse-visible idle window); if it still hangs, bisect the window's remaining deploys. Owner: this entry -> mission next wake.

## 2026-07-16 ~12:2xZ — LIGHTHOUSE NO_FCP: ROOT-CAUSED WITH RECEIPTS; my two earlier entries SUPERSEDED
CORRECTION (fifth law, self-caught): the earlier '2026-07-16 ~10:0x' regression-window entry and the '~11:2x' ticker-hypothesis entry are BOTH WRONG — superseded by this entry. Temporal-coverage receipt: gh run list shows the workflow red on nearly EVERY run since its 2026-06-23 birth; the only two greens ever are 2026-07-14 20:10Z + 21:33Z (flukes). There was no green era and no regression window. Also refuted with receipts: aurora ticker (predates window, no animation loop — 30-min setInterval only), upstream version bump (npm publish dates: nothing in window), page-weight jump (~1KB deltas), deploy delta (production sat at aa1a6d0 the whole window), onboarding overlay (paints content, no loops).
EXECUTED root cause: 4-condition Playwright probe against live map.html — desktop-unthrottled OK, mobile-emulation-alone OK, 4x-CPU load 42s, mobile+4x (Lighthouse's exact config) MAIN THREAD UNRESPONSIVE >10s. CDP CPU profile under that condition: repeated filter-stack.js frames (readOverlays/normaliseName/updateBadge) + 8s Leaflet _setPosition. Mechanism read from source: filter-stack.js bindMapEvents wires updateBadge to map 'layeradd layerremove' — fires once PER MARKER (~539 at boot, again per pull()), each call rescanning every layer-control row with map.hasLayer() = O(N^2) boot main-thread work. Real phones pay this too — live-site defect, not a CI quirk.
OWNER: missions/mt-lh-boot-cpu.mission.txt (QUEUED top-of-AUTORUN, gap-class). Fix: 150ms trailing debounce (staged fail-closed patcher, dry-run receipted). Outcome checks: D-condition probe responsive on preview + calibrated e2e green; closing receipt = Lighthouse workflow green on the production push. If debounce alone insufficient, mission step 5 fails with the probe receipt and next diagnosis targets _setPosition marker churn.
SIDE-FINDING (engine-class): GAP-PRIORITY-HOLD has NO mechanical consumer in conduct-cycle.mjs (string appears only in a selftest fixture comment) — the 2026-07-03 ruling's daemon-skip mechanism was never built. Queued as its own line in QUEUE.md.

- 2026-07-16T13:11:08.873Z EXTERNAL SIGNAL: NEW CI FAILURE on nxtlvlyt/muddytires-pages — 1 new failed run(s) (.github/workflows/lighthouse-ci.yml@main#29500574636). Auto-filed by external-signals-poller (gap-external-signals-poller); verify with: gh run list -R nxtlvlyt/muddytires-pages --json conclusion,workflowName,headBranch,createdAt,databaseId -L 20

## 2026-07-16 ~14:0xZ — plan-engage race STILL flaking post-calibration (deploy-guard reliability)
Receipt: two e2e runs against the SAME deploy (dcd824b6) within 40 min — run 1 all 4 overlap cells green (EXIT=0), run 2 plan/mobile cell DETECTOR_ERROR 'failed to enter plan mode' (graded violation, fail-closed correct). The round-3 guarded re-click calibration reduced but did not close this race. Zero real geometric violations either run. Impact: a ~flaky guard in the standing deploy chain forces reruns. Fix-shape candidates: second guarded re-click with longer backoff, or wait on a plan-state DOM receipt (body.mt-plan-active) instead of timing. OWNER: fold into QUEUE ITEM 36 family (detector calibration) next mt e2e mission.

## 2026-07-16 ~15:1xZ — LIGHTHOUSE NO_FCP: S1 (debounce) SHIPPED but INSUFFICIENT; S2 spec receipted
S1 outcome, honest: debounce live on production (717c3b0, five-guard chain green). REAL win receipted: D-condition probe main thread now RESPONSIVE (evalMs 130 vs >10s), mobile-emulation load 7s -> 1.3s. But CI rerun 29500574636 against fixed production: STILL NO_FCP on map.html; local lighthouse post-fix also still stuck in waitForCPUIdle. Necessary, not sufficient.
S2 ROOT MECHANISM (receipted this wake): map.html line 89 carries body+header+script chain; line 93 is a 293KB single-line inline PARK GeoJSON (155 features, ~12.7k coord pairs) executed PARSER-BLOCKING before </body> — paint waits on sync leaflet + inline map init + 293KB parse + L.geoJSON SVG polygon render + ~539 marker adds (profile: 8s _setPosition + 7.7s program). FCP never fires within Lighthouse's budget on slow runners.
S2 FIX-SHAPE (structural, mission-class, NOT hand-edit): (a) externalize line 93's PARK blob to /data/park-boundaries.json (precedent: /data/scenic-enrichment.json), fetch async post-init, L.geoJSON on arrival with the same style/options; (b) verify header paints early (it is static text at line 89 start); (c) optional if (a) insufficient: defer non-critical layer inits via requestIdleCallback. OUTCOME CHECKS: local lighthouse completes WITH A SCORE (no NO_FCP/PAGE_HUNG; scripts/diag-lh-hang-probe.mjs stays green) + CI rerun green — would be the workflow's first honest green.
CI-CONFIG COMPANION (small, honest, non-masking): mt-audit/lighthouserc.json settings.maxWaitForFcp=60000 so the gate MEASURES a slow page (bad score) instead of erroring — regressions stay visible as score deltas; pair with S2, never instead of it.
OWNER: author mt-lh-boot-cpu-s2.mission.txt next wake (fresh context for the line-93 surgery patcher; S1's staged-artifact + anchored-patcher fix-shape applies).

## 2026-07-16 ~16:2xZ — OPERATOR INTAKE: transcript-driven video EDITING pattern for the video playbook
Operator relayed (with a shared article + his own assessment): terminal video editing via Claude Code — WhisperX word-level transcript JSON as the editing surface, algorithmic cutting (filler words / pauses >0.5s computed from timestamps), ffmpeg slicing, Remotion/programmatic overlays, self-correction loop at cut boundaries (30ms audio fades, bounding-box checks). His question: add to the video playbook — YES.
FIT: we already run the GENERATION half (HyperFrames + ffmpeg + Whisper large on laptop + gemma vision QC — mt-promo receipts). This adds the EDITING half for real footage: talking-head, tutorials, short-form. Playbook-shaped: rigid rules, receipt-checkable outcomes (a cut list is a JSON artifact a verdict panel can judge).
OWNER: fold into WARROOM-INTAKE playbooks addendum + WEBSITE-PACKAGE-INTAKE-2026-07-16.md video phase as 'footage-editing pipeline' — spec step: (a) verify WhisperX-class word-level timestamps from our existing Whisper install (it may need the whisperx package or --word_timestamps flag), (b) prototype mission: one talking-head clip -> transcript JSON -> cut-list JSON -> ffmpeg slice -> boundary-fade -> vision/audio QC receipt. Operator also recalls video-editing notes somewhere on nxtbeast — sweep Desktop\ai book + AnythingLLM corpus for them when nxtbeast returns (it is down right now; add to the nxtbeast-return checklist).

- 2026-07-16T16:28:29.164Z EXTERNAL SIGNAL: NEW CI FAILURE on nxtlvlyt/muddytires-pages — 1 new failed run(s) (.github/workflows/lighthouse-ci.yml@main#29514911186). Auto-filed by external-signals-poller (gap-external-signals-poller); verify with: gh run list -R nxtlvlyt/muddytires-pages --json conclusion,workflowName,headBranch,createdAt,databaseId -L 20
