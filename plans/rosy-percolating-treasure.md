# Big Project — Planning Notes (operator-driven Q&A session, 2026-07-07)

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
