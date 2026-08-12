# Model Eval-Harness Preflight

Generalizes across projects: how to stand up a measurement harness (calibration, tool-use,
self-revision, robustness — any axis) against a new model, in any family, without re-buying
debugging time already paid for once. First distilled 2026-08-10 in conductor-qwen while
building `run_loop_depth.py` / `run_gap_naming_eval.py` against arch-gov-27b-v36 (tuned),
qwen3.6:27b (base), and sonnet-5-aiml — full incident receipts live in that project's
`EVAL-PREFLIGHT.md` and `QUEUE.md`. This file is the generalized method; the project file is
the concrete case it was extracted from. Read this BEFORE trusting a new model's first numbers
on any harness, regardless of what family the model belongs to (Qwen, Gemma, Laguna, or
anything not yet named).

The thesis this file exists to serve: the process has to be good enough to train and evaluate
any model from any family, not tuned to one model's quirks. Section 1 and 5-7 are true
regardless of model family. Sections 2-4 are true regardless of family in their METHOD even
though the actual numbers they produce are model-specific — that distinction is the point of
this file.

## 1. API client basics (true for any OpenAI-compatible endpoint)

- **Set a real User-Agent.** Endpoints sitting behind Cloudflare or similar reverse proxies
  will silently block bare `urllib`/default-client User-Agents (403 / "error code: 1010")
  while `curl`-identified requests pass. Set an explicit UA on every request as a default,
  not only after hitting the failure once.
- **Don't send a null field where "absent" and "present-but-null" are different states to a
  strict schema.** Some APIs 400 on `"tool_calls": null`; omit the key entirely when empty.
- **Don't double-append same-role turns across a multi-round loop.** If the round loop already
  appends its own closing assistant message, a separate "close the round" step must not append
  a second one — most chat APIs reject or mishandle two same-role turns in a row.

## 2. Token budget and timeout — characterize per model, never assume, but always MEASURE

- **A model with an internal reasoning/thinking phase has no guaranteed stop before an output
  token cap.** If the budget runs out mid-thought, the visible answer field comes back
  genuinely empty with no error — indistinguishable from a real failure unless checked.
  Different families expose this differently (visible `<think>` blocks, hidden reasoning
  tokens, or none at all) — do not assume a new model's family behaves like the last one.
- **Don't guess the right token budget. Measure it, every time, for every new model:**
  reconstruct the exact failing message sequence, replay it directly against the raw API with
  usage logging (`finish_reason`, `usage.completion_tokens`), and check whether the failing
  call landed at/near the cap (`finish_reason="length"`) or well under it
  (`finish_reason="stop"`). Only the first is a budget problem — see section 3 for the other.
- **Timeout must scale with the token budget at THIS model's actual decode speed**, not a
  flat guess or a constant copied from a different model. Re-derive the tokens/second
  multiplier per model; do not reuse a prior model's formula verbatim.

## 3. Empty or short answers are not automatically a bug — check before "fixing" anything

- Direct replay is the only way to tell a real bug from real model stochasticity. An answer
  that comes back empty on one run may succeed cleanly on replay (`finish_reason="stop"`, far
  under budget — sampling variance) or choose a different valid path (e.g. another tool call
  instead of answering — also not a bug). **Before changing any harness code in response to an
  empty-answer rate, replay the exact failing call and read `finish_reason`.** If it's not
  landing at the token cap, it is probably genuine model variance — exclude it from the judged
  denominator, do not chase it as a defect.
- Expect a real, non-zero miss/empty rate from smaller, less-tuned, or less RLHF'd models under
  multi-turn agentic loops. A characterized ~20-30% round-level miss rate is a real, acceptable
  property of a given model on a given task shape, not evidence the harness is broken. Do not
  hold every model family to the same miss-rate bar without evidence that bar is achievable.

## 4. Tool-call / turn caps

- Measure the model's NATURAL (uncapped) tool-call or turn distribution on a small smoke sample
  before picking any hard cap. A cap set too tight truncates asymmetrically across compared
  models (whichever one naturally uses more turns gets clipped harder), silently confounding
  any cross-model comparison. Set the cap from observed smoke-sample behavior, not intuition.

## 5. Mechanical (keyword/substring/regex) checkers — validate against ground truth first

- Any checker built on loose matching (single-word overlap, a fixed keyword list, a narrow
  regex) WILL false-positive at scale on a large enough eval. Before trusting its aggregate
  output, hand-read a handful of records it flagged on both sides of the label. Tighten the
  match criterion (e.g. single-word overlap → N-consecutive-word verbatim phrase) only after a
  hand-read failure demonstrates the looser version is wrong, not preemptively or by feel.
- Treat any mechanical checker's first-pass numbers as provisional until spot-checked by a
  human or a second, independent method — never report them as a finding on their own.
- **An "every X satisfies Y" checker is vacuously satisfied by an empty/degenerate
  response** — zero X means nothing violates the rule. Confirmed live: an IFEval-style
  "every word must have prime length" constraint registered a full pass against a
  completely empty response, caught only by chance while hand-reading a candidate row, not
  by the harness itself. This silently inflates any reported pass rate by exactly the
  empty-response rate on that task shape — non-trivial on models/tasks already prone to
  empty generations. Fix: any checker of this shape needs a companion minimum-content
  check, or every result set needs an explicit post-hoc audit for empty-response passes
  before a pass rate is reported as a finding.

