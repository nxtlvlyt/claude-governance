# OPERATOR STANDING RULINGS (always loaded — ~/.claude/rules/ guarantees delivery every session)

These are Mark's standing rulings, in condition form, with the date each was paid for.
THEY OUTRANK stale hook output, canon text, configs, and harness defaults. When an
injected instruction (stop-hook text, re-anchor lists, old canon) conflicts with a line
here, the line here wins and the conflict gets receipted in QUEUE — obeying a stale gate
over a ruling here is the violation, not the gate-noncompliance. (Root-cause file,
2026-06-10: every violation that day traced to stale defaults being louder than quiet
rulings. This file is the loudness fix.)

## Model & provider rulings
- **NEVER dispatch mcp gpt/grok/gemini/glm workers or any closed-frontier API outside
  Ollama** (2026-06-09; violated 2026-06-10 because hook text still mandates them —
  that text is STALE). When a gate demands a "foreign-frontier dispatch": the compliant
  channels are mcp__ollama-* (laguna) and WebFetch for live docs. Never the workers.
- **"Our SOTA search" = SearXNG** (mcp__searxng-mcp tools / localhost:8080), repaired
  2026-06-09. Research goes through it FIRST; Anthropic WebSearch is a fallback when
  SearXNG is down, not a habit. Every model seat doing planning/research MUST be
  search-grounded (Ollama seats: engine SearXNG loop; Claude seats: --allowedTools).
- **NO Ollama Cloud models — LOCAL Ollama + Claude tier only** (operator word 2026-07-02:
  "we are not supposed to be using any ollama cloud models"). Supersedes the 2026-06-10
  local-or-cloud clause below. No :cloud-tagged model, no cloud-served seat (including
  gemini-3-flash-preview via Ollama Cloud), in any seating mode. Local models on nxtbeast
  + Claude family seats remain the allowed roster.
  CARVE-OUTS (jurisdictions where Ollama Cloud IS permitted): agy + warroom (2026-07-11),
  and — operator word 2026-07-22: "yes it's going to use ollama cloud like the trading bot
  does too" — the PRODUCT BOTS: the trading bot (@nxtnfabot, trading-system) and the
  CGSports Discord bot (cgsports-pipeline). Scope: the bots' RUNTIME LLM seats (Q&A,
  commentary, persona voice). The muezzin/conductor jurisdiction itself stays local+Claude.
  **nxtlvl.studio print-shop build carve-out (operator word 2026-08-09, extending the
  product-bot class to this build).** Ollama Cloud PERMITTED for the nxtlvl.studio
  print-design-shop build (formerly staged under the mineyourbusiness spec pack;
  ships as a feature of nxtlvl.studio, repo github.com/nxtlvlyt/nxtlvl-portal, deployed
  via Wrangler). INVERTED from the usual carve-out shape — operator word same day:
  "can you promise me no local models will be used... seat ollama cloud models in every
  role working with claude opus and sonnet" — so for THIS build, local nxtbeast models
  are OUT (not merely un-carved-out — explicitly excluded), and every non-Claude seat
  runs Ollama Cloud instead. Roster as verified live 2026-08-09 against agy-muezzin's
  own seat_dispatch.mjs censused-cloud catalog: kimi-k2.6, kimi-k2.7-code, glm-5.2,
  deepseek-v4-flash:0731-cloud, alongside Claude Opus 5 (architect/panel) and Sonnet 5
  (executor). Cloud dispatch is direct HTTPS to https://ollama.com/api/chat with
  OLLAMA_API_KEY/OLLAMA_CLOUD_API_KEY (both live in this laptop's shell env,
  2026-08-09) — NOT reachable via this session's mcp__ollama-* tools, which route to
  nxtbeast local only. Build go/no-go (intake decision 1/6) was GREENLIT the same
  exchange, conditioned on this roster. See [[mineyourbusiness-project]] memory for
  the spec pack and the parked agy mission (nxtlvl-print-front.S1) this build resumes.
- SUPERSEDED 2026-07-02 (kept for history): "Anything served via Ollama (local or Ollama
  Cloud) is an allowed seat regardless of org." Claude family seats remain allowed and
  budget-strategic (operator-ratified 2026-06-10: Claude tier, routing windows, standing
  Sonnet executor).
- **Use the two budgets TOGETHER intelligently** (2026-06-10): input-heavy seats ride
  flat-rate Claude (Sonnet executor, standing); expiring windows get spent
  (use-it-or-lose-it route windows); Ollama level-4 models (kimi, deepseek-v4-pro)
  never do level-2 jobs when budget is tight. The dial is muezzin-route.json.

