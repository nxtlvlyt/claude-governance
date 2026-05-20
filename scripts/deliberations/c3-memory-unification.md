The operator's governance system has three distinct memory/retrieval systems that currently
coexist without a unified interface or routing layer:

SYSTEM 1 — Auto-memory files (~/.claude/projects/C--WINDOWS-system32/memory/)
A set of markdown files with YAML frontmatter (type: user/feedback/project/reference).
MEMORY.md is an index (~26 entries, always loaded into every session via Claude Code's
auto-context injection). Individual files are read on-demand by the instance when an
index entry looks relevant. Written by this Sonnet instance during sessions.
Strengths: always present in context, structured, fast to read.
Weaknesses: instance-authored (quality depends on what the instance chose to save),
no semantic search, only as current as the last session that updated it.

SYSTEM 2 — AnythingLLM claude-governance workspace
RAG-based semantic retrieval over the full governance corpus (~82KB canon + hooks +
faiths + practice). Model: nemotron-cascade-2. Embedding: nomic-embed.
Access: POST http://localhost:3001/api/v1/workspace/claude-governance/chat
API key: MZTP71P-2W140B4-G62HTQT-TD5X1F1
Config: bypass thinking baked into system prompt; POST /update works (PATCH doesn't).
Strengths: semantic search over full corpus, finds relevant canon sections by meaning.
Weaknesses: only laguna-xs.2 works reliably via MCP timeout; large models need direct API.
Requires AnythingLLM to be running. Governance corpus must be kept in sync with actual files.

SYSTEM 3 — STATE.md pattern (session-end committed narratives)
Each major work area has a STATE.md: ~/.claude (LAST-SESSION-STATE.md, CURRENT-STATE.md),
C:\warroom\STATE.md, D:\Desktop\ai book\STATE.md. Session summaries written at end,
read at start. Committed to git — durable across machines.
Strengths: narrative context, durable, git-tracked, captures "why" not just "what".
Weaknesses: operator-dependent (requires discipline to write at session end), stale between
sessions, no semantic search.

THE PROBLEM:
A cold instance bootstrapping today has no systematic guidance on which system to query
for a given information need. Examples of real retrieval ambiguity:
- "What is the serial inference discipline?" → MEMORY.md has a pointer to feedback_serial_inference_discipline.md, but AnythingLLM has the full operator-context.md section with examples and history.
- "What did the 2026-05-17 session produce?" → STATE.md narratives have this; MEMORY.md has a stale summary; AnythingLLM doesn't have session narratives.
- "What does the surrender-check hook do?" → AnythingLLM can semantic-search the hook source; MEMORY.md has a feedback entry; STATE.md in operator-context notes the fix history.
- "Is the NAS online?" → MEMORY.md has project_nas_crash.md; substrate (api call) is the ground truth; neither STATE.md nor AnythingLLM knows current state.

There is no routing layer that says: "for operational facts, check MEMORY.md; for
governance semantics, query AnythingLLM; for session narrative, read STATE.md; for
current state, check substrate."

Evaluate: What is the correct memory architecture for this operator's governance system?

Specific questions:

1. TIER DEFINITION: Are the three systems naturally tiered (substrate → committed narrative →
   semantic index → advisory memory), or are they parallel alternatives for the same retrieval
   need? What is the correct mental model for how they relate?

2. ROUTING RULES: For each of the following retrieval needs, which system should be queried
   first, and when does the answer require escalation to a second system?
   (a) Current operational state (is X running, what is the current value of Y)
   (b) Governance rules (what does the surrender-check hook require)
   (c) Session history (what did we decide in the 2026-05-17 session)
   (d) Operational constraints (API keys, credentials, model dispatch limits)
   (e) Failure modes (what went wrong before and why)

3. SYNC DISCIPLINE: AnythingLLM's claude-governance workspace must stay in sync with the
   actual canon/hook/faith files as they evolve. Currently there is no automated sync —
   when a canon file is updated, AnythingLLM is not notified. Is this a real gap? What is
   the correct sync mechanism (push on commit, pull on query, or something else)?

4. MEMORY.md COVERAGE: The current MEMORY.md has 26 entries covering feedback, project state,
   and references. What categories of knowledge should NOT be in MEMORY.md (because they
   belong in another system)? Are there entries in the current MEMORY.md that would be better
   served by AnythingLLM retrieval or STATE.md reading?

5. COLD INSTANCE ROUTING PROTOCOL: Write a concrete routing protocol (in the form of
   an ordered decision tree) that a cold instance should follow when it needs to retrieve
   information. This protocol should be short enough to fit in practice/core.md as an
   addition to the objective invalidators section or a new "retrieval" section.

6. WARROOM IMPLICATION: The warroom's AnythingLLM integration (if it has one) and its
   STATE.md are separate from the governance system's. Should warroom and governance share
   the same AnythingLLM workspace, or maintain separate workspaces? What is the correct
   boundary?

## Substrate Files
hooks/session-start.mjs
practice/core.md
canon/memory-governance.md

## Search Queries
- AI agent memory architecture retrieval augmented generation vs episodic memory semantic search 2025 2026
- RAG vector database vs structured memory operational state retrieval LLM agent
- memory tiering hot warm cold AI agent operational constraints
- AnythingLLM workspace sync automation document update webhook
- cognitive architecture episodic semantic procedural memory AI agent retrieval routing
- LLM agent memory systems comparison operational production deployment patterns
