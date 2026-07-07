# Roster & Seating Spec — Dynamic Model Governance for the Muezzin

Status: DESIGN — operator-directed 2026-06-09, ready for muezzin-mission ratification and build.
Provenance: workshopped in-session (Fable 5 conductor) with operator direction; independent
second read by glm-5:cloud (via patched ollama-mcp waterfall — its three findings are
incorporated: digest pinning, normative/historical prose split, rijal succession links).

## Problem

Model strings are hardcoded in ~10 places (hook-injected prose, canon, memory, chain
configs). They rot, and rotted governance text trains instances to distrust substrate
(observed: operator-context.md decay; June-5 corruption event went unnoticed partly from
alarm fatigue). Models also change constantly — names, fields, availability.

## Principle

**Discovery and retirement are automatic. Seating is earned.** A new model in the catalog
is an unvouched transmitter: it gets candidacy automatically, a seat only through
receipts. Removal needs no trust, only detection — fully automatic.

Prose names ROLES. The roster maps roles to models. The pipeline writes the roster.
Humans set policy (eligibility rules, thresholds), never strings.

## Artifacts

- **ROSTER.json** (generated, never hand-edited): role → { model, digest (pinned from
  api/tags — name aliases drift, digests don't), transport (local | local:cloud-proxy |
  cloud-direct), dispatch params (think, num_predict cap, num_ctx ceiling), rijal pointer,
  status (seated | probation), last_validated, seated_since }.
- **Rijal records** (per model+digest, history — keyed by model identity BY DESIGN):
  audition receipts, qualifying-run accuracy, status ladder (candidate → seated →
  probation → retired), seat_history with successor links (no orphaned biographies).
- **Bench ranking** per faith: ordered candidates with audition scores — pre-vetted
  succession when a seat vacates.

Model strings exist in exactly three places afterward: the external catalog (live), rijal
records (history), ROSTER.json (generated current truth). Zero in prose. Normative text
says "witness seat"; historical records keep the actual model names (history is history —
do NOT rewrite old decision logs to roles).

## Process 1 — Init (ta'sis, once)

1. Discover: GET localhost:11434/api/tags + https://ollama.com/api/tags (Bearer
   $OLLAMA_API_KEY). Capture name, digest, capability tags (tools/thinking/vision),
   context, updated date.
2. Eligibility gate (rules): required capability tags per role; context floor;
   **open-weight only** (default policy — excludes e.g. gemini-3-flash-preview; see Open
   Policy Question below).
3. Screening pass (cheap): ONE canary per eligible model — format discipline + a basic
   role task. Bounds init cost across a 25+ model catalog.
4. Full audition for the per-faith shortlist only (see Process 2, step 2).
5. Seat winners; rank everyone else as bench; open rijal records for ALL candidates.
6. Generate ROSTER.json. Init is complete when every seat is filled, every candidate is
   graded, and the roster validates.

## Process 2 — Seating (one ceremony, called by init AND reseating)

**Examiner: Claude (conductor tier) — operator directive 2026-06-09.** Claude ADMINISTERS
the audition; it does not freelance-judge it. The division:
- **Rubric:** the faith file — it defines what the role demands. The examiner compiles
  audition tasks FROM the faith file with the file open (D12), never from memory of it.
- **Grounding:** a SearXNG SOTA sweep per role BEFORE audition construction (per-role
  query domains as in the established pattern: scanner → compliance/fail-closed sources;
  validator → bug-detection benchmarks; etc.) so the bar reflects current SOTA, not the
  examiner's training-data memory. PREREQUISITE: SearXNG is currently DOWN (deferred
  #25/#33 — settings.yml fix + restart). The seating mission cannot run until repaired.
- **Scoring:** mechanical from receipts wherever possible (catch rate on seeded
  violations, format discipline, held_out_oracle pass) — deeds, not the examiner's taste.
  Where a grade is unavoidably qualitative (e.g. synthesis quality), a foreign-tribe
  seated model co-signs the grade; the examiner alone cannot seat a candidate on
  qualitative grounds.
