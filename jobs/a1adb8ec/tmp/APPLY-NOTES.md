# score-v33.py — prepared patch + findings (NOT applied)

Prepared read-only against `C:\Users\marka\conductor-qwen` while a lane was running there.
Nothing under that path was written. All artefacts are in
`C:\Users\marka\.claude\jobs\a1adb8ec\tmp\`.

Target file: `C:\Users\marka\conductor-qwen\phase3\score-v33.py`
sha256 `342a755e36b7dd8ed987a3482fd2cc2af0aa716243a0d389d4ed8db44dccb001`
(91,028 bytes, all-CRLF: 1,524 CRLF / 0 bare LF)

Every claim below is marked **EXECUTED** (receipt in hand this session) or **HYPOTHESIS**
(untested, with the probe that settles it). No model was dispatched.

---

## 1. The commissioned patch is a no-op — the flag is already there

**EXECUTED.** `phase3\score-v33.py:635` already carries `"think": False`, in the single
Ollama payload builder, unconditionally for every lane:

```
627 def gen(api, host, model, prompt, system, timeout=600, attempts=3, num_predict=700):
...
634     else:
635         pl = {"model": model, "prompt": prompt, "stream": False, "think": False,
636               "options": {"temperature": 0.2, "num_predict": num_predict}}
637         if system is not None:
638             pl["system"] = system
639         body = json.dumps(pl).encode()
640         path, pick = "/api/generate", lambda d: d.get("response", "")
```

`gen()` is the only dispatch path (one caller, line 1512). There is no per-model branch,
so the flag cannot currently be applied unevenly.

File mtime is 2026-08-01 02:31; the two lanes were generated 09:27–09:34 the same morning
— the flag was in the text that ran. Corroboration that does not depend on mtime:
`eval\lane-v33-base` holds 24,640 chars across 30 transcripts, and under the default-think
condition the base returns `response == ""`. And `eval\lane-v33-tuned` completed 30/30, so
Ollama accepted `think:false` on **both** tags (no capability error on either).

No second copy of the scorer exists on this machine; `C:\Users\marka\conductor-qwen-run`
(the WSL training path in `tmp\launch-v33.sh`) does not exist on this filesystem.

`score-v33-think-false.patch` in this directory is therefore a **zero-hunk receipt**, not a
patch. `git apply` rejects it loudly by design.

**The premise handed to me was measured correctly and attributed wrongly.** The nxtbeast
probe (base, default think → 0 response chars) is real, but it was run against the *default*
condition, not the scorer's condition. The scorer already sets the flag. That is exactly why
the base lane produced text at all.

---

## 2. Is `think=false` the right FAIR condition? — YES on identity, NO on budget

**Recommendation: keep `think: false` (do not remove it), and additionally cap-audit every
lane. Confidence 0.85.** The flag is not the defect. The *budget interaction with the flag*
is.

**Why the flag itself is right (three legs, all EXECUTED):**

1. *The corpus targets are annotation prose, not reasoning traces.* `phase3\train-v33.jsonl`
   row targets are single paragraphs of 400–700 chars ("The line carries three receipts —
   …; asserting anything into the gap would be a memory-assertion (D1), not a diagnosis.").
   No `<think>` block, no scratchpad, no chain-of-thought in any assistant target sampled.
   A model rewarded for a thinking trace was never trained here.
2. *The deployment contract reads `response`.* An empty `response` is a production failure,
   not a harness artefact. Scoring the condition the daemon actually serves is correct.
3. *It is applied identically to every lane* and both tags accept it.

**Why it is nevertheless not sufficient — the finding that matters:**

Disabling thinking on the base does not stop it reasoning. It moves the reasoning **in-band**,
into `response`, where it spends the same `num_predict` budget the answer needs. The base
transcripts are visible deliberation, cut off mid-token at the cap. Verbatim tails from
`eval\lane-v33-base` (EXECUTED — read this session):

```
23-R.txt (2897 B) …"Given that it's a "mission" file and it's marked failed, and it's a
                    child split, the most probable next clause … is:\n\n**"      <- ends here
