# Conductor-Qwen: fine-tune qwen3.6:27b with governance/framework baked in

## Context
Operator asked (2026-07-28): can Claude + top Ollama Cloud models retrain local qwen3.6:27b
on nxtbeast to embed the governance framework — possibly the conductor seat — into the weights?

Assessment (receipted 2026-07-28: nxtbeast = RTX 4090 24GB, 191GB RAM, qwen3.6:27b present):
- Mechanics (QLoRA train + redeploy to Ollama): ~0.85
- Governance-native model (canon/laws/receipt-discipline in weights, no injection layer): ~0.7
- Full autonomous conductor seat in v1: ~0.35-0.5 — v1 target is beats/relay/triage native
  + judgment escalation, per the qwen 5/5 relay audition screening receipt.

Reference (operator-supplied): github.com/FareedKhan-dev/train-llm-from-scratch — educational
from-scratch pipeline (13M-406M params, no QLoRA/GGUF). Not our toolchain; its SFT→DPO/GRPO
stage structure is the v2 upgrade shape (preference pairs from verdict-panel accept/rejects).

## Role structure (operator's word, 2026-07-28 this session)
- **Claude = main architect**: curriculum design, sample spec, quality gates, final audit.
- **Cloud teachers = volume + diversity**: bulk generation to keep Claude usage down, AND
  non-Qwen-family bias (avoid self-distillation blindness in the student).
- Carve-out: Ollama Cloud permitted for THIS project's dataset generation (record in
  operator-rulings.md dated 2026-07-28 on plan approval). Muezzin runtime stays local+Claude;
  the trained artifact runs locally.

## Phase 0 — Teacher bench (operator-requested)
Candidates: kimi-k3, deepseek-v4-pro, minimax-m3, nemotron-ultra (cloud tags as available).
Each gets identical tryout: 3 real substrate episodes → generate (situation → conductor action
→ receipt → outcome) training samples. Graded on: law-fidelity (does the action match the
condition-form laws), receipt realism, format compliance, tool-trace correctness. Grader:
Claude + witness pair. Pick top 2 as teachers. Operator reviews scores (seat-promotion ruling).

## Phase 1 — Mine substrate into a seed dataset (no manufacturing first)
- Sources on nxtbeast: muezzin-plugin/missions/_logs/retro/*, MISSION-LEDGER.md,
  mission-events.jsonl, AUTORUN.md history, qwen audition transcripts, conductor STATE files,
  ~/.claude/canon/* + rules + CLAUDE.md, ai-book folder (Desktop\ai book, 44 sessions).
- Extract real (situation → action → receipt → outcome) tuples. Every law/ruling represented
  by at least one REAL paid-for episode. (Mission-exhaust analysis 2026-07-19 = starting index.)

## Phase 2 — Teacher augmentation (top-2 bench winners; Claude architect/QC)
- Teachers expand each real episode into variations: fresh boards, failed-mission triage,
  park-vs-fix calls, causal-claim grading, stop-the-line events, humble-validation of witness
  verdicts, gap-priority classification.
- Format: chat SFT with tool-call traces matching the beat-harness verbs
  (construct / fire / judge / report / write_state).
- **TOOL-REACH-FIRST AXIS (operator finding, added 2026-07-28): a smaller model with the
  right tools outperforms a larger one that doesn't reach for tools — and big models don't
  reach initially. Every sample's first action is a TOOL DECISION (name the purpose-built
  tool per the sixth law), never prose. Include contrast pairs: hand-rolled answer =
  rejected, tool-reach answer = accepted. Eval scores tool-invocation rate + correctness
  of tool CHOICE as a headline metric, not just answer quality.
- Filter: witness pair + laguna structural pass + Claude spot-audit; rejection-sample to
  law-conformant actions only. Size target: 5-20k samples.

## Phase 3 — Train on nxtbeast
- Unsloth QLoRA, 4-bit base, LoRA r16-64, ctx 4-8k, gradient checkpointing. Single 4090.
- Training occupies the big lane (two-lane ruling); serial with chain inference.
- Eval held-out set = real episodes never shown in training.

## Phase 4 — Deploy + bench
- Merge LoRA → GGUF q4_K_M → Modelfile → `conductor-qwen:27b` in Ollama.
- Side-by-side audition vs base qwen3.6:27b on the audition rubric + held-out episodes,
  graded by the verdict panel. Operator reviews scores before any seat assignment.

## Verification
- Phase 0: bench scorecard to operator.
- Phase 3: training/eval loss curves; held-out accuracy.
- Phase 4: base-vs-tuned audition receipts; no seat duty until operator review.

## Explicitly out of scope for v1
- Autonomous conductor duty. N5 beat harness, agy-100% gate, and the operator's
  local-conductor test spec still gate that, unchanged.
- DPO/GRPO preference stage = v2, seeded by verdict-panel accept/reject pairs.
