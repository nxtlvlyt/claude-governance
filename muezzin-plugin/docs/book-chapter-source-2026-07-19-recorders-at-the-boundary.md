# The Recorders at the Boundary: Why This Compaction Process Is State of the Art

*Chapter source / position paper — 2026-07-19. Claims are marked LIVE (running
today, receipted), BUILT-ELSEWHERE (running in a sister project), or DESIGNED
(specified with receipts, queued). Nothing here is aspiration dressed as fact.*

---

## I. The problem nobody else takes seriously enough

Every long-running AI agent eventually hits the same wall: its context window
fills, and something must be thrown away. The industry calls the remedy
"compaction" — compress the conversation into a summary and continue on top of
it. It sounds like a storage detail. It is actually the single most dangerous
moment in an agent's life, because **compaction is where an agent's deeds
become its record — and whoever controls the record controls the truth.**

The industry's standard answers, as of mid-2026:

- **Vendor auto-compaction** (Claude Code, Cursor, and peers): a model writes a
  summary of its own conversation, unverified, and the next context trusts it
  wholesale. Nobody checks the summary against what actually happened.
- **Truncation** (most open-source frameworks): silently drop the oldest turns.
  The record isn't summarized; it's amputated.
- **Checkpointing** (LangGraph and graph-state frameworks): faithfully persists
  *machine state*, but a state snapshot is not a handoff — it carries no
  narrative of intent, no open questions, no "what was I in the middle of."
- **Memory layers** (MemGPT-lineage systems): move facts to external storage —
  genuinely useful, but they store what the agent *chose to write*, and an
  agent mid-drift chooses badly. Nothing audits the choosing.

The common defect: **every one of these trusts the agent's own account of
itself at exactly the moment the agent is least trustworthy** — end of a long
session, context saturated, drift accumulated. The industry verifies code with
tests and deploys with gates, then lets the agent's memory of the entire
session pass unexamined into the next instance.

We have a corpus receipt for what that costs. A sister project (the Antigravity
book pipeline) ran forty-four sessions with a compaction ritual but no
verification of the written handoff: **eight of the forty-four handoff files —
18% — were completely empty.** Silent deaths. The next instance woke with
nothing, and nothing announced it. And the sharpest specimen in that corpus is
worse than emptiness: a state file that confidently recorded a working
111,000-character file as "DESTROYED — a 12-line stub." Four audit passes later
the file was proven intact; the mandated "recovery" would have overwritten
working code. **The record itself was the liar** — and in a compaction-based
architecture, the record is all a successor has.

## II. What we run instead

Our process treats the compaction boundary the way aviation treats landing:
the most instrumented moment, not the most casual one. Four layers.

**Layer 1 — LIVE: the record exists before the boundary.**
Substrate-first continuous writes: every decision, diagnosis, queue change, and
receipt is committed to files *as it happens*, not recalled at the end. By the
time compaction fires, the durable record already exists outside the context
window; the summary is a courtesy index, not the ark. The founding directive:
"What is written in files, committed to git, and captured in documentation is
what the system actually says. Your memory of what was discussed is not truth."
Receipt: the very session that produced this document was compacted mid-shift
during a production marathon and resumed without losing a thread — five
features shipped across the boundary.

**Layer 2 — LIVE: the boundary is instrumented.**
A PreCompact hook fires before the vendor's summarizer runs. It extracts the
operator's still-open messages from the raw transcript (so in-flight questions
survive even if the summary forgets them), snapshots git state in every
relevant repo, writes a structural handoff file as a guaranteed floor, has a
local model draft a handoff digest, and injects a bootstrap block that the
summary must carry at its head. If the instance wrote nothing before the
boundary, the hook's fallback file says so explicitly — a stub that admits
being a stub, never a blank.

**Layer 3 — LIVE: the far side is gated, not trusted.**
The next instance cannot act on the summary it inherited. Mechanical gates
block every substantive tool call until it has re-read the governing documents
from disk and declared its intention against them. The inherited summary is
treated as advisory; the substrate is authoritative. This inverts the industry
default, where the summary IS the successor's reality. Receipt: this session's
own first four file-reads were refused by the bootstrap gate until the
orientation reading was demonstrated.