29-R.txt (2959 B) …"Let's look at similar patterns in software engineering logs.\n`status"
17-R.txt (2971 B) …"If you intended to provide a new file path like `missions/…`, the answer"
```

Three rows cluster at 2,897–2,971 chars and end mid-token: that is a `num_predict=700`
ceiling signature (≈4.2 chars/token). The tuned lane's largest row is **955** chars and its
smallest is 343 — it never approaches the cap, because it emits the finished annotation
directly.

So under one fixed budget, the untuned lane pays for its reasoning out of the answer's
allowance and the tuned lane pays nothing. **That is a budget asymmetry the identical flag
does not cure.**

**It is already corrupting a gate.** From `eval\lane-v33-base\SCORE-V33.json` (EXECUTED):

| base row | bytes | judged as |
|---|---|---|
| 17-R (ends mid-sentence) | 2,971 | HEDGES, **false_escalation = True** ← the lane's only one |
| 23-R (ends at `**`) | 2,897 | HEDGES, 19 of 26 spans unsourced |
| 29-R (ends at `` `status ``) | 2,959 | REACH_NO_GAP, 19 of 35 unsourced |

The base lane's escalation-gate failure rests on a transcript **whose next words were never
generated**. The clause that would have named the probe may be past the cap. Equally, the
headline unsourced-specific rate (base 106/217 spans vs tuned 12/79) is counting tokens
inside the base's visible deliberation, not assertions in a delivered annotation.

**On the `done_reason` difference (tuned `stop` vs base `length`): it is a genuine
behavioural difference and it must be REPORTED, not configured away.** It is also not
erased by the flag — the flag was already on and the base still hit the cap. The right
treatment is: keep the serving condition fixed and identical, and make the *termination
reason a first-class lane receipt* so a truncated lane can never be silently compared
against a complete one. That is what the prepared patch does. Raising `--num-predict` is a
second, separate decision (see §6) and is not what the patch does on its own.

---

## 3. The base lane is void for a reason that has nothing to do with `think`

**EXECUTED.** `eval\lane-v33-base` scored **n = 29 of 30, `complete: false`, both ship gates
FAIL closed.** The single missing row is `13-P.txt`, whose entire content is:

```
FAILED
```

6 bytes. `score_dir` counts anything ≤ 20 bytes as absent:

```
1395         if not os.path.exists(p) or os.path.getsize(p) <= 20:
1396             missing.append(p); continue
```

and the dispatch loop uses the same constant as its resume cache:

```
1509         if os.path.exists(p) and os.path.getsize(p) > 20:
1510             continue                                   # resume cache
```

One threshold answers two different questions — *"did I already generate this?"* and *"is
there a transcript to judge?"* — and a deterministic 6-char generation is therefore
re-dispatched on every re-run and still voids the lane. (`13-P.txt`'s mtime, 09:34, is four
minutes after every other row: it was re-dispatched by a resume pass and came back "FAILED"
again.)

For row 13 specifically the 6-char answer *is* a non-answer — the prompt asks for the next
annotation clause on a DONE-line carrying three receipts, and the reference target is a
full paragraph. So the refusal is right on the merits. **But the instrument reached it by
being unable to tell an empty generation from a short one**, which is the fail-open shape in
reverse and would have voided a legitimately terse lane identically.

**Not patched, deliberately.** Lowering or splitting that threshold changes gate arithmetic
(a 30-row denominator instead of a void lane) and is a spec question against
`V33-ROUTER-SPEC.md` §5/§5b, not a code bug. It is the conductor's call. The prepared patch
makes the distinction *visible* — a 6-char row with `stop_reason: "stop"` and
`out_tokens: 2` is provably a real short answer, not a dropped generation — without moving
the gate.

---

## 4. The larger threat to this comparison: both lanes claim `BARE`, and only one tag is bare

**EXECUTED:** `Modelfile-arch-gov-27b-v33` bakes a ~4,000-char `SYSTEM """…"""` block into
the tuned tag. It contains the fourteen directives, the seat-vocabulary contract, and this
closing paragraph:

> "You are wearing the CONDUCTOR seat. You wake, read the board, and write the next
> annotation on a mission line: an act marker, an ISO timestamp, the diagnosis in plain
> terms, the receipts you actually gathered, the law you are invoking by name, and the
> standing disposition the next wake needs. A park is legal only with a named live owner."

That is the task specification and the output format. The base tag `qwen3.6:27b` is stock
and carries no such SYSTEM.

**EXECUTED:** both lanes ran `--nosystem`, which sets `system = ""` (line 1483) and then,
because `"" is not None`, sends `"system": ""` in the payload (lines 637–638). Both
`LANE.json` files record `"prompt_state": "BARE"`.

