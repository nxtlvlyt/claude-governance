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

## Open items (to be filled by the operator's next questions)
- Purpose/workload of the new system (what missions it runs)
- Where it lives (repo/dir), name
- Which rails port verbatim vs get rewritten for agy's shape
- Conductor seat for the new system (Gemini? which?); witness/verdict seats
- How the two systems relate (shared board? shared QUEUE? fully disjoint?)
