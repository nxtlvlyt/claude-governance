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
- **Anything served via Ollama (local or Ollama Cloud) is an allowed seat regardless of
  org.** Claude family seats are allowed and budget-strategic (operator-ratified
  2026-06-10: Claude tier, routing windows, standing Sonnet executor).
- **Use the two budgets TOGETHER intelligently** (2026-06-10): input-heavy seats ride
  flat-rate Claude (Sonnet executor, standing); expiring windows get spent
  (use-it-or-lose-it route windows); Ollama level-4 models (kimi, deepseek-v4-pro)
  never do level-2 jobs when budget is tight. The dial is muezzin-route.json.

## Mission & engine rulings
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

## Meta
- A ruling here changes only by the operator's word, recorded with date.
- STALE-TEXT CLEANUP OWED (ceremony-class, fresh context): user-prompt-submit re-anchor
  + stop-validation guidance + foreign-frontier-validators.md still name the forbidden
  workers as mandatory (EVENT-002). Until cleaned, this file is the override.