- **Conductor-not-exempt:** audition administration itself emits receipts (task list,
  per-candidate transcript, score computation) — auditable by operator or a later mission.

1. Candidate passes eligibility.
2. Audition: each faith file compiles to golden tasks with RECEIPT-verifiable outcomes
   (deeds-not-claims engine + held_out_oracle — no self-asserted results). Examples:
   scanner faith → seeded violation catch-rate + format discipline (precedent: granite4.1:8b
   disqualified on format drift alone); validator faith → seeded-bug detection rate.
3. Receipts ≥ role threshold → seated. Rijal status updated. ROSTER.json regenerated.
4. Verdict-bearing seats (witness, scanner, auditor — fard) add a probation window of N
   live qualifying runs before full trust. Low-stakes seats (workshop, drafting — nafl)
   may auto-seat on audition alone.

## Process 3 — Reseating (event-driven + periodic)

Triggers:
- **Catalog diff** (standing mission): new model → candidacy (→ screening → bench or
  seat challenge). Seated model vanished → seat vacated, top bench candidate promoted
  through the seating ceremony.
- **Digest change on same name** → ikhtilāṭ: automatic seat suspension + re-audition. A
  new digest is a new transmitter wearing the old name. Old rijal record closes with a
  successor link; new record opens.
- **Canary failure / qualifying-run accuracy below floor** → probation → demotion (bench
  promotes).
- **Challenge round** (periodic): bench may displace incumbents — only by a clear margin
  (hysteresis) and only after incumbent minimum tenure. Prevents seat-thrashing.

Stability rule: seats FREEZE during an active mission — reseating lands between missions
so attribution stays coherent.

## Dispatch integration

- ollama_chat (tools/ollama-mcp/server.js, v1.1.0+) gains a `role` param resolving via
  ROSTER.json; output always labels the ACTUAL model that answered (the waterfall already
  enforces labeled identity/transport fallbacks — never silent substitution).
- Hooks that mention models resolve role→model from ROSTER.json AT FIRE TIME — injected
  text is computed, never stored.

## Policy knobs (the only human-maintained surface)

- Eligibility rules (open-weight policy, capability tags, context floors).
- Audition thresholds per role; probation length (fard seats stricter).
- Challenge margin + minimum tenure.
- Roster staleness window (last_validated older than N days → flagged by health check).

## Eligibility ruling (operator-confirmed 2026-06-09 — RESOLVED, see GOVERNANCE-EVENTS.md EVENT-002)

**No cold dispatch, any model.** Lab of origin is not the criterion; briefing and receipts
are. The original frontier ban's root cause was cold dispatch (context-free prompts
underperforming governance-briefed seats) — the muezzin's briefed-mission path removes
that condition for every model.

Eligibility gate, encoded as rules:
- Ollama-served (local daemon or Ollama Cloud), dispatched only through briefed,
  receipted paths (mission or roster-seated dispatch).
- Foreign-tribe REQUIRED for witness seats: different lab than the seat being audited.
- Open-weight PREFERRED for verdict-bearing seats: proprietary catalog entries (e.g.
  gemini-3-flash-preview) lack digest-pinning, so their rijal records decay invisibly
  across silent provider updates; seat them in non-verdict roles unless the operator
  overrides per-seat.
- The deprecated frontier MCP workers stay dead — cold-dispatch transports, not lab bias.

## Build order

0. PREREQUISITE: repair SearXNG (E:\AI_Storage\docker\searxng\settings.yml — engines
   blocked; edit + container restart) — the audition's SOTA grounding depends on it.
1. ROSTER.json schema + generator from current truth (catalog pull + manual seed of
   today's seats).
2. Resolver module (tiny, importable by server.js + hooks).
3. `role` param in ollama_chat.
4. Catalog-diff standing mission + canary validation (extends the muezzin health check).
5. Audition compiler: faith file → golden tasks → receipts (reuse deconstructor/
   held_out_oracle/model_rijal modules).
6. Hook fire-time resolution (substrate-class edits — full ceremony).
7. One-time prose cleanup mission: model strings → roles in NORMATIVE text only.
