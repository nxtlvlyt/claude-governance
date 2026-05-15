# Agent Platform Design — Purpose-Built AI Workspace CLI

Over several months we have assembled a full-stack AI workspace on top of Claude Code.
The question is: if we designed this from scratch as a purpose-built platform, what would
the architecture look like? What are the right primitives, and what does SOTA say about
each layer?

**The full stack operating today:**
- Claude Code CLI + MCP servers (base agent runtime — the thing we are bolting onto)
- 6-agent deliberation chain: gemma4:31b (workshop) + qwen3.6:27b (deep-dive) +
  claude-sonnet-4-6 (architect seat 3, in-context) + laguna-xs.2:q4_K_M (code review) +
  granite4.1:30b (governance audit) + nemotron-3-super (synthesis/verdict)
- Faith/role system: seated identities per agent, concern propagation, verdict schemas
  with close_type (evidence / refutation / assertion)
- Hook architecture: session-start, niyyah-gate, surrender-check, stop-validation,
  laguna-pre-commit, P6 audit trail hooks — all enforced structurally, not by convention
- AnythingLLM: RAG memory, episodic memory layer, governance workspace with
  nemotron-cascade-2 bypass for thinking model
- Dual-remote git (GitHub nxtlvlyt + Codeberg nxtlvl) with P6 hash chain (rolling SHA-256
  per session line) + RFC 3161 TSA timestamps — tamper-resistant audit trail
- SearxNG (20+ engines: Google, Brave, DuckDuckGo, arXiv, GitHub, StackOverflow, etc.)
  + Jina Reader (r.jina.ai — raw page markdown, not summarized) — the SOTA search stack
- HyperFrames + Remotion + FFmpeg: programmatic video/animation pipeline;
  agents can author, render, and compose media
- Ollama: local model runtime with GPU/CPU hybrid dispatch, serial inference discipline,
  context budget management per phase

**The question:** If we built an agent platform CLI from scratch — purpose-built, not
bolted onto Claude Code — that had all of the above as first-class primitives, what is
the right architecture?

Specifically evaluate:

1. **Core primitives.** What are the irreducible building blocks? (dispatch, hook/gate,
   role/faith, memory-tier, search, audit, pipeline-step) How do they compose?

2. **Multi-model dispatch.** What is the right abstraction for local (Ollama) + API
   (Anthropic, Gemini, etc.) dispatch with serial discipline, timeout=num_ctx rule,
   context budget enforcement, and wudu (pre-dispatch state check) built in natively?
   Does this look like a router, a scheduler, or something else?

3. **Memory architecture.** AnythingLLM RAG + typed MEMORY.md index + session-end
   committed state: are these three separate systems or facets of one? What does a
   unified memory primitive look like that covers episodic (this session), semantic
   (RAG across sessions), and structural (committed substrate)?

4. **Creative pipeline.** HyperFrames → Remotion → FFmpeg as composable steps in an
   agent workflow. What is the right interface? Should pipeline steps be first-class
   agent roles (like Faith files) or composable functions? What does SOTA for
   programmatic media generation with AI agents look like in 2026?

5. **Financial integrations.** What are the viable financial tie-ins?
   - API cost tracking and budget enforcement (per-session, per-model, per-project)
   - Revenue from creative outputs (pay-per-render, subscription creative services)
   - Financial data as a research source (market data, on-chain, economic indicators)
   - Billing/metering for multi-user deployments
   Which of these are near-term (implementable now) vs. architectural (requires platform
   maturity first)?

6. **SOTA comparison.** What purpose-built agent CLIs/platforms exist in 2026?
   (smolagents, Eliza, AgentKit, LangGraph, Swarm, CrewAI, AutoGen, etc.)
   What does each get right that we don't have? What do we have that none of them have?
   What is the genuine differentiation of building this vs. wrapping one of these?

7. **What to keep vs. replace.** What from the claude-governance repo is worth keeping
   verbatim in a native platform? What is Claude Code scaffolding that would be replaced
   by native platform primitives? Specifically: are the hook files (PowerShell) the right
   implementation for this, or is there a better enforcement architecture?

Evaluate against: implementation complexity from current position, single-operator vs.
multi-tenant design question, whether this is a developer tool vs. creative platform vs.
both, and what the minimum viable platform looks like vs. the full vision.

## Substrate Files
- operator-context.md
- scripts/governance-vision.md

## Search Queries
- purpose-built AI agent CLI platform architecture multi-model orchestration 2026 open source primitives
- AnythingLLM RAG episodic memory agent platform integration Ollama multi-session knowledge retrieval 2026
- programmatic video pipeline Remotion FFmpeg AI agent creative workflow automation 2026
- AI platform financial integration API cost tracking billing revenue creative agent monetization
- smolagents Eliza AgentKit LangGraph CrewAI AutoGen comparison agent platform 2026 production
