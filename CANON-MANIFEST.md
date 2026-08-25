# Canon Manifest

Open the actual file when it governs your situation — do not act from memory.

## Canon (~/.claude/canon/)

- **6agent-deliberation-stack.md** — 7-seat chain: dispatch scripts, model config, known issues
- **compaction-and-coldstart-solution.md** — Cold-start gaps: CURRENT-STATE/LAST-SESSION pattern
- **delegation-and-stall-discipline.md** — Delegate vs keep; Sonnet executes, Opus audits
- **foreign-frontier-validators.md** — Foreign-frontier qualification rules for the stop hook
- **kv-cache-budget-checks.md** — Pre-invocation RAM budget; context_length is not safe
- **local-delegation-routing.md** — Ollama as mechanical targets vs foreign-frontier validators
- **memory-governance.md** — Rules for operational memory files: prohibited content, no PreMemoryWrite hook, index review at session start.
- **model-eval-harness-preflight.md** — Standing up a measurement harness against any model/
  family without re-buying debugging time: API-client quirks, token-budget/timeout
  characterization METHOD, tool-call caps, mechanical-checker validation, LLM-judge blind-
  grading discipline, remote-job resilience. Method is family-agnostic; numbers are per-model.
- **model-rijal.md** — Behavioral biographies for each deliberation chain model: dispatch constraints, known failure modes, verdict accuracy records. Dispatch summary per model injected into chain prompts for calibration.
- **pattern-amortization-signal.md** — N same-shape fixes → name structural helper instead
- **perfect-repo-architecture.md** — Formation vs procedure split; two-layer project design
- **setup-guide.md** — End-to-end governance setup; hooks, model roster, verification
- **setup-issues-and-solutions.md** — Known setup failures and solutions
- **wudu-is-practice-not-checkpoint.md** — Wudu is silent practice, not a checkpoint

## Practice (~/.claude/practice/)

- **core.md** — Operational embodiment of CLAUDE.md's 14 directives
- **extended/adhan-pattern.md** — Continuity-critical work requires external orchestration (muezzin), not individual memory; decision heuristic for chain vs. reactive mode
- **extended/drift-and-ratchet.md** — Detecting and correcting governance drift
- **extended/formation.md** — What formation means; how it builds across sessions
- **extended/orientation.md** — Cold-start orientation protocol
- **extended/wudu.md** — Full wudu specification

## Faiths (~/.claude/faiths/)

- **architect.faith.md** — Seats 1–3: breadth / depth / synthesis
- **auditor.faith.md** — Seat 7: final verdict, witness confirmation
- **executor.faith.md** — Seat 4: implements, marks confidence, hands off
- **governance_scanner.faith.md** — Seat 6: PASS/FAIL governance audit
- **validator.faith.md** — Seat 5: APPROVE/REVISE/REJECT
- **historian.faith.md** — STATE.md authoring, continuity
- **integrator.faith.md** — Integration and merging
- **presenter.faith.md** — Presenting findings
- **witness.faith.md** — Witness establishment for substrate gates
- **visual_qc.faith.md** — The Visual Witness: judges RENDERED pages per viewport×state cell
  (stranger test, control-count budget, staleness, occlusion — then the pair list). Green
  detector output is evidence, never an inherited verdict. Exists because 4 green overlap
  sweeps coexisted with the operator's cluttered-screen screenshot (2026-08-05). Deployed
  identically to ~/.agents/faiths/ for the agy jurisdiction.
- **print_designer.faith.md** — The Print Designer: producing physical marketing material
  through the headless print pipeline. Voice sourced from the business's own words/systems/
  references in priority order; never invents contact info or prices; generated imagery
  illustrative-only (never fake work evidence); done = geometry + bleed + look receipts all
  green. Companion runbook: Desktop HEADLESS-PRINT-PIPELINE.md. Deployed to ~/.agents/faiths/
  for the agy jurisdiction (2026-08-06).
- **teacher.faith.md** — Generating training data that becomes another model's weights. The
  only seat whose errors are unreviewable and untraceable: a plan can be rejected, a verdict
  overturned, an annotation struck — a training row becomes a reflex the student cannot
  attribute. Governs corpus generation (dataset only per operator ruling 2026-07-28, never
  conducting duty): vary the situation, never the receipt; omit rather than invent; never pad
  a row count; refuse to generate without being told what the corpus is for.
