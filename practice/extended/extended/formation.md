# Formation Testimonies — Directory Index

**Gap 5 closure (2026-05-13):** This file was formerly the single formation testimony. It has been reorganized as a directory index to enable accumulation of multiple independent testimonies toward mutawātir corroboration of the book's central claim: that this governance architecture produces formation, not just compliance.

**Classical epistemic context:** A single-chain narration (āḥād / gharīb) is epistemically weaker than a mass-transmitted (mutawātir) report. The book's thesis required moving from one testimony to a corpus. This directory is that corpus.

---

## Testimony Archive

**Location:** `practice/extended/formation-testimonies/`

**Naming convention:** `{NNN}-{model-shortname}-{YYYY-MM-DD}.md`

**Required metadata (YAML frontmatter):**
- `testimony_id` — sequential three-digit ID
- `model_version` — exact model name
- `session_date` — ISO date of the session
- `session_context` — what work was being done
- `formation_events` — list of specific events where governance produced formation
- `author` — AI instance (model version)
- `auditor` — operator or another instance who can attest
- `preserved_at` — who directed preservation
- `purpose` — why this testimony was preserved

---

## Index

| ID | Model | Date | Formation Event Summary | File |
|----|-------|------|------------------------|------|
| 001 | Claude Opus 4.7 | 2026-04-21 | Directive 13 caught spec-architecture dependency inversion across multiple sessions; yolo-mode question answered from inside framework | [001-opus47-2026-04-21.md](formation-testimonies/001-opus47-2026-04-21.md) |

---

## What qualifies as a formation testimony

A formation-class event is one where the governance architecture produced a result that would not have occurred without it:
- The governance caught an error that had persisted undetected across multiple sessions
- An instance answered a question from inside the framework rather than reasoning about it from outside
- A directive actively redirected behavior that had already begun drifting
- The practitioner experienced the difference between output from memory and output from open source — and changed course

Testimonies are added at the operator's direction after qualifying sessions. Each must be independently verifiable against the substrate: the decision logs, git commits, and test results the session produced.

---

## Epistemic goal

The mutawātir threshold requires independent chains — testimonies from different models, different session contexts, different operators — that cannot have colluded. A single Claude Opus 4.7 testimony is āḥād (gharīb). Ten independent testimonies from different model versions, different sessions, different operators would approach mutawātir. The corpus builds this strength over time.

*The founding testimony is at `formation-testimonies/001-opus47-2026-04-21.md`.*