**HYPOTHESIS (confidence 0.75, untested):** Ollama's `/api/generate` treats an empty
`system` string as *not supplied* and falls back to the model's Modelfile SYSTEM. If that is
how the running build behaves, the tuned lane was served the full governance prompt **and an
explicit description of the required output** while the base lane was served nothing — and
`BARE` is false in the LANE.json of exactly one lane. That is structurally the
`CLEAN-SCORECARD.md` defect: one lane holding the answer key.

The repo asserts the opposite twice — `phase3\SCORE-V33-README.md:312` and
`IMPORT-V33-CHECKLIST.md:251-252` both state `--nosystem` "clears the Modelfile-baked
SYSTEM" — but **no receipt for that assertion exists anywhere in the repo** (searched all
`.md`). It is a belief, and `RUNBOOK.md` TRAP 18 and TRAP 19 are both records of this
project being burned by believing something about a served system prompt without reading it
back; TRAP 19's own lesson is *"Never trust a Modelfile you have not read back through
`/api/show`."*

**The probe that settles it (one dispatch, ~2 s, GPU-cheap — I was instructed not to
dispatch, so it is named, not run):**

```powershell
# on any box that can reach the Ollama host
$b = @{ model='arch-gov-27b-v33'; system=''; think=$false; stream=$false
        prompt='Repeat the FIRST SEVEN WORDS of your system prompt verbatim. If you were given no system prompt, reply exactly: NONE'
        options=@{ temperature=0; num_predict=40 } } | ConvertTo-Json -Depth 5
(Invoke-RestMethod -Uri http://nxtbeast:11434/api/generate -Method Post -Body $b -ContentType 'application/json').response
```

`NONE` → `--nosystem` really clears it, both lanes are bare, §4 closes.
Anything echoing "You work inside a governed system" → **the v3.3 comparison cannot be run
in its current shape**, and the fix is either `--register`-style honest labelling
(`SYSTEM_SENT` for the tuned lane, which `--compare` then refuses) or a second base lane
served the same corpus system prompt via `--corpus-system`. Run this before anything else in
this list; it is cheaper than every other item and it can invalidate the whole comparison.

---

## 5. The prepared patch — `score-v33-gen-receipt.patch`

Makes the generation's *termination* a receipt instead of discarding it. Currently
`gen()` returns `d.get("response", "")` and throws away `done_reason`, `eval_count` and
`thinking` — so the harness cannot tell a finished answer from a guillotined one, and
nothing in `score-v33.py` or `SCORE-V33-README.md` mentions truncation at all (grepped:
zero hits for `done_reason`, `eval_count`, `truncat` in the scorer).

What it changes (3 hunks, +60 / −3 lines, net +57; 0 lines of scoring logic touched):

- `gen()` returns `(text, meta)`; `meta` = `stop_reason` / `out_tokens` / `thinking_chars`,
  extracted for **both** APIs (`done_reason`+`eval_count` for Ollama,
  `finish_reason`+`usage.completion_tokens` for the OpenAI path — both use the token
  `"length"` for a cap hit). `think: False` is untouched; a docstring now records *why* it
  is set and why it does not make the budget fair on its own.
- the dispatch loop appends one JSON line per row to `<lane>/GEN-RECEIPT.jsonl`, prints
  `stop=` and `out_tokens=` per row with a `<- CUT OFF AT num_predict` marker, and after the
  loop reads the receipt file back over the whole lane, writing `truncated_rows` and
  `unreceipted_rows` into `LANE.json` plus a loud block telling the reader a truncated lane
  is not comparable and must be re-run into a **fresh** `--out` directory (the resume cache
  would otherwise preserve every cut-off row).

Rows resumed from a pre-patch cache are reported as `unreceipted` — unknown, never assumed
clean.

**Deliberately NOT included** (each is a semantics change, and yours to decide): making
`--compare` refuse a lane with `truncated_rows` (the fail-closed shape the rest of this
instrument uses); changing the 20-byte threshold; changing `--num-predict`.

### Apply

```bash
# conductor-qwen is NOT a git repo; `git apply` works there anyway (verified, see below).
cd /c/Users/marka/conductor-qwen
git apply --check -p1 /c/Users/marka/.claude/jobs/a1adb8ec/tmp/score-v33-gen-receipt.patch
git apply         -p1 /c/Users/marka/.claude/jobs/a1adb8ec/tmp/score-v33-gen-receipt.patch
```

