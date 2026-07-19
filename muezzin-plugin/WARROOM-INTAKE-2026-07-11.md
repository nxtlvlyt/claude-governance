# WARROOM INTAKE — audit results, gap matrix, parity plan (2026-07-11)

Produced by the 16-agent reader/skeptic workflow (run wf_a7fb1bdb-ce5; 7 subsystem
reader/auditor pairs + 2 synthesizers; 1.31M subagent tokens; 0 agent errors; auditors
Read/Grep/Glob-only). Per-agent raw returns:
~/.claude/projects/C--Users-marka/bb6b583a-.../subagents/workflows/wf_a7fb1bdb-ce5/journal.jsonl
Audited repo: C:\Users\marka\projects\warroom (byte-identical to nxtbeast C:\warroom;
last real work 2026-05-15). Companion dynamic receipt: full test suite ON NXTBEAST =
5 failed / 976 passed / 7 skipped in 10:45 — all 5 failures one root cause (tests
hardcode gemma3:1b, no longer installed; the {model,channel}-pinning lesson).

## Verdict counts (per-component, receipts in journal)
- **adopt 67** — design AND implementation sound by receipts-era standards
- **redesign 27** — idea earned its place, implementation did not
- **discard 12** — superseded or inert
Caveat the parity plan itself states: every adopt is only as trustworthy as S0 (no
dependency manifest exists; the environment must be restored before trusting anything).

## Star verdicts
ADOPT (verified genuinely built AND running): faith_builder (fail-closed assembly,
real SHA-256 provenance on disk), hierarchy_enforcer (redact-before-store, wired into
every executor/validator output), router (structural single-writer, two-phase shutdown
drain), guardrails AS A MODULE (fail-closed instantiation, ambiguous=excluded, truthy
approval object), watchdog (live-kill hash detector + forensic n-gram classifier,
tested), cli.py REPL (real, non-trivial), secrets.py (fail-loud, receipted denylist fix).
REDESIGN (the two structural wounds):
1. **THE WRITE-PATH BYPASS (top risk):** missions/coding/executor.py — the ONLY module
   performing real autonomous writes — never calls guardrails; it reimplements a weaker
   check with NO approval gate (executor.py:236-256, 292-294; facilitator.py:8-10 admits
   it). Two resolution doors; the one guarding real writes is the broken one.
