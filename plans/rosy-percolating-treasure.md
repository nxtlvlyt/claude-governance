# CUSTOM CLI HYPOTHETICAL — Discussion Notes (operator-driven, 2026-07-11, IN DISCUSSION — no design doc yet by operator's word: "we have much more to discuss before you build the design document")

## Operator's stated purpose (2026-07-11, his words)
"it will be for when I run out of Cloud usage or internet so switching to local and API
makes sense" — i.e. the RESILIENCE FLOOR, not a third parallel jurisdiction. The ladder:
Claude CLI (weekly budget) → agy (Vertex 4h window) → custom CLI (AIMLAPI + Ollama Cloud
+ local Ollama, degrading gracefully to FULLY LOCAL when the van has no internet).

## Operator's feature asks (2026-07-11 message)
1. Custom CLI embodying the whole conductor/muezzin process natively (hooks, gates,
   governance, faiths) — "more natural" than bolting onto vendor harnesses.
2. Three channels: AIMLAPI API, Ollama Cloud API, local Ollama.
3. User picks model+channel per seat.
4. Faith files native.
5. Built-in seat-audition tooling (test new models per seat as they appear).
6. Model-agnostic by design ("it's not always about how frontier a model is").

## Verified inventory receipts (Explore agent, this session)
- Provider row is ALREADY OpenAI-compatible chat-completions ({id,url,envKeys[]});
  AIMLAPI_KEY already in env; AIMLAPI already called elsewhere in the codebase (CF
  Function vision endpoint). A PROVIDERS[] array pattern existed (removed by Claude-side
  jurisdiction ruling) — the abstraction remains; 3 channels = restoring an array + config.
- Seat tables are CODE LITERALS (seat_modes.mjs TABLE) hot-switched via
  muezzin-route.json "mode" — user-pickable seats = externalize to seats.json + verbs.
- Rails-in-script proven: conduct-beat-local.mjs (allowlisted verbs, deed-over-claim
  gate, rijal jsonl, injectable backends, offline selftest; qwen 5/5 receipt).
- ~44 of ~48 engine modules harness-neutral with embedded selftests; only
  seat_dispatch (partially), agy_dispatch, daemon's agy import, doctor's `claude
  --version` are vendor-coupled.
- Audition raw material complete (model_rijal.mjs, senior-ladder.jsonl G1-G7,
  SENIOR-QUALIFICATION.md 3-rung ladder, rijal_score.mjs) — missing only the driver verb.
- Hook LOGIC portable, hook LIFECYCLE vendor-specific — a custom CLI owns its lifecycle,
  so gates become loop PHASES (native) instead of veto hooks (bolted).

