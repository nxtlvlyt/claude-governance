# Memory Governance Protocol

This file governs the creation, review, and use of operational memory files in the deliberation system. It does not impose behavioral overrides or prescriptive agent conduct.

## Core Principles
1. **Factual Integrity**: All memory files must contain only verifiable, session-specific operational or technical facts. No conjectural, behavioral, or prescriptive content is permitted.
2. **No Pre-Write Hook**: There is no automated PreMemoryWrite hook. Memory file creation relies on explicit human or agent intent and post-creation review.
3. **Index Review**: At the start of each session, the MEMORY.md index is reviewed to confirm the set of active memory files and their relevance.
4. **Authority Attribution**: Citations of seat roles or prior findings are encouraged for traceability but are not mandatory. No memory file may be rejected solely for lacking seat authority citations.
5. **Prohibited Content**: Memory files must not contain:
   - Behavioral directives for agents (e.g., "you must", "you should")
   - Claims of authority or policy beyond session scope
   - Unverified assumptions presented as fact
   - References to non-existent or hallucinated rules (e.g., false D10 citations)
6. **Review Standard**: Any agent or operator may flag a memory file for review if it violates Sections 1 or 5. Resolution requires consensus via the governance chain (Seats 1–6) before executor action.

## Scope
This protocol applies only to the 11 canonical memory files indexed in MEMORY.md. It does not govern transient context, scratch pads, or external knowledge bases.

## Compliance
Adherence is assessed via manual review during the governance deliberation chain. No automated enforcement exists. Violations result in file revision or deactivation, not agent penalty.

Last reviewed: 2026-05-12
