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
- HyperFrames (HeyGen, April 2026) + FFmpeg: agent-authored video pipeline —
  HyperFrames is HTML/CSS/JS-first, specifically designed for AI agents to write;
  Remotion is React-first and engineer-authored (different tool, different author).
  "React engineer? Use Remotion. AI agent doing the work? Use HyperFrames."
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

4. **Creative pipeline.** HyperFrames (HTML/CSS/JS, agent-authored) → FFmpeg as the
   agent creative pipeline. HyperFrames is specifically designed for AI agents to write
   video by composing HTML — released April 2026, designed for this exact use case.
   What is the right interface for integrating this into an agent platform? Should
   pipeline steps be first-class agent roles (like Faith files) or composable functions?
   Does HyperFrames + FFmpeg cover the full creative output surface or are there gaps?

5. **Financial integrations.** The agentic financial infrastructure is now a developed
   category in 2026. Specific platforms to evaluate:
   - Nevermined: per-token/per-API-call/per-GPU-cycle billing rails ("financial rails
     for the agentic economy" — processes 15,000 events/sec)
   - Paid.ai: AI cost tracking and margin analytics
   - Skyfire: agent wallet abstraction
   - Stripe / usage-based billing patterns for agent-as-a-service
   Which of these integrate naturally with a CLI platform? What does "AI agents as
   revenue endpoints" mean for a platform that generates creative content? Is there
   a financial model where agents earn as well as spend?

6. **SOTA comparison.** LangGraph leads complex multi-agent orchestration in 2026 but
   has no structural enforcement layer — no hooks that block at the OS level, no
   formal governance. CrewAI, smolagents, AutoGen, Pydantic AI, Strands Agents are
   all in the space. The "awesome-harness-engineering" category (MCP, permissions,
   observability, audit) is emerging as its own layer. What does each framework get
   right? What does none of them have that we've built? Is the genuine differentiation
   the structural enforcement (hooks that can't be bypassed by the model), or something
   else? Is it worth building on top of one of these vs. building from scratch?

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
- HyperFrames HeyGen AI agent HTML video pipeline FFmpeg programmatic media generation 2026
- Nevermined Paid.ai Skyfire agent billing financial rails agentic economy monetization usage-based 2026
- smolagents Eliza AgentKit LangGraph CrewAI AutoGen comparison agent platform 2026 production