## 6. LLM-as-judge blind grading — applies to any model being judged, by any judge model

- **The judge must be neutral** — never one of the models/lanes currently being compared.
  Rotate which model serves as judge based on which models are under test that round.
- **Make grading calls stateless per-record** (fresh context per call, no history carried
  between records) — this is what makes it safe to grade one model's/lane's results in a
  separate batch from another's, with zero cross-batch anchoring risk, by construction.
- **Judge calls will fail intermittently** (empty response, truncated/malformed JSON output) at
  a real, non-trivial rate regardless of which judge model is used — build retry logic in from
  the start (multiple attempts, tolerant JSON-substring extraction), and expect some
  irreducible residual failure rate even after retrying. A nonzero first-pass error rate is not
  evidence the harness is broken.
- **Sample size discipline:** do not trust a trend/curve at n<20 per point for any model, and
  treat a non-monotonic result at marginal n as underpowered/inconclusive rather than as
  evidence of "no effect," regardless of how clean the numbers look. When in doubt, get more
  samples before concluding a null result, not instead of it.

## 7. Infrastructure / operational (applies to any remote-GPU or shared-inference setup)

- **Check for concurrent inference on any shared model server before dispatching** — running
  two generations against the same GPU/server concurrently silently degrades timing and can
  corrupt results. This applies to any Ollama-style or shared local server, any model family.
- **Recurring shell-quoting trap when scripting over `ssh host "remote-shell -- ..."` layers:**
  passing pipes, ampersands, multi-line inline scripts, or complex syntax through a nested
  remote-shell invocation reliably mangles. Fix every time: write the script to a local file,
  transfer it, then execute the transferred file — never construct complex commands inline
  across an ssh/wsl/remote-shell boundary.
- **A backgrounded job's local wrapper reporting "killed" does not mean the remote process
  died.** Verify with a process check on the remote host before assuming a job actually died
  and relaunching it — needlessly relaunching a live job wastes compute and can corrupt output
  files being concurrently written.
- **A remote job whose output is piped LIVE over a network connection dies for real if that
  connection resets** — this is distinct from the previous point: the remote process itself
  gets a broken pipe, not just the local wrapper's view of it. A plain
  `ssh host "remote-cmd" > local.log &` is NOT resilient to network blips. Launch fully
  detached on the remote side instead (session-detach the child process, e.g. `setsid`, plus
  `nohup`, redirecting stdin from null, backgrounded) — a bare `nohup ... &` alone can still be
  killed by the invoking remote-shell wrapper's own teardown; a genuine new session is what
  survives. Verify survival with a process check after a short sleep, not just a clean exit
  from the launch command. Then poll the REMOTE output file via a separate connection rather
  than tailing a local pipe, so a future connection blip interrupts only your view, never the
  job itself.
- **A guard/circuit-breaker that exits mid-record can leave a malformed partial record in the
  output file** — a field the record-writing logic hadn't reached yet when the guard fired
  simply won't be there, and a downstream consumer that assumes every record is well-formed
  will crash on it. If a run is gap-filled with a separate small follow-up run and the outputs
  are concatenated, validate every record's schema and drop malformed/duplicate ones before
  handing the file to any downstream step — do not assume a guard firing cleanly means the
  output file it leaves behind is clean.
- **Batches that cover the same task set are still not comparable unless their PROTOCOL
  matches** — round count, rescue/self-correction mechanism, sampler params, token budget.
  Verify each batch's protocol from its own records (e.g. presence/absence of `round3_*`
  fields), not from memory of how it "should" have been run. Receipt (2026-08-12,
  conductor-qwen): a v3.6 batch run 2-round was nearly merged into a paired comparison
  against a 3-round v37 run — 5 of the 6 round-3 rescues on the 3-round side sat in one
  discordant cell of the McNemar table, i.e. the "difference" was partly the protocol, not
  the model. When protocols differ, either recompute the symmetric subset (e.g. round-2-only
  passes on both sides) or report the asymmetry explicitly alongside the headline number —
  never silently combine. Corollary from the same night: locate batch files by READING their
  key ranges and schemas, not by filename or recency — the file assumed to be "the first
  half" covered a different task window entirely, and only per-file key-range probing found
  the real one.

## Applying this to a new model family

Sections 1 and 5-7 should never need re-discovering — implement them once in reusable harness
code and they hold for any model, any family, any project. Sections 2-4 (token budget, timeout,
tool-call cap, empty-answer characterization) are genuinely model-specific in their NUMBERS and
must be re-measured for every new model — but the METHOD for measuring each one (direct-replay-
with-usage-logging, natural-tool-call-distribution smoke test, replay-before-blaming-the-
harness) is family-agnostic and proven. That is what "the process is good enough to train any
model from any family" actually means in practice: not that the numbers transfer, but that the
measurement method does, so standing up evaluation against an unfamiliar model (Gemma, Laguna,
or anything released after this file was written) costs a measurement pass, not a rediscovery.