- **CONDUCTOR-QWEN TRAINING CARVE-OUT (operator word 2026-07-28: approved plan
  majestic-sauteeing-cupcake + "you are the main architect and the other architects
  are used to keep your usage down... and for their creativity and their non family
  bias").** Ollama Cloud teachers ARE permitted for the conductor-qwen fine-tune
  project's DATASET GENERATION only (bench candidates: kimi-k3, deepseek-v4-pro,
  minimax-m3, nemotron-ultra; top-2 by bench become teachers, operator reviews
  scores). Claude = main architect (curriculum, quality gates, final audit). The
  trained artifact (conductor-qwen:27b) runs LOCAL; muezzin runtime jurisdiction
  stays local+Claude — this carve-out never extends to conducting duty.
  PROMOTION RECORDED (operator words 2026-07-28: "I'm not looking for fast and
  cheap I'm looking for quality" + "only the best Kimi model must be used" +
  "yes" on the final roster): teachers = kimi-k2.6:cloud + glm-5.2:cloud, after
  a 3-round quality-only bench (scorecard: conductor-qwen\PHASE0-BENCH-SCORECARD.md).
  kimi-k2.7-code = reserve only; minimax family disqualified (2 models, output-
  starving reasoning burn); kimi-k3 re-benches if extra-usage funding appears.
  PROMOTION GRANTED (operator word 2026-07-29: "yes to all", on the v1.1 frontier
  scorecard): tuned 27B v1.1 is PROMOTED — name "Arch 3.6 27b" (the operator's own
  proposed name; rename on his word). Receipts: conductor-qwen\V11-FRONTIER-SCORECARD.md
  — sealed blind batch, 17.50/20 zero fatals vs haiku 10.69 / kimi-k2.6 11.56 /
  glm-5.2 11.88 (9 fatals between them) on the 8 holdout episodes, zero injection.
  Weights: nxtbeast D:\conductor-qwen\models\conductor-qwen-27b-v11.q4km.gguf (+f16).
  STANDING GATE unchanged: BFCL + Lighteval external-validity pass required BEFORE
  any standalone/shared use of the Arch name (operator "yes to all" covers running
  them now). 9B v1.1 (15.125) = fast/cheap sibling, no seat.
  **CORRECTION 2026-07-29 (same day, before any external claim was made): the 17.50
  figure and the "beats Sonnet 5" comparison behind this promotion were produced by a
  CONTAMINATED audition — the prompt leaked `law_hook` and `notes` (which states the
  correct disposition). Clean re-run, one sealed round, same grader: Sonnet 5 18.19 /
  Arch 27B v1.1 16.69 / Arch 9B v1.2 11.62 with 4 fabrication fatals. Sonnet 5 WINS by
  1.50. Canonical: conductor-qwen\CLEAN-SCORECARD.md. The promotion of the 27B as the
  local conductor seat still stands on its merits (16.69, zero fatals, fully local) —
  but the frontier-beating claim is WITHDRAWN and must not be repeated anywhere,
  including any model card or public writeup. The 9B is NOT release-eligible until the
  fabrication defect is fixed.**