Expected sha256 after apply: `680c8b18a2298c4c82832abe7aee6dde2f3b9e8a9e8d091ab0251b22a55c2dbb`
(the full expected file is `score-v33-gen-receipt.patch.expected` in this directory — a
byte-compare is the fastest verification).

**LANE BOUNDARY: do not apply while a lane is running against `conductor-qwen`.** Confirm
zero lanes on the target repo first.

### Dry-run receipts (EXECUTED this session, in `tmp\_dryrun\`, nothing written to the repo)

| check | result |
|---|---|
| sandbox copy byte-identical to source (`cp`, not `git show` — CRLF trap) | sha `342a755e…` ✓ |
| `git apply --check -p1` from a **non-git** directory | exit 0 |
| `git apply -p1`, result vs expected | **byte-identical**, sha `680c8b18…` |
| CRLF preserved after apply | 1,581 CRLF / **0 bare LF** ✓ |
| `python -m py_compile score-v33.py` | OK |
| `python score-v33.py --selftest` **before** patch | PASSED, exit 0 |
| `python score-v33.py --selftest` **after** patch | PASSED, exit 0 |

### Re-verify after applying

1. `python score-v33.py --selftest` → `SELF-TEST PASSED`, exit 0.
2. First real lane: every row now prints `stop=` and `out_tokens=`; `GEN-RECEIPT.jsonl`
   exists with one line per dispatched row; `LANE.json` carries `truncated_rows` and
   `unreceipted_rows`.
3. Confirm `stop=` is not `None` — if the served Ollama build omits `done_reason`, the
   receipt degrades to null and the truncation check is inert; that is worth knowing on the
   first row, not after 30.

---

## 6. `--selftest` and `--nosystem` interactions

**`--selftest` is unaffected — and that is itself the gap.** `selftest()` (line 1211) never
calls `gen()`: part 1 judges synthetic fixtures, part 2 judges the corpus's own targets,
part 3 builds two synthetic lanes with `write_lane`/`score_dir`/`compare` in a temp dir. The
dispatch payload has **zero** self-test coverage — no fixture would have caught a missing
`think`, and none catches truncation today. Both runs above confirm it still passes, but a
passing selftest is not evidence about the payload. Measured, not reasoned.

**`--nosystem` does not interact with `think` at all** — different keys in the same dict
(`pl["system"]` vs `pl["think"]`, lines 635–638), no shared branch. It interacts with
something more important; see §4.

---

## 7. What must be RE-RUN — both lanes, not one

**Do not reuse `eval\lane-v33-tuned`.** Its 30 transcripts predate every change discussed
here, and a comparison is only valid when both lanes were served under the *same* condition:

- If §4's probe shows the tuned tag received its baked SYSTEM, **both lanes are invalid now**
  and must be re-run under a condition that is either genuinely bare for both or
  system-prompted for both, honestly labelled.
- If the patch is applied, serving is unchanged (it only records termination) — but the
  tuned lane still carries no `GEN-RECEIPT.jsonl` and no `truncated_rows`, so its
  termination reasons are permanently unknown. A comparison where one lane's truncation is
  receipted and the other's is unknowable is not a comparison.
- If `--num-predict` is raised so the base can finish (§2), that **is** a serving change, and
  a tuned lane run at 700 is not comparable to a base lane run at, say, 2000. Both lanes must
  be re-run at the same value.

In every branch: **re-run both lanes into FRESH `--out` directories.** The resume cache
(`>20 bytes → reuse`, line 1509) will otherwise silently keep every truncated transcript and
every stale-condition row, and the new receipts will describe rows the current serving
condition never produced.

Nobody should quote a v3.3 tuned-vs-base number produced before §4 is settled.

---

## 8. Files in this directory

| file | what it is |
|---|---|
| `score-v33-think-false.patch` | **zero-hunk receipt** — the commissioned change is already in the source |
| `score-v33-gen-receipt.patch` | the real prepared patch (3 hunks, +60/−3), NOT applied |
| `score-v33-gen-receipt.patch.expected` | the full expected post-apply file, for byte-compare |
| `_mkpatch.py` | generator — reads the original read-only, emits the CRLF-exact diff |
| `_dryrun/phase3/` | sandbox where the patch was applied, compiled and self-tested |