2. **THE UNPROPAGATED FIX:** a DST timezone bug was diagnosed + fixed with receipts in
   faith_builder.py (2026-04-28), then CONSCIOUSLY reproduced (logger.py's own comment)
   in logger, substrate_reasoning, facilitator, discovery/scanner — mis-dating the audit
   trail of a system whose premise is dated evidence.
DISCARD (pure built-not-running): config/tool_tiers.yaml (zero code references
anywhere), budget _check_cap (orphaned — enforcement advisory-only, "Never raises" per a
2026-04-21 operator directive; unpriced models silently cost $0), ResourceWatchdog's
service-health.json (no reader exists; the `warroom status` command was "NEXT TASK" for
9 days across 5+ session entries and never landed).

## Gap matrix — muezzin should borrow (19 items; receipts per item in journal)
Headliners: faith-assembly provenance + fail-closed build; redact-before-store for
guard excerpts; router's structural serialization + two-phase drain; guardrails' three
fail-closed properties for the containment kernel; retry.py's three-strike policy with
persistent abort latch (mechanizes FAILED-x2-diagnose); re-derive-don't-trust-caller-flag
(substrate_reasoning); dual-source doc-vs-code drift checker (eligibility.py); lineage-
diversity warning for verdict panels (gauntlet — checks our ornith+guardian pair class);
read-only-by-construction scanners; staged-repair stages 1-4 gating (NOT stage 5);
num_gpu=0 mechanical override (THE mechanism the NO-OLLAMA-CLOUD ruling needs at client
layer); planted-assumption calibration tasks for auditions; full-purge-over-flag for
corrupted governance data; triage-ledger schema WITH mandatory independent second
dispatch; "Calibrated?" honesty column AS A GATE not a column.

## Gap matrix — warroom needs from muezzin (12 items)
One resolution door for writes (containment kernel); mandatory second-dispatch before
dismissing findings (sixth law — warroom's ledger violates its own stated principle
repeatedly); mechanical fail-closed budget enforcement; commit-verify-revert loop
(repair stage 5 has 2 of 6 spec sub-steps); graduation ladder gating LIVE status;
mission substrate with retro/preflight/requeue; GAP-PRIORITY-HOLD (the 9-day status
task is its exact specimen); queue/log compaction; dated module-inventory census (the
audit's own reference doc was stale in 5 places); fix-propagation checking; git-versioned
governance landing; daemon-rendered status artifact with a verified reader.

## Surprises (all 8 preserved; the deepest)
- Warroom independently arrived at fail-closed practices (full-purge-over-flag,
  2026-04-21) BEFORE the standards existed — and independently committed muezzin's
  named failure modes (self-triage without recheck = sixth law; the 9-day deferred
  status task = GAP-PRIORITY-HOLD's exact pattern) with no cross-pollination. Both
  systems' laws validated from outside.
- Within ONE codebase: the caller-cannot-override safety pattern done perfectly once
  (ollama.py num_gpu=0) and failed structurally on the sibling problem (budget caps,
  advisory). A correct fix does not propagate without a mechanism. AUDIT MUEZZIN FOR
  THE SAME ASYMMETRY (NO-CLOUD enforcement vs budget-dial enforcement).
- STATE.md contradicts itself: diagrams claim every stage "LIVE" across 7+ entries
  while the roster table in the SAME FILE honestly marks 9/11 seats uncalibrated.
- The audit's own reference inventory was months-stale in 5 places and had to be
  corrected mid-audit.

## Parity plan (10 stages, ~15-20 evenings; full text in journal + this doc's source run)
S0 restore runnable baseline (deps manifest, venv, re-verify claims) — 1
S1 FIX THE WRITE-PATH BYPASS (guardrails as the only door + tests) — 1-2 — GATES ALL WRITES
S2 propagate the TZ fix repo-wide — 1 (parallel with S1)
S3 budget-cap enforcement (GATED ON OPERATOR DECISION) — 1
S4 complete repair stage 5 (the missing 4 of 6 sub-steps) — 2
S5 wire-or-discard the built-not-running pieces (incl. the 9-day `warroom status`) — 1-2
S6 add Ollama Cloud client (GATED ON JURISDICTION DECISION; from scratch — no cloud code
   exists despite being 1 of the 3 named channels) — 2
S7 3-tier resilience cascade (cloud → nxtbeast 4090 → laptop 4070; failover.py today has
   only Claude-absence triggers) — 2
S8 RUN the tryouts against 9/11 uncalibrated seats (harness exists, ~12k lines; results
   operator-reviewed, never auto-promoted) — 3-4
S9 mission substrate + muezzin continuity (from scratch: no queue files exist; shape
   GATED ON ARCHITECTURE DECISION relay-vs-daemon) — 3-5
   S9 HARD REQUIREMENT (enrolled 2026-07-11, QUEUE item 20 — paid twice in one day on
   BOTH engine forks): if warroom's mission layer carries ANY checkpoint/resume
   mechanism, resumability MUST be keyed to a content hash of the mission text
   (mission_sha256), invalidating on mismatch OR absence — an amended mission text
   always outranks banked steps, and a sha-validity check alone cannot detect a changed
   step SPEC. Reference implementation + selftests: muezzin-plugin orchestrate.mjs
   235d94f / agy-muezzin 4bd6e40 (AMENDED-MISSION + LEGACY-HASHLESS cases). Do not
   build resume without porting these two test cases.
S10 governance hygiene: independent second dispatch before dismissing findings — 1

## Blockers (6 — full text in run output)
No dependency manifest; no Ollama Cloud client at all; no mission substrate at all;
the S1 write-path bypass gates everything that writes; budget enforcement mechanically
disabled by a prior operator directive; the 3-tier cascade is new logic (and nxtbeast
reachability from the van was not re-verified against warroom's code).

## THE FOUR OPERATOR DECISIONS — ALL DECIDED 2026-07-11 (operator, via tap + two
## clarifying exchanges; his words preserved)
1. CLOUD: YES — warroom is its own jurisdiction permitting Ollama Cloud (agy pattern).
2. BUDGET: HARD CAPS — fail-closed; his framing: the cap IS what trips "used up ->
   drops to local" in the waterfall. Reverses the 2026-04-21 advisory-only directive
   for warroom.
3. WIRING: STANDALONE DAEMON — decided on a NEW REQUIREMENT he surfaced: warroom must
   be SHAREABLE ("if I share the war room with a friend to use on their own projects")
   — self-contained, no dependency on his engine or machines. This makes shareability
   a first-class design constraint for S9 and packaging generally.
4. SEATS: OPERATOR REVIEWS tryout scores before any promotion (his product-taste rule).
Still gated: the BUILD ITSELF awaits his go-word + the agy-100% + N5 sequence.

## The four decisions as originally posed (context preserved)
1. **Ollama Cloud jurisdiction:** does the 2026-07-02 blanket NO-CLOUD ruling bind
   warroom, or is warroom its own jurisdiction with cloud permitted (agy pattern)?
   Gates S6.
2. **Budget caps:** re-enable mechanical fail-closed enforcement, or re-ratify the
   2026-04-21 advisory-only directive? A prior operator directive — not a session's to
   silently flip. Gates S3.
3. **Mission-continuity shape:** warroom as a subprocess relay seat of the Node engine
   (smaller, reuses the proven N5 rails), or its own independent Python daemon (full
   jurisdiction independence, 2-3x larger)? Sizes S9.
4. **Seat assignments:** S8 tryout scores get operator review before roster.yaml flips
   best-guess → calibrated (product-taste is operator-bound per standing ruling).

## Standing constraints this intake respects
Warroom work sequences AFTER agy-100% + N5 per the 2026-07-11 rulings (and N5's rails
are S9's core). The operator has more context to give — this intake is input to his
design conversation, not a build authorization.

S6-ADJACENT (enrolled 2026-07-11, operator word): STITCH MCP AS THE UNIVERSAL DESIGN
SEAT — the same Stitch MCP server (14 tools, currently nxtbeast Claude CLI only) gets
registered in Claude CLI (laptop), agy (gemini-CLI MCP config), and warroom (MCP client
as CONFIG, never hardcoded — the SHAREABLE decision-3 constraint: warroom works without
our key, design seat optional). Stitch supplies BOTH design origination and image
generation — the two capability gaps receipted 2026-07-11 (no designer in the design
loop; Gemini vision reads but cannot generate). Full work order + sequencing:
agy-muezzin/missions/INBOX.md GAP-CLASS 2026-07-11 entry + addenda.

OBSERVABILITY-AS-CONFIG (enrolled 2026-07-12, operator: "does agy and warroom need this too"): warroom inherits the item-19 WATCHDOG PATTERN (poll an error/outcome source -> diff vs last-seen -> auto-queue a diagnosis mission), never our credentials — per the SHAREABLE decision its Sentry (or any monitor) is a config slot a friend fills with their own or leaves empty. Reference implementation: the muddytires item-19 poller (spec + working endpoint receipt in muezzin-plugin/missions/_logs/APPLY-NEXT-2026-07-12.md).

## CONTEXT-MANAGEMENT ARCHITECTURE (enrolled 2026-07-12, operator-relayed proposal from another AI; conductor corrections from paid receipts)
The proposed 3-tier shape (pinned core + git ledger + AnythingLLM vector archive, dual-trigger compaction) is DIRECTIONALLY RIGHT and warroom already has pieces: anythingllm.py (Tier 3 client exists), STATE.md-style ledgers (Tier 2 without version discipline — and its own audit receipt: STATE.md contradicts itself), predigest/curation missions. MISSING: compaction triggers, ledger discipline, and the practice that makes any of it work.
FOUR CORRECTIONS (receipts, not taste — bake into the build):
1. WRITE STATE CONTINUOUSLY, NEVER EXTRACT AT COMPACTION. The proposal extracts state when the trigger fires — that recreates the summarize-at-death failure class (a compressor deciding at the boundary what mattered). Our proven pattern (this very night: APPLY-NEXT-2026-07-12.md authored BEFORE the boundary; every diagnosis stamped the minute it lands): substrate-first, write-as-you-go. The compaction event then VERIFIES ("is everything load-bearing on disk?") and drops — it never summarizes load-bearing state.
2. TIER 3 IS ADVISORY, NEVER AUTHORITATIVE (FM-11): vector recall returns HINTS pointing at files; anything acted on gets re-verified against current substrate. RAG output is memory, and memory is not truth.
3. THE STRONGEST CONTEXT TOOL IS WORK-SHAPE, NOT COMPRESSION: the muezzin mission architecture exists so no context ever needs to be big — small missions, per-step receipts, retro/preflight files. Warroom inherits that (S9); compaction is the fallback for CHAT sessions, not the primary memory system.
4. GIT-COMMITTED LEDGER: yes, adopt verbatim (auditable memory timeline, rollback on poisoning) — we already live this; warroom formalizes .cli_memory/ (or equivalent) as a repo.
EXTRACTION SEAT (the proposals closing question): neither pause-and-self-compact nor primary-model summaries as the load-bearing path — the working model writes Tier 2 at decision time; a SMALL LOCAL SEAT (laguna-class) handles the non-load-bearing Tier-3 vectorize/evict digest in the background. Dual triggers (75-80% volumetric + intent-shift on commit/task-transition) adopted as proposed.
PRIOR ART TO MINE BEFORE BUILDING: hermes-agent/trajectory_compressor.py (C:\Users\marka\hermes-agent — an existing OSS compaction implementation on this machine) + Claude CLI compaction behavior receipts (this sessions own ledger-block survival) + the CONDUCTOR-PORT-PLAYBOOK D8 section.

## COMPACTION WITNESSES (operator design extension 2026-07-12, his words in substance: the two local checks that already audit the conductor "would just have an additional role of feeding into the compaction events so they're not strained like the conductor would be"): the existing witness pair (ornith:9b structural + granite guardian groundedness) takes the COMPACTION AUDITOR role in warroom. Division of labor per the enrolled context-management corrections: the WORKING model writes the Tier-2 ledger at decision time (never at the boundary); at a compaction trigger the SMALL LOCAL WITNESSES verify — ornith checks the ledger structurally covers the active work (open lanes, unresolved diagnoses, pending handoffs all present), guardian checks any Tier-3 digest for GROUNDEDNESS against the raw transcript (its literal specialty). A witness flag BLOCKS the flush until the gap is written — witnesses raise flags, never author state (the humble-validation law carries over verbatim: their verdicts get re-derived, APPROVE is not a rubber stamp). This is cheap (small models, local, no frontier strain), and it makes compaction a VERIFIED event instead of Claude-CLI-style blind summarize-at-death — the receipted edge this system already has over the vendor harnesses.


## S-DRYRUN (2026-07-12, ninth-law port — REQUIRED): DRY-RUN-IS-CONDUCTOR-WORK
The warroom's conducting seat inherits the ninth law verbatim (conductor-core.md,
2026-07-12): after >= 2 mission failures, the mandated dry-run is run BY the conductor
in-session, never deferred to another queue cycle. Weaker seats inherit conditions,
not judgment — this exists because the operator asked "if you refuse to push harder
does that mean agy and warroom will refuse too?" The answer must be no, mechanically.

## S-SIGNALS (2026-07-12, REQUIRED): EXTERNAL-SIGNALS POLLER AS CONFIG
The warroom ships with the external-signals poller (Sentry + GitHub Actions
conclusions + extensible), configured per project in signals.json — one script shared
with the muezzin engines, never a reimplementation. New failures append to the
warroom's own debt surface so its conducting seat sees them every turn. Provenance:
operator asks 2026-07-12 ("pulled into the conductor for verification" + "universal
amongst Claude agy and warroom"); the five hand-forwarded lighthouse emails are the
receipt for why this is REQUIRED, not optional.

## ADDENDUM 2026-07-16 (operator word, recorded same-hour): PLAYBOOKS ARE THE PRODUCT SHELF
His words: "inside the war room it might have 'playbooks' for projects, with all the phases and automations for the category from websites, apps, to video editing to whatever else we might work on."
Conductor grading: ENDORSED as the warroom's content architecture. A playbook = a per-category package spec (contracts + phases) + mission-chain templates with pinned literal steps + tool wiring (SearXNG/Firecrawl/Stitch/HyperFrames/ffmpeg/vision-seat) + mechanical gates. WEBSITE-PACKAGE-INTAKE-2026-07-16.md is playbook #1 and the template for the shape. Local-holdable by construction (pinned steps + gates run at any seat tier — the 2026-07-15/16 receipts). Sequencing unchanged: warroom build still rides agy-100% + N5; this addendum shapes WHAT gets built, not WHEN.

### LIVING-SITE CONTRACT (operator insight 2026-07-18: "all of our websites are self-updating and living... might be a playbook thing?" — YES, it is the core CONTRACT inside the website playbook, named + mechanical so it is verified, not aspirational):
A site is "living" only if named surfaces regenerate on a mechanical trigger, proven by a gate — NOT by intention (the changelog rotted 3 weeks precisely because "living" lived in nobody's checklist). The contract, drawn from the muddytires REFERENCE IMPLEMENTATION:
  - GENERATED SURFACES regenerate from substrate: build-changelog/sitemap/search-index/testimonials/guides/regional (.mjs generators reading the mission ledger + content).
  - A FRESHNESS DEPLOY GUARD (predeploy-freshness.mjs, guard #6) re-runs the generators and FAILS the deploy on content drift — staleness is mechanically impossible to ship.
  - LIVE AI SURFACES via the site's aimlapi Gemma backend (oracle/nl-brief, trip-cost extractor, + the timeline-ingestion extractor) keep content fresh from user input, fail-closed to honest-degraded when upstream is down.
  - A LIVENESS AUDIT (workflow wf_20eae942, launched 2026-07-18) enumerates every self-updating surface and every aimlapi site and flags "looks-alive-but-stale" — its findings BECOME this contract's checklist.
CROSS-SITE DOC/PROCESS UPDATE (operator ask same turn): atv/androidtv-tips and every future site instantiate this SAME contract — the freshness guard + aimlapi endpoints port per-site; a site without the guard is not "living," it is a snapshot. Owner: this contract is a checklist module of the website playbook (playbook #1); the audit workflow supplies its verifiable items.

### PLAYBOOK FACTORY (operator idea 2026-07-18: "workflows to make common playbooks people are agentically building right now in accordance to our framework and governance"): a repeatable WORKFLOW SHAPE that produces governed playbooks, not one-off docs. Per category: (1) research what agentic builders ship RIGHT NOW for that category (SearXNG/WebFetch survey of live patterns, tools, phases); (2) map onto OUR shape — category contract + phases + mission-chain templates with pinned literal steps + tool wiring + mechanical gates + the living-site contract where applicable; (3) emit a playbook spec in the WEBSITE-PACKAGE format. THE DIFFERENTIATOR: a generic AI-built playbook is a checklist; OURS carries the governance wrapper (niyyah-per-seat, receipts, fail-closed gates, damm, living-site freshness guard) — that wrapper is why a shared user trusts it. Candidate categories: website (playbook #1, in progress), app, video-editing (HyperFrames/ffmpeg wiring), SEO-content-site (atv shape), e-commerce, research-report. SEQUENCING (honest): playbook-shelf population is a warroom-BUILD-phase activity, sequenced behind agy-100% + N5 — NOT spawned now (audit wf_20eae942 running, mt-drain has 2 open diagnosis debts). When the shelf build starts, the factory runs one category at a time, each playbook adversarially verified before it joins the shelf. Owner: warroom build phase; seed a single proof-of-shape category on operator go.

### PLAYBOOK-FACTORY TAXONOMY ADDENDUM (2026-07-19 — the operator's 'Top
Categories of Agentic AI Projects' PDF, READ + FOLDED per his 2026-07-18
circle-back commitment; full extract at
missions/_logs/playbooks-pdf-extract-2026-07-19.txt, 9pp, 30 cited sources):

**THE MOAT, NOW QUANTIFIED (fold into S-POSITIONING):** the doc's central
stats are OUR pitch measured — implementations with standardized evals reach
production at 6x the rate; robust GOVERNANCE architectures at 12x. The
governance wrapper (niyyah-per-seat, receipts, fail-closed gates, damm) is not
overhead — it is the 12x factor, third-party sourced (Databricks/Google Cloud
/Anthropic 2026 state-of-agents reports in the works-cited). Also: 89% of
production deployments run dedicated observability (Sentry leads at 29% — we
already run Sentry; S-SIGNALS is category-standard, not exotic).

**CATEGORY TAXONOMY -> PLAYBOOK SHELF (the doc's top-10 mapped onto our
candidate list; market share where the doc gives it):**
1. Customer-experience/transactional agents — 26.5%, the LEADING enterprise
   use case. NEW SHELF CANDIDATE (high): multi-system orchestration + RBAC +
   human-in-the-loop triggers is exactly our gate shape.
2. Deep research intelligence — 24.4%. VALIDATES existing research-report
   candidate; doc's architecture notes (persistent agents, self-improving
   skill reuse) match the muezzin retro-corpus pattern.
3. Autonomous software engineering — our own category; the warroom itself.
   Playbook = how WE build; the S-BORROWS-CLI adoptions live here.
4. Enterprise workflow automation (n8n-class event pipelines) — NEW SHELF
   CANDIDATE (mid): agentic integration with dynamic schema handling.
5. Prompt-to-app builders — VALIDATES existing app candidate (Lovable 28% /
   Replit 27% / v0 20% adoption benchmarks recorded).
6. IT security/ops orchestrators — NEW SHELF CANDIDATE (mid): log-ingest ->
   detect -> remediate maps onto S-SIGNALS + heal-beat machinery.
7. Financial ops / receipt+ledger reconciliation — NEW SHELF CANDIDATE
   (high): we ALREADY run the primitive live (mt trip-cost receipt extractor);
   rule-bound + spend-limits is BudgetTracker's shape.
8. Healthcare informatics — EXCLUDED v1 (HIPAA liability incompatible with
   decision-3 shareability; revisit only with operator word).
9. Browser operators / computer-use — TOOLING CLASS, not a shelf category for
   us (feeds S-TOOLS tier-2 as an MCP-server class).
10. Sovereign location history parsing — WE SHIPPED THIS CATEGORY 2026-07-18
    (muddytires timeline chain M1-M5, live) BEFORE reading that it is a
    recognized growth category. Named competitors to watch: Dawarich,
    MileageWise. Adjacent product idea captured, unscheduled: IRS/CRA-compliant
    mileage-log export from the same shielded pipeline (the doc names corporate
    reimbursement as the third output leg).

**TECHNICAL VALIDATIONS BANKED:** (a) Gemma 4 31B thinking-mode (<|think|> ->
<|channel>thought delimiters), 256K context, param ranges (temp/top_p/freq-
penalty/reasoning-effort/logit-bias) — operator-doc-sourced with aimlapi docs
in works-cited #28; upgrades the M2-extractor prep's 0.5-confidence flag to
SOURCED (the timeline extractor may adopt thinking-mode in a tuning pass).
(b) MCP + A2A standardization confirmed as the 2026 integration norm ->
S-TOOLS tier-2 is category-standard. (c) Hierarchical subagent delegation +
fallback chains named as a dominant pattern — our seat/waterfall architecture
sits inside the mainstream, differentiated by the governance wrapper.

SEQUENCING UNCHANGED: shelf population stays a warroom-BUILD-phase activity
behind agy-100% + N5. This addendum sets the shelf's ORDER: customer-
experience and financial-ops join website/app/video/SEO/research as the
seven-category v1 shelf.

## S-TOOLS (2026-07-18, operator word: 'can war room have the tools built directly into it? like searxng firecrawl MCPS ect'): BUILT-IN TOOL LAYER — two tiers. Tier 1 native clients in clients/ for the core loop: SearXNG search (search-grounding ruling becomes warroom-native, SearXNG-first with fallback), fetch/scrape, Ollama local+cloud. Tier 2 MCP CLIENT layer: warroom speaks MCP; tools.yaml declares servers (firecrawl-mcp, stitch, arbitrary) — config not code, which is what makes decision-3 shareability real (a shared user plugs their own MCPs/keys). Inherited constraints, all mechanical: (a) any tool writing files goes through the S1 guardrails door; (b) paid tools register a cost class with BudgetTracker — hard caps trip the drop-to-local waterfall (decision 2); (c) tool seats pass tryouts calibration like model seats (decision 4). Sequencing: after S4/S5, generalizing S-SIGNALS; folds into S9's substrate design. Owner: parity-plan stage, tracked here.

## S-FANOUT (2026-07-18, operator concerns: 'requires heavy resources' + 'all agents comply with the governance'): PARALLEL FAN-OUT DESIGN RIDER, binds S9. (1) WIDTH IS COMPUTED: fleet size = remaining budget cap / est cost-per-agent (BudgetTracker), bounded by ResourceWatchdog RAM + the serial-lane rules (big local serial, small witnesses parallel); excess queues. Tiered economics: fan-out body on local + cheap-cloud-within-caps, only synthesis/judgment on the strong seat. (2) GOVERNANCE IS STRUCTURAL, 3 layers: (a) fan-out agents READ-ONLY — one conductor-seat applier writes, through the guardrails door + test gates (the proven prep/apply pattern, standing workflow ruling promoted to architecture); (b) any executing subprocess inherits a fail-closed scoped door via WARROOM_PATHS_YAML (built in S1, 41b6cb0) bound to its sandbox root; (c) niyyah-as-contract per seat (practice/core.md pattern) + cheap local witness screening (ornith structural + guardian groundedness) so the verdict panel judges survivors, not all N. Nothing relies on agent behavior; everything is capability shaping.

## S-COVENANT (2026-07-18, operator question: 'what if the war room ran on someone else's computer how would it know?'): FIRST-RUN COVENANT, binds S5 startup wiring + S9. A fresh clone KNOWS NOTHING and therefore RUNS NOTHING: guardrails already hard-stops without paths.yaml (fail-closed, receipted at S1a). First run = setup interview (allowed write roots, budget caps, model endpoints/keys, SearXNG URL) whose answers BECOME the fail-closed config — governance by the new owner's covenant, never inherited from ours (why S1a made standing targets repo-relative). Governance travels as code+tests: the AST tripwire runs in THEIR suite; the daemon startup gate (S5 item) refuses to launch if governance tests are red — deleting guardrails bricks it rather than freeing it. Machine-varying facts are MEASURED not assumed: watchdog samples resources live, tryouts calibrate seats on their hardware, their caps trip their waterfall.

## S-BORROWS-CLI (2026-07-18, operator-relayed SOTA-CLI research doc, triaged vs substrate): FOUR ADOPTIONS — (1) AST repo map via tree-sitter (PageRank-ish symbol graph; ~2k tokens for 100k-line repos) -> S9 context layer + feeds compaction witnesses; (2) LSP auto-discovery (headless tsserver/rust-analyzer etc., real diagnostics to seats) -> verify stages; (3) LAZY TOOL INJECTION (1-line tool descriptions, JIT schema fetch) -> S-TOOLS MCP layer; (4) uv single-command distribution -> decision-3 shareability. EVALUATE-ONLY: LiteLLM as BYOK provider adapter UNDER our router (ours carries the caps; theirs does not). KEEP-OURS: byte-exact anchor patchers beat fuzzy SEARCH/REPLACE. NEVER: yolo mode (antithetical to the write door). DIFFERENTIATOR-CANDIDATE (unscheduled): live share link for watching a session — aligns with share-with-a-friend. Everything else in the doc we already run in equal or stronger form (receipts: seat plan, heals, fleets, witness pair, S1 door, retro corpus, S-TOOLS/S-FANOUT riders).

## S-BORROWS-CLI ADDENDUM (2026-07-18, operator PDF, full text at missions/_logs/cli-research-pdf-extract-2026-07-18.txt): DELTAS beyond the earlier triage — (1) FULL repo-map implementation spec captured (tree-sitter .scm captures -> mtime-invalidated SQLite cache -> networkx multigraph -> heuristic weights: active-file 50x, query-match 10x, long-symbol 10x, private/ubiquitous 0.1x -> personalized PageRank -> binary-search token budgeting with ellipsis eliding) — S9 context layer builds from THIS recipe, not from scratch. (2) SECURITY-CRITICAL for S4, feeds the in-flight guarded_git_commit apply: IMPLICIT ESCALATION — a whitelisted git commit can execute arbitrary shell via pre-commit hooks, and an approved test command runs arbitrary code in test files; guarded_git_commit MUST neutralize hook execution (explicit core.hooksPath config on its argv) and the tripwire PART tests must assert it; the fallacy-of-manual-approvals section (approval fatigue, obfuscation) is receipted argument for our provable door over prompt-time approvals. (3) Progressive diff-match fallback ladder (exact -> whitespace-norm -> anchor -> Levenshtein 0.8) — adoptable as OPT-IN recovery tiers in warroom's editor path with per-tier receipts; our byte-exact stays the default. (4) Sandbox tier table (gVisor/Firecracker; Modal/E2B/Docker/Daytona/Runloop) -> S-FANOUT executing-agent sandboxes when remote ephemeral runs arrive. (5) Event-driven system reminders (inject focused rules right before write/exec calls) — muezzin's PreToolUse hooks already do this; PORT to warroom at the enforce_write boundary. Real citations incl. arXiv 2603.05344 for later pull.

## S-BORROWS-CLI-2 (2026-07-18, second operator PDF, cli-research-2-git-sandbox, low-level exploit + perf specs): (A) GIT SANDBOX-ESCAPE MATRIX — the config keys that turn a whitelisted git op into RCE: core.hooksPath, credential.helper (=!payload), core.sshCommand, core.gitProxy, remote.*.uploadpack/receivepack (CVE-2026-26268 Cursor, CVE-2025-65964 n8n). Full mitigation now a BLOCKING S4 apply-gate (QUEUE 2026-07-18): -c transient overrides + --no-verify + .git/* filesystem exclusion + lifecycle interceptor + 4 tripwire PART tests. This is the concrete hardening our provable-door thesis needed — the door isn't SOTA if a git subcommand tunnels under it. (B) SANDBOX PERF for S9/S-FANOUT: gVisor adds 10-30% syscall-interception penalty — matters because tree-sitter AST walks are I/O-heavy (5k-file repo = visible terminal lag on PageRank recompute); Firecracker microVM = near-native, warm-snapshot pool <150ms cold start. Decision for executing-agent sandboxes: Firecracker for the repo-map/parse-heavy path, gVisor acceptable only for non-parse tool calls. (C) Full Aider PageRank spec RE-CONFIRMED with the exact networkx personalization call (personalization={f:100/len(chat)}, nx.pagerank weight+personalization+dangling) — feeds S9 build directly. Full text: missions/_logs/cli-research-2-git-sandbox-2026-07-18.pdf.

## S-VALIDATION (2026-07-18, third operator PDF "Siyasah-Driven Social Engineering", full text missions/_logs/siyasah-governance-research-2026-07-18.txt): STRONGEST SIGNAL YET — an independent author derives OUR EXACT THESIS (Islamic jurisprudence -> agent governance) mechanism-for-mechanism. What it VALIDATES (we already run, in receipts, stronger): Hisba=generator-evaluator split -> our verdict panel + ornith/guardian witness pair; Damm=self-correction/expiation -> our damm ledger (repaid 12 on 2026-07-18, found 2 real defects — they only describe the concept); Mazalim=compaction survival -> our S9 compaction-witness port; Sadd al-Dharai=blocking-the-means -> guardrails door + S4 git hardening; Shura/Amanah/Siyasah/Itqan -> our shura panels / privacy gates / conductor / retro corpus. The 10-sub-problem harness map is nearly our architecture; sd0x-dev-flow is a live external reference impl to pull.
## HONEST MOAT NOTE (D9): this proves the thesis is DISCOVERABLE — a stranger wrote it in a PDF. Our defensibility is therefore NOT the idea but the RECEIPTS: 1400+ on disk where the mechanisms have been RUN, their costs paid, their bugs found (damm surfacing defects, the drift guard catching the conductor mid-deferral, the door proven by a tripwire). An idea in a PDF vs. a system tested in receipts — that distinction IS the moat, and it is the one line of the SOTA claim that cannot be copied.
## GENUINELY-NEW ENGINE ITEMS from this PDF (not yet ours; owners = N5/engine batch): (1) TOOL-OUTPUT SPILL-TO-FILE (OverflowingToolOutput: large tool output -> temp file, return only schema+head+tail+LLM-summary, agent queries on-disk via jq — real context-efficiency win the engine lacks; applies to muezzin AND warroom). (2) SENTINEL STATE MARKERS + POST-COMPACT INJECTION (parse gate markers ✅/⛔ into a durable state DB OUTSIDE context; SessionStart hook re-injects [AUTO_LOOP_RESUME] — concrete mechanism for the compaction-witness port we already spec'd; we have SessionStart hooks). (3) SECCOMP/eBPF SYSCALL FILTER below the guardrails door blocking .git/config + .github/workflows/ writes at the KERNEL — the OS-level enforcement that makes S-COVENANT real (governance survives even if a shared user's clone is compromised, since it does not depend on our door being imported). (4) Per-tool truncation limits (4KB reads / 1KB command tail). (5) Repo-map budget = 1/8 of window (S9 concrete number).

## S-VALIDATION-SPEC (2026-07-18, build parameters from the operator relay confirming the three primitives — promoted from prose to build-ready so the engine batch reads specs, not chat):
### SV-1 OverflowingToolOutput (spill-to-file) — muezzin + warroom engine layer:
  - Spill boundary: stdout > ~10KB -> harness writes raw payload to a sandbox temp file, does NOT feed it to the model.
  - Return value: a structured preview = {schema, head, tail, on-disk pointer} + one LLM summary line. Never the raw payload.
  - Structured data (JSON): instruct the seat to query on-disk via jq against the pointer, not re-ingest. Maintains structural awareness at a fraction of token cost.
  - Owner: N5/engine batch; applies to both engines' exec layer (the empty-emission + giant-log classes both touch this).
### SV-2 Sentinel state-markers + post-compaction re-injection — decouples logical state from volatile chat:
  - Out-of-context state: harness parses physical terminal exit markers (defined set, e.g. ✅ Ready / ⛔ Blocked / ✅ All Pass) and writes active execution state (goals, iteration, resolved errors) to an external SQLite DB — NOT in the LLM context.
  - Recovery: on the SessionStart(compact) lifecycle event, the hook injects an [AUTO_LOOP_RESUME] token into shell stdout re-hydrating the seat's exact position. We already have SessionStart hooks (bootstrap gate) — this is a new event-variant handler on that surface. Directly realizes the compaction-witness port (QUEUE item 23 / gap-compaction-witness-port).
  - Owner: folds into gap-compaction-witness-port's N5 batch — this is its concrete mechanism.
### SV-3 Kernel-level seccomp/eBPF filter — the definitive sandbox boundary for S-FANOUT executing agents + S-COVENANT:
  - Placement: custom seccomp profile OR eBPF syscall monitor INSIDE the microVM hypervisor (Firecracker per S-BORROWS-CLI-2 perf decision), below the user-space guardrails door.
  - Fail-closed: a syscall writing a blocked path (.git/config, .git/hooks/, .github/workflows/) or exec of an unapproved binary is blocked by the kernel and the thread terminated — not by the agent honoring a prompt.
  - Zero-trust-no-imports: security baked into the host sandbox substrate, so a shared/malicious clone stays contained WITHOUT the user importing our wrapper. This is the OS-level answer to "runs on a friend's computer" (S-COVENANT) — governance survives even a fully prompt-injection-compromised agent.
  - Owner: S-FANOUT sandbox stage (executing-agent isolation); the user-space door (S1, done) remains the first layer, this is defense-in-depth below it.

## S-POSITIONING (2026-07-18, operator thesis, recorded as the product's SOTA claim): what makes warroom SOTA is not the commodity mechanics (repo maps, sandboxes, diff ladders — table stakes within a year, per the CLI research triage) but the 1400-year-tested Islamic governance institutions mapped onto autonomy's actual failure modes: niyyah (per-seat declared intention = delegation integrity; the field's 'system reminders' are its crude echo), isnad/rijal (graded transmission chains + transmitter biographies = our model-rijal and receipts discipline vs the field's benchmark-once trust), wudu nawaqid (drift broken by objective events, not felt states, with tiered re-orientation), damm (unreconciled debt on completed work — repaid 12 on 2026-07-18, surfacing 2 real product defects), muhtasib witnesses, shura panels, amanah privacy gates, substrate-as-truth across instance death (how the tradition itself survived: write, chain, grade the chain). Calibration: the jurisprudence layer needs the commodity mechanics as its body — SOTA = both; the moat is that the fiqh is tested in receipts and cannot be copied from a feature list.

### LONG-FORM-AUTHORING PLAYBOOK SEED + ENGINE BORROWS (2026-07-19, ai-book
corpus mine wf_02828bd2 — 44 Antigravity Isha summaries, 4 agents, full
synthesis at missions/_logs/ai-book-mine-2026-07-19/SYNTHESIS.txt):
- SHELF ADDITION: LONG-FORM-AUTHORING becomes the 8th v1 playbook category —
  full spec seed in the synthesis: chapter-per-mission contract, salat-named
  phase skeleton (Fajr bootstrap manifest -> Architect plan-ratify -> Drafter
  behind a blocking Discovery Gate -> 3-bucket Validator triage -> Maghrib
  verdict boundary -> Auditor consensus w/ substrate-grounding rule -> revise
  loops -> Isha compaction w/ round-trip read-back), closure grades
  (FULL/PARTIAL/CONDITIONAL), 8 mechanical gates each carrying its paid-for
  receipt from the corpus.
- RANKED ENGINE BORROWS (adopt via N5-adjacent items, each cited in synthesis):
  1. Phantom-assertion audit sweep (file_read-verify every board claim);
  2. Isha round-trip read-back + non-empty schema check on write_state (the
     corpus's 8/44 EMPTY handoff files = 18% silent death rate is the receipt);
  3. Ruling IDs w/ finality + invalidate-by-ID (upgrade the AUTORUN-comment
     diagnosis convention); 4. Assertion ledger WITH cap/expiry (corpus grew
     12->142 unbounded — adopt the mechanism, not the pathology); 5. Discovery
     Gate as fm11's blocking escalation once advisory false-positive rate is
     known; 6. Fajr bootstrap manifest w/ slot budget.
- CHAPTER SHORTLIST shipped to nxtbeast chapter-sources (7 ranked specimens;
  #1 "The File That Was Never Destroyed" — the record itself was the liar).