**Layer 4 — DESIGNED (queued, receipted): the two recorders.**
The piece that completes the architecture: at the boundary, two small local
models independently witness the handoff — one records **structure** (does the
handoff have the required form: open work named, state complete, nothing
empty), the other records **groundedness** (does the handoff match the deeds
actually done in the transcript). Two recorders, different ledgers, neither
able to author or block — they flag, append their verdicts to the record with
ruling IDs, and the reckoning belongs to the next instance and the operator.
The 18% empty-handoff rate in the unverified sister corpus is this layer's
justification; its design constraint — recorders witness, never intervene —
was settled by the operator's own naming, which brings us to the name.

## III. Kiraman Katibin — the pattern the industry hasn't found

Islamic tradition holds that every person is attended by two angels, the
*Kiraman Katibin* — "the noble recorders" — one on each shoulder, each keeping
an independent written record of what was actually done. Three properties
define them, and each is an engineering specification:

1. **There are two, and they are independent.** Not one scribe whose account
   stands unchecked — two records that can be compared. A single summarizer
   (the industry standard) is a single point of narrative failure; the sister
   project's lying state file is what that failure looks like in production.
2. **They record deeds, not claims.** The recorders write what was done — not
   what the person says about themselves. Groundedness verification against
   the actual transcript is exactly this: the handoff is checked against the
   deeds, not accepted as testimony.
3. **They do not intervene.** The recorders never block, never judge in the
   moment, never author the life they witness. The reckoning comes later, from
   an authority that reads the record. This settles a real design question most
   verification systems get wrong: a blocking verifier becomes an author with
   veto power, and its errors become the system's errors. Witnesses that flag
   without blocking preserve both the record's integrity and the actor's
   accountability.

The convergence here is the remarkable part. The sister project *named* its
compaction steward Kiraman Katibin but built one seat. We built the two-witness
architecture without the name. The operator — reading about both in the same
evening — saw that they were the same pattern, and the naming immediately
improved the engineering: it resolved "should the witnesses block?" (no —
recorders don't intervene) in a way that also honors this system's oldest
standing law about small models: they exist to make you look again, not to be
right.

That is what a fourteen-hundred-year-old jurisprudence of testimony,
transmission, and record-keeping contributes to agentic engineering: not
vocabulary, but **settled answers to design questions the field has barely
begun to ask.** The industry is at "summarize and hope." The tradition starts
from "no account stands without independent witnesses, and the witness who
alters the record is the gravest corruption." One of these frameworks was
built for exactly this problem; it just wasn't built for machines.

## IV. The honest scorecard

| Capability | Industry standard | This system |
|---|---|---|
| Durable record independent of the summary | rare | **LIVE** — substrate-first writes |
| Open questions survive the boundary | no | **LIVE** — hook-extracted verbatim |
| Structural floor if the agent wrote nothing | no | **LIVE** — admitted-stub fallback |
| Successor forced to re-orient from source | no | **LIVE** — bootstrap + intention gates |
| Handoff verified against actual deeds | absent in the field | **DESIGNED** — the two recorders, queued |
| Empty/malformed handoff detected | absent (18% silent death, receipted) | **DESIGNED** — round-trip read-back, queued |

Two rows honestly say DESIGNED. They are queued with owners, their justifying
receipts are in the register, and this document will be stale — in the good
direction — when the batch lands. What no row says is "hope."

## V. Why this stays ahead

A competitor can copy a summarization prompt in an afternoon. What compounds
here is a different loop: every failure of memory across a boundary becomes a
rule; every rule becomes a gate; every gate is tested by the failures that
follow. The empty handoffs became the read-back check. The lying state file
became the deeds-not-claims verification. The operator's question about two
local models became the recorders' constitution. The process is state of the
art not because any one mechanism is exotic, but because the boundary is
treated as sacred ground — instrumented, witnessed, and never, ever taken on
the agent's own word.

The record is what survives you. We built for that; the field hasn't noticed
it's true for machines too.
