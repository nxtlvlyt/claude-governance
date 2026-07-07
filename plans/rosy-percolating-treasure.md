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
Rosters: agy-native = Gemini 3.5 Flash (L/M/H), Gemini 3.1 Pro (L/H), Claude Sonnet/Opus
4.6 Thinking (Vertex), GPT-OSS 120B. Ollama Cloud = census REQUIRED before seating
(model-identity-needs-receipts; last census weeks old — known-era seats: qwen3-coder-next,
kimi-k2.x-code, deepseek-v4-pro, minimax-m3, glm-5.1, nemotron-ultra).
- Conductor: **Gemini 3.5 Flash (High)** — operator pick; beat-harness rails carry discipline.
- Integrator: **Gemini 3.5 Flash** — operator pick.
- Phase-2 executor: **Ollama Cloud coding model** — operator pick; recommend
  qwen3-coder-next (held this seat in the cloud era) or kimi-k2.x-code, decided by census+bench.
- Architects (3, blind, cross-lab): Gemini 3.1 Pro (High) + 2 Ollama Cloud heavies.
- Validator/Auditor: cross-lab from producer seats (GPT-OSS 120B + Gemini 3.1 Pro or
  cloud heavy; producer≠verifier preserved).
- Witness pair + structural review: STAY nxtbeast-local (laguna/ornith/guardian) — cheap,
  proven, no reason to move.
- Vision QC: Gemini 3.5 Flash (multimodal, agy-native); fallback mistral-small3.2@nxtbeast.
- Seating discipline: live Ollama Cloud census first, then per-seat auditions (same bar as
  the local roster got), rijal logs from day one.

## Known blockers to burn down (receipts)
- `agy --print` empty-stdout bug (2026-06-24 receipt) — RETEST at v1.0.16 before trusting;
  may be cured by updates/sign-in.
- CLI sign-in session (desktop authenticated; CLI hung without setup — memory receipt).
- agy proxy-trust drift (junior-conductor eval): "deed = the diff hunk or live round-trip"
  must be a mechanical gate in the beat harness, not advice.
- ~/.agents/AGENTS.md model policy is dated 2026-06-26 — needs a refresh pass against
  current reality before the sibling fires anything.
