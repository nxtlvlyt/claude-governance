# Chain Quality Deliberation

The 6-agent deliberation chain (gemma4:31b → qwen3.6:27b → Seat 3 synthesis →
laguna-xs.2 → granite4.1:30b → nemotron-3-super) is the core quality mechanism
of this governance system. The chain runs on local consumer hardware (RTX 4090,
192GB RAM, Ryzen 9 7950X3D) with no frontier model involvement in the local seats.

**Question:** Given the current prompt design, context window configuration, search
integration, and concern propagation logic in deliberate.py — what are the highest
impact improvements that would increase the quality of verdicts produced by the local
model seats? Focus on: prompt structure, context management, search grounding, and
concern propagation. What does SOTA look like for a local-model multi-agent deliberation
chain in 2026, and how far is this implementation from it?

## Substrate Files

scripts/deliberate.py

## Search Queries

- multi-agent LLM deliberation chain quality local models prompt engineering 2026
- local LLM multi-agent system context window management concern propagation patterns
- retrieval augmented generation RAG quality local models search grounding techniques
- governance AI agent chain quality evaluation metrics verdict accuracy 2026
- ollama local model multi-agent orchestration best practices production quality
