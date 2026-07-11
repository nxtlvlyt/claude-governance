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
- SUPERSEDED 2026-07-02 (kept for history): "Anything served via Ollama (local or Ollama
  Cloud) is an allowed seat regardless of org." Claude family seats remain allowed and
  budget-strategic (operator-ratified 2026-06-10: Claude tier, routing windows, standing
  Sonnet executor).
- **Use the two budgets TOGETHER intelligently** (2026-06-10): input-heavy seats ride
  flat-rate Claude (Sonnet executor, standing); expiring windows get spent
  (use-it-or-lose-it route windows); Ollama level-4 models (kimi, deepseek-v4-pro)
  never do level-2 jobs when budget is tight. The dial is muezzin-route.json.

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
- STALE-TEXT CLEANUP OWED (ceremony-class, fresh context): user-prompt-submit re-anchor
  + stop-validation guidance + foreign-frontier-validators.md still name the forbidden
  workers as mandatory (EVENT-002). Until cleaned, this file is the override.