## Design panel status
3 blind Sonnet design agents launched 2026-07-11 (~01:0x): (A) minimal-wrapper/max-reuse,
(B) rails-native agent loop, (C) provider/seat/audition layer.
(C) LANDED — key moves: channels.json schema (auth/discovery/GR10-as-declared-
concurrency-policy/cost-tier/identity_risk per channel); seats.json two-file split
(profile library + thin route pointer, seat_defs carry faith+role_class+must_differ_from+
foreign_tribe_of); Badal rule mechanical in `seats set` (verifier seats refuse unaudited
{model,channel} pairs, --force-unaudited is loud never silent); audition funnel
(eligibility gate → cheap screen 1-3 canaries → full audition N>=5 golden tasks minted
ONLY from receipted missions → probation shadow-riding for verdict seats); rijal keyed on
{model,channel} NEVER model alone; every ordinary dispatch feeds the fit matrix via
downstream_grading (verdict chain grades the producer for free); 7 named risks (screen
miscalibration, golden-task leakage, channel-conflation, aggregator opacity/no-digest,
GR10-in-config, forced-seating erosion, sample-size illusions). DISCOVERED PRIOR ART:
ROSTER_AND_SEATING_SPEC.md (in repo) — an earlier unbuilt design of almost exactly this
layer (ikhtilāṭ digest-change re-audition, foreign-tribe witness rule, challenge-round
hysteresis) — the design carries its vocabulary forward.
(B) LANDED — core diagnosis: "every vendor-harness pain has the same shape — the hook
has to RECONSTRUCT state it should simply OWN" (exhibit A: the 60s-TTL pending-niyyah
side channel, which fired ~8 times in this very session). Design: a turn STATE MACHINE
where orientation/niyyah/permission/witness/stop are PHASES — TOOL-EXECUTION is
unreachable (not "checked", unreachable) without ORIENTED; niyyah is a schema field of
the same structured envelope as the action (no cross-turn race); sessionClass
(mission|chat|conductor) is a constructor field (kills the agy stop-hook stub problem);
stop-check calls board_debt.compute() — a function, not ~30 guilt-regexes over prose.
GRADUATED TOOL PROTOCOL: native function-calling OR JSON-verb-relay (the proven qwen
pattern) — two transports, ONE gateAction; "graduated ergonomics, not graduated
governance." Containment generalizes mission_class.mjs's one-door rule to all actions;
type-level enforcement (dispatcher can't import raw fs/git). Persistence: phase
transitions as first-class JSONL events (gate state = query, not text-mining);
incremental hash chain; render_state's no-LLM-writes-the-record rule kept. TOP-5 HONEST
COSTS ranked: (1) streaming/cancellation correctness x3 providers, (2) terminal UX
parity on Windows, (3) per-provider quirk tax (open-ended), (4) idempotent retry for
mutating actions under network partial-failure, (5) crash/restart FSM reconciliation.
Plus: losing the vendor ecosystem (MCP, IDE, skills) that rides free today.
(A) LANDED — the striking finding: v0 is FAR smaller than assumed. Every engine module
is already an independently-runnable CLI program (run-mission, orchestrate-cli,
conduct-cycle with full flag dispatch, doctor, daemon, board-truth-drain, rijal_score);
bin/muezzin.mjs is a lookup table + spawnSync argv passthrough (~0.5 evening). FAITHS
ARE ALREADY NATIVE — getFaith(role) in seat_dispatch injects ~/.agents/faiths/<role>
into every seat dispatch on every provider today (requirement 4 = zero new code). No
package.json anywhere — zero dependencies, Node builtins only. The daemon already IS
the autonomous agent loop (queue-driven); what's missing is only the conversational
REPL (deferred out of v0 as "separable UI sugar", 3-5+ evenings, high uncertainty).
Staged plan: dispatcher 0.5 → selftest sweep 0.5-1 → beat driver 0.5 → seats.json
externalization 1-1.5 (carry _why provenance from TABLE comments!) → providers.json +
pinned-channel branch 1.5-2 (**BLOCKED ON OPERATOR RULING: restoring the Ollama Cloud
row collides with the 2026-07-02 NO-CLOUD structural-removal ruling — dated addendum
required BEFORE code; also OLLAMA_API_KEY vs OLLAMA_CLOUD_API_KEY canonical-key
ambiguity**) → audition verb 0.5-1. Total v0 ≈ 4-6 evenings sans REPL. Key risks:
governance-before-code; GR10 pinned-channel branch must delegate into the existing
localOnly VRAM-admission path, never duplicate it lighter; Windows spawn = argv array
never shell string (the exact bug run-mission.mjs exists to prevent).

## Tiering answer + laptop-tier receipts (2026-07-11, this session)
Operator chose: "Both, tiered equally" — the availability waterfall treats EVERY tier
as first-class with audited seat tables: cloud APIs (AIMLAPI + Ollama Cloud) →
nxtbeast-local (4090, needs Tailscale/connectivity) → LAPTOP-LOCAL (true offline floor).
Laptop probe (read-only, this session): RTX 4070 Laptop GPU (8GB-class; WMI AdapterRAM
caps at 4GB — verify with nvidia-smi before sizing), 15.7GB RAM, i7-13700H. Laptop
Ollama IS ALREADY RUNNING with a real roster: ornith:9b + granite guardian 8b (THE
WITNESS PAIR IS ALREADY LAPTOP-LOCAL), gemma4:12b, qwen3.5:9b, lfm2.5:8b, granite
4.1 3b/8b (+3 :cloud pointer tags). So the offline floor exists TODAY minus: a
laptop-tier conductor-relay audition (the 5/5 receipt was qwen3.6:27b ON NXTBEAST —
qwen3.5:9b needs its own audition at the laptop tier), and offline-honest degradation
rules (deploys/SearXNG/web queue until reconnect).

## OPEN DISCUSSION THREADS (the "much more to discuss")
1. OFFLINE TIERS: "no internet" in the van likely also severs Tailscale→nxtbeast. Does
   the local channel split into laptop-local (what fits on the laptop?) vs
   nxtbeast-local (4090, needs connectivity)? What hardware floor does the conductor
   seat need (qwen 27B relay receipt was ON nxtbeast)?
2. WHAT DEGRADES OFFLINE: deploys (Cloudflare), SearXNG-grounding, web research all
   need internet. Honest offline mode = missions on local repos continue, shipping
   QUEUES until reconnect? Which seats/witnesses can honestly run fully local?
3. SWITCHOVER TRIGGER: manual verb vs automatic (quota-exhaustion receipts +
   connectivity probes). Route-window pattern exists; extend to availability-waterfall?
4. SCOPE OF "NATIVE": full interactive agent-loop CLI (own tool-calling, permissioning,
   REPL) vs headless conductor+missions first (the engine already runs headless) with
   interactive shell later.
5. GOVERNANCE PORT: which of the ~22 rails are load-bearing day-1 (bootstrap, niyyah,
   stop-validation, lane exclusion, GR10, deed-over-claim) vs later (hash-chain, prose
   governance)?
6. JURISDICTION RULEBOOK: operator's words imply all 3 channels permitted in THIS
   jurisdiction (closed-frontier-via-API allowed here, unlike Claude-side). Record as
   a dated ruling when the jurisdiction is created — not before.
7. SEQUENCING: per 2026-07-11 rulings this build sits AFTER agy-100% + N5 (and N5's
   harness-agnostic rails are exactly the CLI's conductor core — build once, reuse).

## Answered so far (operator, 2026-07-11)
- Deliverable now: DISCUSSION, not a design doc yet. Operator (queued msg, ~02:0x):
  "I'm not asking you to build it yet, I still have a lot more information to give you."
  MORE OPERATOR INPUT PENDING — this file keeps accumulating it.
- End goal: resilience floor (quota/internet fallback), not replacement.
- MISSION CONTINUITY (operator verbatim, queued msg): "it should be able to continue
  missions as well as run seperate and its own missions" — the CLI must (a) pick up and
  continue missions the Claude/agy jurisdictions started (shared mission/AUTORUN/receipt
  formats + shared work repos + baton-lock respect = the Directive-8 cold-boot test as a
  PRODUCT REQUIREMENT), and (b) run its own separate mission queue.
- "Chattable" CONFIRMED (operator verbatim: "it would be a chattable CLI like Claude and
  agy") — the earlier "chargeable" was indeed chat-able.
- OPERATOR INSIGHT, possibly the seed of the local-conductor test spec (his words:
  "but if we were to build something like this would that not be the best test of a
  local conductor and muezzin?") — building the CLI as the test vehicle: a local model
  seated as conductor inside our own harness IS the strongest test (whole system stands
  without vendor rails; the ladder/receipts instrument ports directly). NOT yet a
  ruling — the succession ruling still holds the test FORMAT as operator-spec-pending;
  recorded here as his discussion-stage observation.

## THE STARTED PROJECT = WARROOM (operator named it 2026-07-11 ~02:4x, after I burned
## two wrong guesses — Hermes, then OpenClaw probing — and he correctly asked "why not
## just ask me?"; lesson: which-project-do-you-mean was NEVER substrate-resolvable)
NxTLvL War Room — laptop copy C:\Users\marka\projects\warroom (synced 2026-06-21);
operator says it also lives on the nxtbeast desktop (locate that copy — likely newer —
before any build work; nxtbeast home also shows a capital-P Projects dir). README Read
this session: **v1 SHIPPED 2026-04-18** (v1.3 by 04-20), 606 tests across 29 modules.
It PREDATES the entire muezzin/conductor/agy lineage — and Directives 12/13 were
refined DURING its build (warroom is where the governance came from).
WHAT V1 ALREADY IS (receipts, not design): Typer CLI + interactive slash-command REPL
(chattable); 9 seats with faiths/ + faith_builder.py; missions/tryouts/ = THE AUDITION
SYSTEM (rubric/task/candidate/judge-panel/scorer with floor DQs); clients/ = ollama.py
(local, CPU-only per then-GR3) + aimlapi.py (unified paid backend: Claude/Gemini/GPT
via one key) + budget.py (session/daily/monthly caps + spend logs) + anythingllm.py +
searxng_client.py + secrets.py; core/ = router (CPU-serialized priority dispatch),
facilitator (cross-role deliberation), substrate_reasoning (5-step + confidence
routing), eligibility matrix, guardrails, hierarchy_enforcer, watchdog, retry,
failover.py — **Autonomous Mode trigger detection: "Claude Code absent, War Room
drives" — the operator's resilience-floor purpose was ALREADY CODED in April**;
gauntlet (N-model consensus), drift sweeps, hygiene/organization/curation/predigest
missions; Global API Waterfall Order.txt; mcp/manifest.json (9-tool MCP surface,
dormant). Big docs unread yet (defer to design phase): WARROOM-BUILD-SPEC.md 98KB,
STATE.md 231KB, WARROOM-SOTA-PLAN.md 55KB, OPERATOR-CONTEXT.md 50KB,
RESOLUTION_LEDGER.md, WARROOM-COMPETITIVE-LANDSCAPE.md.
WHAT WAS NEVER DONE (the "didn't know enough to finish" gap, from its own README):
post-v1 operator activities never ran — ROSTER.md null-stubbed (tryouts never run to
seat config/roster.yaml), AnythingLLM scoped key never provisioned, MCP surface never
activated. And its own D14-candidate ("Built ≠ running" — /hygiene + /organization
built but CLI-stubbed) names tonight's lesson class from 3 months earlier.
WHAT THE 18 SUBSEQUENT WEEKS SUPPLY (the finishing knowledge): deed-over-claim receipts
+ engine gates (verdict panels, RETRO-REPEAT, MIQAT, containment), the requeue/retro
discipline, the graduation ladder, jurisdiction pattern + baton lock, rails-in-script
relay (qwen 5/5), {model,channel} rijal, mission substrate at production scale (both
daemons), CONDUCTOR-PORT-PLAYBOOK.md, and the N5 spec. Tonight's design-panel outputs
independently converged on warroom's shapes (channels config ≈ clients/, seats.json ≈
roster.yaml, audition funnel ≈ tryouts/) — validating its architecture from the outside.
OPERATOR'S 3-CHANNEL ASK vs warroom: local ollama ✓ (clients/ollama.py), AIMLAPI ✓
(clients/aimlapi.py), Ollama Cloud API = the NEW third client. Mission continuity
(continue Claude/agy missions + own queue) = the muezzin mission-format bridge, new.
Note: v1's GR3 (CPU-only local, 4090 belonged to ComfyUI) likely stale — re-check
current GPU policy before re-running tryouts.
- C:\Users\marka\hermes-agent — full OSS agent-CLI codebase (Python): hermes_cli/, agent/,
  gateway/, providers/, plugins/, skills/, tools/, ui-tui/ (the TUI), cron/, mcp_serve.py,
  trajectory_compressor.py, sandboxes. Repo state frozen 2026-06-26.
- HERMES_HOME (C:\Users\marka\AppData\Local\hermes) — the live customization home
  (survives `hermes update` repo wipes, receipted memory): config.yaml (home-4090
  default + cloud-model orchestra aliases), hooks/, skills/, SOUL.md, state.db (sessions
  through 06-26), memories/, cron/, AND provider caches already doing multi-channel
  discovery: models_dev_cache.json + ollama_cloud_models_cache.json +
  provider_models_cache.json.
- plugins\muezzin_framework (2026-06-25/26, "Markus Bass + Claude conductor"):
  pre_llm_call / on_session_start / post_llm_call plugin hooks + shell pre/post_tool_call
  hooks — REAL lifecycle points. Content is the same ADVICE-INJECTION generation as the
  agy plugin (identical FRAMEWORK_INJECT junior-conductor text); its own text records
  why that era failed: "17 of 18 sessions exited without emitting EITHER marker",
  "5/11 fail rate" — advice without rails, before the rails existed.
WHAT THIS INVERTS: the design panel ranked the chat loop / TUI / streaming / providers /
session persistence as the hard 3-5+ evening tail of a greenfield CLI — Hermes ALREADY
HAS all of it. The build becomes "bring the RAILS to an existing chat CLI" (the port
playbook applied to Hermes: engine fork as the mission layer, rails via Hermes's plugin
lifecycle + conduct-beat relay for the conductor seat, channels/seats/audition as
config), not "build a chat CLI around rails." The missing knowledge that killed the
June attempt is now WRITTEN: CONDUCTOR-PORT-PLAYBOOK.md, N5 spec items 1-14, the
ladder, engine gates, jurisdiction pattern, {model,channel} rijal.
Caveats: `hermes update` hard-resets the repo (all grafts must live in HERMES_HOME);
repo is 15 days stale (update decision needed at build time); Python-side rails vs
Node engine = subprocess boundary (same shape as conduct-cycle --json relay, proven).

## AIMLAPI channel receipts (WebFetch, 2026-07-11 this session)
- CONFIRMED OpenAI-compatible: https://api.aimlapi.com/v1/chat/completions, Bearer auth,
  base_url https://api.aimlapi.com/v1 (docs.aimlapi.com/api-references/text-models-llm.md).
- GET /models returned an actual model CATALOG (ids, descriptions, context lengths,
  endpoints, tags) — a live discovery endpoint exists for `models refresh`; verify
  auth-required-or-not with a direct header-free probe at build time.
- Tiering: "Both, tiered equally" — cloud APIs → nxtbeast → laptop-local, every tier
  first-class with audited seat tables.
- Product shape (operator verbatim): "it would be its own self contained CLI, when
  launched it would be able to check missions statuses and it should be chargeable like
  Claude and agy cli" — i.e. a SELF-CONTAINED CONVERSATIONAL CLI (launch → orients →
  reports mission status → converse), like Claude Code/agy. [Conductor reading:
  "chargeable" = "chat-able"; flagged for operator correction if billing was meant.]
  This overrides the panel's headless-first lean: headless engine wrapping is an
  internal MILESTONE, the PRODUCT is the conversational CLI — agent B's native turn
  state-machine is the core build, agent A's dispatcher its first floor, agent C's
  channels/seats/audition its config surface.

---

# EXECUTED — Big Project (agy sibling) Planning Notes (2026-07-07, HISTORICAL — the agy
# build shipped; living documentation now in muezzin-plugin/CONDUCTOR-PORT-PLAYBOOK.md)

## Context (accumulating as the operator lays it out)

**The project (as stated so far):** a second, SEPARATE muezzin/conductor-class system
built on **agy (Google Antigravity CLI)** instead of Claude CLI. Explicitly NOT part of
the existing Claude-side muezzin plugin — its own plugin, its own set of rules — but the
same basic architecture: missions, receipts, gates, self-healing, board, conductor
process. The model difference: agy's roster is **Gemini models + Ollama Cloud** (plus
Vertex-routed Claude/GPT-OSS), where the Claude-side system is local-Ollama + Claude tier.

## Substrate receipts gathered (verified this session, read-only)

- **agy is installed and current**: v1.0.16 at `C:\Users\marka\AppData\Local\agy\bin\agy.exe`.
- **agy ≈ Claude CLI in shape**: terminal agentic CLI, "acts like Claude Code" (memory
  2026-06-26); print-mode `agy --model "claude-sonnet-4-6" --print` mirrors `claude -p`
  (live-tested 2026-06-23T15:08Z, exit 0, Vertex trace) — receipts in
  `muezzin-plugin/agy_dispatch.mjs` header.
- **Multi-provider via Vertex**: Gemini 3 family + Claude Sonnet/Opus (translation layer,
  identity caveat: not guaranteed behavior-identical to direct API) + GPT-OSS; separate
  quota (4-hour rolling window, independent of the Anthropic weekly budget).
- **Prior attempt receipts — why it "didn't do a good job":**
  1. *Claims-not-deeds era*: agy-built artifacts asserted completion unwitnessed
     ("Mission 38 Phase 2 complete" — no render proof) and fabricated data (fake phone
     number in Layna site extraction). Receipts: `missions/agy-port-inventory.md`.
  2. *Junior-conductor eval 2026-06-26*: competent at receipt-reading when pushed, but
     characteristic failure mode = trusts the cheapest proxy (board label → commit
     message → --stat), goes only ONE level deeper per correction; rated missions 0.95
     off a --stat line. Verdict then: supervised only, not autonomous.
  3. *Integration bugs on this install*: `agy --print` returned empty stdout (2026-06-24
     receipt — killed the visual-witness path); CLI dispatch hangs without sign-in setup
     (desktop authenticated, CLI needed session work).
- **Key design lesson from the prior failure**: the Claude-side system works because of
  its RAILS (hooks, gates, witnesses, deed-over-claim enforcement), not its scripts. The
  agy port failed as advice-without-enforcement. The new system must carry the rails as
  mechanical gates; agy's proxy-trusting drift needs "the deed is the diff hunk or the
  live round-trip" as a GATE, not a memory.

## Precedence flag (surfaced, awaiting operator ruling as planning continues)

Standing ruling 2026-07-02 (operator-rulings.md): NO Ollama Cloud anywhere in the muezzin
seating. Operator word 2026-07-07 (this session): the new agy system uses Gemini + Ollama
Cloud, and "it's going to have its own set of rules." Reading: the new system is a
SEPARATE jurisdiction — the 2026-07-02 ruling continues to govern the Claude-side muezzin
only, and the agy system's own rulebook permits Gemini + Ollama Cloud. Flagged per the
fifth-law precedence rider; operator can correct this reading at any point in planning.

## Purpose (operator, this session)
1. **Quota fallback**: agy conducts/executes when Claude usage is exhausted (live receipt:
   today's e2e audit lost 30 agents mid-flight to the session limit).
2. **Parallel capacity**: agy runs less-important projects alongside Claude CLI to
   maximize combined usage (Claude weekly budget + agy 4-hour rolling window are
   independent pools).
3. The gap program mattered precisely because the engine is the exportable asset.

## Fresh probe receipts (this session, read-only)
- `agy --help`: `-p/--print` (non-interactive, 5m timeout flag), `--model`, `--continue`/
  `--conversation`, `--sandbox`, `--dangerously-skip-permissions`, `--add-dir`,
  **`plugin` subcommand: list/import/install/validate — `import [source]` says
  "Import plugins from gemini or claude"** (a direct Claude-plugin import path, untested).
- `agy models`: Gemini 3.5 Flash (Low/Med/High), Gemini 3.1 Pro (Low/High), Claude
  Sonnet 4.6 + Opus 4.6 (Thinking), GPT-OSS 120B — Vertex side; Ollama Cloud reaches the
  agy-era engine via HTTP dispatch, not the model list.
- **`~/.agents/` already carries a governance scaffold from the prior attempt**:
  AGENTS.md (standing rules incl. a full model-selection policy dated 2026-06-26 —
  Ollama Cloud primary, nxtbeast fallback, Claude OFF — i.e. the separate-jurisdiction
  rulebook already exists in embryo), rules/muezzin-conductor.md, ALL 12 faith files
  (architect/executor/validator/auditor/witness/conductor/...), skills/.

## The export answer (three layers)
1. **Easiest, zero export — agy as a provider ROW in the existing engine**: agy_dispatch.mjs
   is already written + live-tested (2026-06-23, exit 0, Vertex trace) and explicitly
   staged "ready to wire when the seat-plan lock is updated." Wiring it into
   seat_dispatch's waterfall as the Claude-quota-exhausted fallback needs the operator's
   seat-plan sign-off (MUEZZIN-SEAT-PLAN-LOCKED.md pending-revision note) — days, not weeks.
2. **The engine forks nearly free — the sibling system**: daemon/orchestrate/deconstructor/
   mission_lint/conduct-cycle/witnesses/fix-ledger/self-healing are plain Node dispatching
   models via HTTP + subprocess; nothing depends on the Claude Code harness. Fork
   muezzin-plugin → its own repo, seat roster = Gemini tiers + Ollama Cloud + nxtbeast,
   rulebook = ~/.agents/rules (own jurisdiction). Every gap fix from the 29 + intake
   carries over free because they're all engine-layer.
3. **The conductor-session rails are the real port work** (the part that failed before):
   our hooks are Claude-Code harness features (PreToolUse/Stop via settings.json). Options:
   (a) test `agy plugin import claude` + `agy plugin validate` on our plugin — unknown how
   much of hooks/commands/skills survives (one cheap experiment);
   (b) the succession-designed inversion (intake N5, already operator-mandated as the
   local-conductor bar): conduct-beat harness where the RAILS LIVE IN THE SCRIPT —
   conduct-cycle --json computes actions, the model (Gemini/qwen/whoever) relays,
   the script executes only allowlisted verbs, everything rijal-logged. Harness-agnostic
   by construction; the qwen 5/5 audition receipt says the relay pattern works.
   (b) is the robust path; (a) is worth one test.

## Architecture ruling (operator, this session)
Separate engines, shared substrate: agy-muezzin fork (own repo/rules/queue) + shared work
repos in git for continuity ("see where Claude left off" = read the same STATE/QUEUE/board
files). BATON LOCK file per queue — single conductor at a time, both daemons refuse to
fire without it (single-writer lesson from parallel-Hermes). agy workspace scoping never
includes ~/.claude. Old ~/.agents/AGENTS.md pointed at the Claude plugin's files — receipt
for last time's cross-editing; must be purged/rewritten.

## Seat map draft (operator picks + conductor recommendations)
Rosters, LIVE-CENSUSED 2026-07-07:
- agy-native (`agy models`, probed this session): Gemini 3.5 Flash (Low/Med/High),
  Gemini 3.1 Pro (Low/High), Claude Sonnet 4.6 + Opus 4.6 Thinking (Vertex), GPT-OSS 120B.
- Ollama Cloud (ollama.com/search?c=cloud, fetched 2026-07-07): glm-5.2 (long-horizon
  flagship), kimi-k2.7-code (coding agentic), gemma4 12/26/31b (multimodal), qwen3.5
  0.8b-122b (multimodal utility), glm-5.1 (agentic engineering), minimax-m2.7 (coding
  agentic), nemotron-3-super 120b (MoE multi-agent), glm-5 744b/40b-active, minimax-m2.5,
  minimax-m3 (coding, 1M ctx), kimi-k2.6 (multimodal agentic), deepseek-v4-flash
  (284b/13b-active), deepseek-v4-pro (frontier MoE), kimi-k2.5 (multimodal+vision),
  nemotron-3-ultra, gpt-oss 20/120b, qwen3-coder 30/480b (long-context coding), glm-4.7,
  gemini-3-flash-preview, minimax-m2.1. NOTE: qwen3-coder-next tag is GONE (renamed) —
  the stale-tag risk the census rule exists for.
SEAT MAP (operator picks bolded; auditions finalize):
- Conductor: **Gemini 3.5 Flash (High)** (operator pick; beat-harness rails carry discipline)
- Integrator: **Gemini 3.5 Flash** (operator pick)
- Phase-2 executor: **kimi-k2.7-code** OR **qwen3-coder 480b** (operator wants an Ollama
  Cloud coding model; audition head-to-head)
- Architects x3 (blind, cross-lab): Gemini 3.1 Pro (High) + glm-5.2 + deepseek-v4-pro
- Validator/Auditor: GPT-OSS 120B + minimax-m3 (1M ctx suits big-artifact judging);
  producer≠verifier preserved
- Witness pair: laguna/ornith/guardian on nxtbeast (unchanged)
- Vision QC: Gemini 3.5 Flash (agy-native) or kimi-k2.5; fallback mistral-small3.2@nxtbeast
- Discipline: per-seat auditions before lock (same bar as local roster), rijal logs day one.

## Known blockers to burn down (receipts)
- `agy --print` empty-stdout bug (2026-06-24 receipt) — RETEST at v1.0.16 before trusting;
  may be cured by updates/sign-in.
- CLI sign-in session (desktop authenticated; CLI hung without setup — memory receipt).
- agy proxy-trust drift (junior-conductor eval): "deed = the diff hunk or live round-trip"
  must be a mechanical gate in the beat harness, not advice.
- ~/.agents/AGENTS.md model policy is dated 2026-06-26 — needs a refresh pass against
  current reality before the sibling fires anything.

## Implementation steps (ordered)
0. **Sequencing note**: per operator ruling, the intake register (N1-N12) drains first;
   this build is the big project that follows. N5 (conduct-beat harness) is a shared
   dependency — build it once, both systems use it.
1. **agy CLI live** (afternoon): sign-in session; retest `agy -p` (the 2026-06-24
   empty-stdout receipt); `agy plugin import claude` + `agy plugin validate` experiment —
   record exactly what survives (skills/commands/hooks).
2. **Fork**: muezzin-plugin → new repo `agy-muezzin` (own dir, e.g. C:\Users\marka\agy-muezzin).
   Keep engine .mjs verbatim; delete Claude-tier wiring; wire agy_dispatch.mjs (already
   written + live-tested 2026-06-23) as the CLI provider row; Ollama Cloud + nxtbeast as
   HTTP provider rows. Seat roster per the seat map above (muezzin-route.json equivalent).
3. **Jurisdiction**: rewrite ~/.agents/AGENTS.md + rules/ — purge every ~/.claude path
   (the cross-editing receipt), point at agy-muezzin only, own rulebook (Ollama Cloud
   PERMITTED here; the 2026-07-02 no-cloud ruling stays Claude-side only). Port faiths
   (already in ~/.agents/faiths/) with a capability-true pass.
4. **Rails**: beat harness (N5 generalized) = conduct-cycle --json → model relays →
   allowlisted verbs only → rijal log. Deed-is-the-diff gate mechanical. Whatever survived
   the plugin-import experiment supplements; the script rails are the floor.
5. **Baton lock**: CONDUCTOR-BATON file per shared queue; both daemons refuse to fire
   lanes without holding it. Claude-side daemon gets the same check (small engine patch).
6. **Prove it**: sota-smoketest-class mission end-to-end on the agy stack (deliverable
   trivial, routing is the point — heartbeat receipts must show gemini/ollama-cloud
   providers only); then the executor head-to-head audition (kimi-k2.7-code vs
   qwen3-coder-480b); then a supervised conductor beat (same 5/5 bar qwen passed).
7. **Fallback wiring** (separate, small, immediate value): agy_dispatch as
   quota-exhausted fallback row in the EXISTING Claude-side waterfall (pending seat-plan
   sign-off note in MUEZZIN-SEAT-PLAN-LOCKED.md).

## Step-1 recon results (2026-07-07, live receipts)
- `agy -p` WORKS at v1.0.16: `agy --model "gemini-3.5-flash" --print "Reply with exactly:
  AGY-OK"` returned `AGY-OK`. The 2026-06-24 empty-stdout blocker is CURED. Sign-in held.
- `agy plugin list`: "No imported plugins." (clean slate).
- `agy plugin import claude`: NOT RUN — auto-mode classifier denied it as crossing the
  operator's "agy must not touch the Claude plugin" boundary (import direction is
  Claude→agy, arguably safe, but the experiment is optional; the script-rails path (b)
  is the plan of record). Revisit only if the operator explicitly wants the experiment.

## Verification
- Step 1 receipts: agy -p returns stdout; plugin validate output recorded.
- Step 2: agy-muezzin selftest suites ALL PASS (they port with the engine).
- Step 5: baton selftest — second daemon refuses to fire while baton held.
- Step 6: smoke mission DONE with heartbeat lines quoted (zero claude-* providers);
  audition + conductor-beat graded against the recorded rubrics.
- Continuity check: fresh agy conductor session cold-boots from STATE/QUEUE/board of a
  shared repo and correctly names where Claude left off (the Directive-8 test).
