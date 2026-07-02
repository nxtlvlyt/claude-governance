# QUALITY-STANDARD.md — what "completed to our standard" means, per deliverable class

Drafted 2026-07-02 by the conductor from this session's receipts, at the operator's concern:
"I'm not sure if QC has actually completed things to our standard yet." Root cause of the
doubt: the standard was never written — floors enforce fragments; the rest lived in the
operator's head and was discovered one screenshot at a time. This file IS the standard.
The verdict panel rubric, the golden-mission bar, and every "done" claim answer to it.
Operator taste-slots are marked ⟨OPERATOR⟩ — they bind once he edits or ratifies them.

## The universal bar (all classes)

A deliverable is COMPLETE only when ALL of:
1. **Landed** — files present AND the change is in the deployable tree (patch-id, not presence).
2. **Pushed** — on the canonical mainline, no divergence.
3. **Deployed** — live in production (witnessed: byte-match + marker), or explicitly staged
   with the gap tracked in doneness.
4. **Outcome-verified** — a REAL user path exercised against REAL production data returns
   real information (the e2e bar: no fallbacks, no filler, no dead fields). Grep for your
   own code is NOT verification.
5. **Reachable** — a shipped asset is referenced by a page a user can reach (no dev-cli class).
6. **Honest when empty** — missing data renders as an honest empty state that invites
   contribution, NEVER as fabricated content (no fake stars, no "Cool place", no wrong
   attribution).
7. **Receipted** — every claim above has an executed receipt (sahih over da'if: an executed,
   independently-witnessed check outranks an asserted one).

## Per-class bars

### code-repo / user-facing feature
- All universal bars + parse-clean (every script block), no duplication (structural guard),
  containment (ALLOW-FILES), no undeclared shrinkage of existing files.
- Mobile-first render check: the feature is verified ON THE RENDER PATH USERS USE
  (receipt 2026-07-02: the Apply button existed in code, was off-canvas on phones;
  the bottom-sheet path was never checked — both caught by the operator, not QC).
- ⟨OPERATOR⟩ visual/taste bar: what does "looks right" require? (screenshot baseline diff?
  specific spacing/contrast rules? — visreg-baseline mission is the hook for this)

### data / enrichment
- Grounded: every generated claim traces to a source (mechanical groundedness gate).
- Attributed: source + license named in the artifact.
- No filler: an entry with nothing real is OMITTED (verify step greps for filler classes).
- Schema-verified against REAL production data, never imagined fields
  (receipt: m.description/m.why_cool did not exist).

### docs
- Complete (no truncation/mid-sentence starts), no undeclared shrinkage, named authorship
  context, and the doc's claims match the code it describes at commit time.

### engine changes
- Selftest suite GREEN at HEAD (a red suite ships nothing on top of it).
- New floors carry regression tests INCLUDING false-flag cases (receipt: 4 live-confirmed
  false-flags shipped in a floor with only positive tests).
- Activation verified (running daemon reloaded), not just committed (committed-as-done
  is the documented lie).

### research / extraction
- PLAN-GRADE bar: revenue/pricing/acquisition/differentiation facts with evidence — not
  descriptive summaries ("X has feature Y" is THIN).
- ⟨OPERATOR⟩ what business questions must every competitor/project scan answer?

## Known QC gaps (open, honest — tracked in STATE queue)

- e2e verifier covers popups/leaderboard/Apply only; add-spot, plan-my-day, GPX, offline,
  oracle, community-submit, admin, and the MOBILE BOTTOM-SHEET path are uncovered. The
  verifier grows per-failure today; the golden-mission harness (queue #7) makes it grow
  per-feature instead.
- Verdict panel: reachability check (queue #2), refuter seat (#1), receipt-grading (#4),
  completeness critic (#3) — designed, not yet built.
- Visual QC: no screenshot-diff baseline yet (visreg-baseline mission in flight).
- This standard itself: unratified draft until the operator edits/approves the ⟨OPERATOR⟩ slots.

## How this file binds

- **The QC seats' Faith files embody the seat-relevant bars** (operator ruling 2026-07-02):
  validator.faith.md carries the correctness bars ("The Quality Standard I judge against");
  auditor.faith.md carries the boundary-class bars ("The quality boundaries I enforce").
  getFaith() loads the faith as every dispatch's system prompt — so the seats now SEE the
  standard on every verdict, not just when a framing happens to include it. This file stays
  canonical; faith sections cite it and are updated when it changes.
- The verdict panel's phase-3 rubric cites the class bar; a finding without a bar violation
  carries no weight; a bar violation cannot be waived by any seat.
- Golden missions encode one bar each; the harness runs them on every engine change.
- The conductor's DONE judgments quote the specific bar lines met, with receipts.