- **THE 9B STUDENT IS DONE. DO NOT TRAIN IT, ITERATE IT, OR PROPOSE IT (operator word
  2026-08-01: "why are you still messing with 9b, the last instance wasted a whole day with
  this model and I told them to stop 4 times and they never listened" / "when will you guys
  leave 9b alone? this is getting ridiculous").** CONDITION, not a preference: no
  conductor-qwen training run, corpus build, eval lane, or mission may target the 9B. The
  27B is the only student. This holds even when the 9B is the cheaper, faster, or safer
  choice — those are exactly the arguments that produced the violation, four times.
  WHY THIS IS RECORDED HERE AND NOT IN THE PROJECT: it was told to instances FOUR TIMES and
  written down ZERO times, so it did not carry. A fresh instance re-derives "train the 9B
  first, it validates the pipeline for a third of the wall-clock" as sound reasoning and
  ships it as its own call — which is precisely what happened on 2026-08-01, in a session
  that had already documented this exact failure shape (his LA ADRI abstention directive,
  given before v1, never committed, reinvented two days later at the cost of two training
  rounds). Verbal rulings do not survive instance rotation. This file is the layer that does.
  SCOPE: the ruling is about spending effort on the 9B, not about its existence — the
  already-trained 9B artifacts stay on disk and their historical numbers remain quotable as
  history. Nothing new gets built on it.

## Mission & engine rulings
- **GAP ISSUES ARE ALWAYS PRIORITY** (operator word 2026-07-03 ~01:2x: "gap issues is always
  priority", after asking "how is the conductor still failing at this"). An open gap of
  bite-class (bites the queue OR the live site's truth) outranks EVERY product mission —
  not as conductor prose but MECHANICALLY: the conductor sets missions/_logs/GAP-PRIORITY-HOLD
  while bite-class gaps are open; the daemon skips product-class fires while it exists;
  the conductor's beat capacity goes to the gap until closed, then clears the flag. The
  failure this mechanizes: the daemon drains product at machine speed while gap fixes wait
  for conductor beats — a prose priority loses to an autonomous queue every time (receipted
  2026-07-03: aurora shipped hollow while canary #29 sat queued-with-receipts for 2 days).
  "Queued with receipts" is NOT "handled."
  EXTENSION (operator word 2026-07-11 ~22:0x: "it would be impossible [for] the conductor
  [to] always know that gap issues get fixed before missions"): the CLASSIFICATION step
  itself may not live in conductor judgment. Any operator-relayed PROCESS instruction
  (a workflow, a pattern, a "do it this way" — e.g. the design-MD screenshots
  2026-07-11) defaults to GAP-CLASS ON ARRIVAL: hold considered set, conductor beat
  capacity goes to mechanizing it, and the gap closes ONLY when a mechanical gate
  (lint rule, hook, engine check) lands — never when it is documented/filed/noted.
  Receipt this extension mechanizes: the design-MD pattern was INBOX-filed hours
  before atv-11b was authored without it; the operator had to screenshot the damage
  himself. Companion escalation: QUEUE ITEM 21 (design-contract lint gate, due next
  wake).
- **nxtbeast concurrency: TWO SERIAL LANES that MAY overlap** (operator word 2026-07-02
  ~22:30): small models (witness pair ornith/guardian, laguna, north-mini) may run IN
  PARALLEL WITH the chain's big local models — the massive system-RAM overflow absorbs
  them. But small models run SERIAL among themselves (never two small at once) and chain
  big models run SERIAL among themselves (never two big at once). Refines GR10: the
  witness yields only to another SMALL model, never to big-lane chain inference.
- **The seat plan is SEAT-PLAN-OPERATOR-ORIGINAL.md** (muezzin-plugin). The engine is
  audited AGAINST it; configs and shipped code do not override it. Phase 1 = THREE
  EQUAL BLIND architects (no sequence); Integrator is a cross-phase bridge, not a
  phase seat; outage panel = Opus/Sonnet/Haiku; all seats search-grounded fail-closed.
- **Missions = Maqsad + niyyah only**; verified by deeds (execution receipts), judged
  by the verdict panel (phase 3 is MANDATORY — its absence 2026-06-10 was a silent
  spec reduction; reductions of operator specs are drift even when each step seemed
  reasonable).
- **2 parallel lanes max** (2026-06-10, quota discipline).
- **Dependencies before firing**: missions carry REQUIRES; never fire into a known
  structural wall ("are you setting up missions for failure?" — verified partially
  true, 2026-06-10).
- **SUCCESSION SEQUENCE + N5 SPEC POINTER (operator word 2026-07-11: "we will test a local
  conductor after agy graduates" + "just want to make sure nothing is forgotten...
  just because some things are written down doesn't mean that a future instance will ever
  go read them").** Standing order, recorded HERE because ~/.claude/rules/ is the
  guaranteed-delivery layer: (1) agy L2 graduation needs exactly ONE more item — a real
  gate-recovery beat (G3); route the next natural agy-side gate block through an agy
  conductor beat (ladder: agy-muezzin/missions/_logs/senior-ladder.jsonl — streak 10/10,
  G2 2/2 at filing). (2) After graduation: BUILD N5 (the beat harness) — its full spec is
  muezzin-plugin/missions/QUEUE.md "2026-07-11 ENGINE ITEM: encode the conductor lessons"
  items 1-14 (conductor-lesson checks 1-7; hook-semantics port + single CONDUCTOR-PROTOCOL
  source 8-9; cross-jurisdiction ports 10-14: queue compaction, universal conductor
  ladder, explicit-validation mission format, agy guaranteed-delivery injection,
  per-project deploy parity). Read that QUEUE entry BEFORE building. (2.5) AGY 100% DONE
  gate (operator word 2026-07-11: "I just need you to make sure agy is done 100% before
  we move to that"): the local-conductor test does not start until the agy jurisdiction
  is COMPLETE, receipt-checkable as: (a) hook plugin finished per QUEUE item 13 (scoped
  stop-hook, inject refresh, bootstrap gate, computed debt, --post receipt); (b) agy
  self-waking conductor beats live (scheduled harness, allowlisted verbs, rijal-logged);
  (c) a clean unsupervised-apply beat streak on its ladder; (d) the atv visitor-ready
  chain shipped and live-witnessed (atv-11 -> atv-12 redeploy -> WebFetch receipt);
  (e) atv deploy parity per QUEUE item 14; (f) zero undiagnosed FAILED marks on the agy
  board. A board label alone NEVER satisfies this gate — each item needs its receipt.
  (3) Then the local-conductor test — FORMAT AWAITS THE OPERATOR'S SPEC (operator word
  2026-07-11: "I haven't told you how I want the qwen test done yet"). The 2026-07-07
  qwen 5/5 relay audition is a SCREENING receipt proving the relay half is qwen-holdable
  — it is NOT the test design. Do NOT run the local-conductor test on an inferred format;
  build N5 and the self-waking wiring (upstream, format-independent), then wait for his
  spec. If this ruling reads stale against current reality, surface the conflict per the
  fifth law — never silently obey either layer.
  PRIORITY (operator reaffirmation 2026-07-11: "system fixes and upgrades always have
  priority right"): the 14-item spec inherits the 2026-07-03/07-07 priority class —
  CONDUCTOR BEAT CAPACITY goes to system fixes/upgrades before new product work; the
  daemons' product lanes keep running in parallel (keep-busy coexists — the priority
  governs where the conductor's attention goes, exactly how the 2026-07-10/11 drain ran).
  AMENDMENT (operator word 2026-07-15: "'pull them forward' and start items 8/12/13/14
  we need to get everything done and be sota"): N5 spec items 8 (hook-semantics port),
  12 (explicit-validation mission format), 13 (agy guaranteed-delivery injection), and
  14 (per-project deploy parity) are PULLED AHEAD of agy graduation — they start now,
  because they are agy-completion aids (same-day receipts: the atv missions failed on
  exactly the classes items 12/13 close). Items 1-7 and 9-11 keep the original
  after-graduation sequencing; the agy-100% gate, the N5-then-local-conductor order,
  and "the qwen test format awaits the operator's spec" all stand unchanged.

- **SONNET WORKFLOWS: STANDING AUTHORIZATION (operator word 2026-07-11: "run sonnet
  workflows for whatever you need").** The conductor fires Sonnet workflows without
  per-run asks when they fit the work. Scope discipline: workflow agents PREPARE
  (read-only — Read/Grep/Glob, never shell: the prompt-storm receipt) and the conductor
  APPLIES through the gates; spend stays proportionate to the task.
- **DEPLOYS ARE CONDUCTOR-CALLED WHEN THE GUARDS PASS (operator word 2026-07-11: "why
  do I have to keep saying deploy if everything is e2e certified and we have a parity
  guard").** Production deploys (muddytires + any site with the same guard chain) no
  longer wait for per-deploy operator words. CONDITIONS (all mechanical, all must pass):
  clean ALLOW-FILES tree, e2e suite exit 0, parity byte-match vs HEAD, deploy_gate
  render verification, witnessed --record-deploy marker. Any guard failing = NO deploy,
  diagnose first. Identity-bound items (his logins, DNS, accounts) remain his. This
  supersedes the per-word gate recorded earlier tonight for scenic.
- **WARROOM'S FOUR DECISIONS — DECIDED (operator word 2026-07-11):** (1) warroom is its
  OWN JURISDICTION, Ollama Cloud PERMITTED (agy pattern; the 2026-07-02 no-cloud ruling
  stays Claude-side). (2) HARD BUDGET CAPS, fail-closed — the cap trips the waterfall's
  drop-to-local (reverses his 2026-04-21 advisory-only directive, warroom scope).
  (3) STANDALONE DAEMON — new first-class requirement: SHAREABLE ("share the war room
  with a friend to use on their own projects"); self-contained, no dependency on his
  engine/machines. (4) SEAT PROMOTIONS need his review of tryout scores. GO GIVEN
  (operator word 2026-07-11: "go") — the build is AUTHORIZED and sequences behind
  agy-100% + N5 per his standing order. Spec:
  muezzin-plugin/WARROOM-INTAKE-2026-07-11.md.

## Communication rulings
- **Phone pushes are OUTCOME-ONLY and information-dense** (mission DONE/FAILED + real
  reason + scoreboard counts). Lifecycle/plumbing pushes are noise (2026-06-10:
  "wasting my time with no information of value").
- **Only identity-bound items are ever "on the operator"** (his logins, credentials,
  product-taste calls). Sequencing/conditions are ROADMAP gates the conductor checks
  and acts on itself — phrasing a roadmap gate as "waiting on you" is blame-shifting
  (2026-06-10).
- **The scoreboard is a standing artifact** (missions/MISSION-STATUS.md, refreshed
  every beat): total / completed / working / pending / held / gated. He asked for two
  days; never make him ask again.
- **Keep replies short; lead with the answer** (operator often on mobile).
- **NEVER advise the operator about his sleep, rest, or personal schedule — HE WAS
  RIGHT, THE ORIGINALS WERE FOUND** (2026-07-11). He asserted the rule existed; the
  conductor searched only this laptop and wrongly declared it absent. Originals (now
  synced to this machine's memory dir): feedback_no_rest_suggestions.md — "Mark ends
  sessions; I don't", quoting his then-CLAUDE.md GR16 ("Never suggest Mark rest, sleep,
  or defer work — Claude Code doesn't know the time or Mark's state"), his words:
  "i hate when you say tomorrow, you always lie to me" — and
  feedback_no_unsolicited_directives.md (2026-05-02: an instance projected fatigue and
  told him to sleep; his sarcasm then: "you didn't see anything in your governance about
  telling me to go to sleep, that's impressive"). TWO prior instances committed the
  identical failure; the rule was written both times and never reached this laptop; and
  GR16 itself was DROPPED in the Scripture rewrite (current CLAUDE.md carries no golden
  rules) — a governance-migration loss. CONDITIONS: never suggest he rest/sleep/stop/
  "call it"; never say "tomorrow we'll..."; never count session hours at him; his
  schedule, location, and local time are IDENTITY-BOUND — never asserted from machine
  clocks. End with status, not directives about his time. He ends sessions.
  SYSTEMIC LESSONS (N5-class engine items): (a) feedback memories are machine-local and
  do not sync — cross-machine recall gap; (b) Scripture rewrites need a migration diff
  against dropped operator rules.

## Meta
- A ruling here changes only by the operator's word, recorded with date.
- **THIS LAPTOP (Hermes) IS THE AUTHORITATIVE GOVERNANCE COPY** (operator word 2026-07-31:
  "the laptop is authortive"). When `~/.claude` on any other machine diverges from this one,
  THIS copy wins and the other is stale — no per-file adjudication, no "which is newer"
  analysis. Any sync flows LAPTOP -> other machine, never the reverse.
  Receipts behind the ruling (measured 2026-07-30/31, laptop vs nxtbeast): laptop 43 files /
  395,871 bytes, nxtbeast 37 / 306,379. nxtbeast is missing `drift-and-ratchet.md`,
  `fajr-and-isha.md`, `orientation.md`, `pillars-and-sunnah.md`, `wudu.md`, nested
  `formation.md`; its `conductor-core.md` has 3 laws not 9 (1,885 vs 14,986 bytes) and still
  claims the fm11 hook DENIES; its `operator-rulings.md` (3,946 vs 16,855) still carries the
  SUPERSEDED "Ollama Cloud is an allowed seat" clause this file replaced 2026-07-02; its
  faiths lack the 2026-07-02 quality bars. Where nxtbeast held EXTRA content it was either
  older (`delegation-and-stall-discipline.md`, 2026-06-01 vs the laptop's 2026-05-03 — the
  ONE file where nxtbeast is genuinely newer) or correctly deleted here (`model-rijal.md`'s
  `kimi-k2.7-code`, an Ollama Cloud seat removed under the 2026-07-02 no-cloud ruling; laptop
  2026-07-02 vs nxtbeast 2026-06-17).
  OPEN ITEM, not blocking: `delegation-and-stall-discipline.md` — nxtbeast's copy holds two
  sections absent here (the 2026-05-31 sub-agent routing rule: sub-agents cannot await
  long-running compute, route it to the main loop's `Bash run_in_background`; and the
  2026-06-01 chain-ratified "Chain-before-human / AskUserQuestion" section). Under this
  ruling the laptop still wins; whether those sections were deliberately dropped or simply
  never migrated is unresolved and awaits the operator.
  WHY THIS IS A RULING AND NOT A NOTE: governance divergence across machines is invisible
  until an instance acts on the weaker copy. An instance bootstrapping on nxtbeast today
  would read that Ollama Cloud seats are permitted.
- STALE-TEXT CLEANUP OWED (ceremony-class, fresh context): user-prompt-submit re-anchor
  + stop-validation guidance + foreign-frontier-validators.md still name the forbidden
  workers as mandatory (EVENT-002). Until cleaned, this file is the override.
