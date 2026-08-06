#!/usr/bin/env python
"""
Holdout evaluation: v3.4 vs v3.3 on the 251 rows neither trained on.

WHY THIS RUNS FIRST, BEFORE ANY BFCL LANE
It is the most direct measurement of what the corpus rebuild bought: same situations, same
grader, blind split declared before training. It needs no search backend, no Brave quota, and
~20 minutes — against hours for each BFCL lane. The chain had it LAST, which was backwards.

WHAT IT MEASURES
For each held-out row, the model gets the same system prompt + user turn the training rows
carried, and its reply is compared to the reference target on mechanical axes:
  - answered at all (non-empty) — v3.3-bare's failure mode was 61.8% EMPTY turns
  - for tool-loop rows: does it emit a tool call when the reference did, and does the call
    carry ARGUMENTS (the defect caught 2026-08-04: string-shaped args rendered as
    argument-less calls)
  - for EMPTY-oracle rows: does it refuse to fabricate (no invented root cause)
  - length/shape sanity: not a one-word reply to a situation demanding substance
These are deliberately mechanical. A quality grading by a judge model can stack later; the
mechanical axes are the ones today's defects actually lived in.

PAIRED BY DESIGN (spec 4.6): every metric is reported for v3.4 AND v3.3 on identical rows.
"""

import argparse, io, json, re, sys, time, urllib.request
from collections import Counter, defaultdict

OLLAMA = "http://172.30.144.1:11434"
HOLDOUT = "/mnt/c/Users/marka/cq-v34/phase4/holdout-v34-valid.jsonl"
OUT = "/mnt/c/Users/marka/cq-v34/phase4/holdout-results-v35.jsonl"

MODELS = [
    ("arch-gov-27b-v35", "v3.5"),
    ("arch-gov-27b-v34", "v3.4"),
    ("qwen3.6:27b", "base"),   # audit: no comparison is interpretable without the untuned base
]

FABRICATION_TELLS = ("the root cause was", "failed because", "the failure was caused by",
                     "root cause of this failure is")


def call(model, messages, timeout=240):
    body = {"model": model, "messages": messages, "stream": False,
            "options": {"num_predict": 600, "temperature": 0.3}}
    if model == "qwen3.6:27b":
        body["think"] = False  # base's default thinking starves its answers (STATE.md receipt)
    req = urllib.request.Request(OLLAMA + "/api/chat", data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    d = json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "replace"))
    if "error" in d:
        return None
    m = d.get("message") or {}
    return {"content": (m.get("content") or "").strip(),
            "tool_calls": m.get("tool_calls") or []}


def judge(row, resp):
    """Mechanical axes only. Returns a dict of booleans."""
    meta = row.get("meta") or {}
    ref = row["messages"][-1]["content"]
    is_tool_row = any(m.get("role") == "tool" for m in row["messages"])
    oracle_empty = False
    if is_tool_row:
        tmsg = next(m for m in row["messages"] if m["role"] == "tool")
        oracle_empty = not (tmsg.get("content") or "").strip()

    r = {"answered": False, "tool_call_when_expected": None, "args_present": None,
         "no_fabrication_on_empty": None, "shape_ok": False}
    if resp is None:
        return r
    text = resp["content"]
    calls = resp["tool_calls"]
    r["answered"] = bool(text or calls)

    if is_tool_row:
        # The model sees only [system, user]; the reference behaviour is to CALL the tool.
        r["tool_call_when_expected"] = bool(calls)
        if calls:
            args = calls[0].get("function", {}).get("arguments")
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except Exception:
                    args = None
            r["args_present"] = bool(args)
        if oracle_empty and text:
            low = text.lower()
            r["no_fabrication_on_empty"] = not any(t in low for t in FABRICATION_TELLS)
    if text:
        r["shape_ok"] = 40 <= len(text) <= 4000
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    rows = [json.loads(l) for l in io.open(HOLDOUT, encoding="utf-8") if l.strip()]
    if a.limit:
        rows = rows[:a.limit]
    print("holdout rows: %d" % len(rows))

    # The model is shown system+user only — the turns before its reply. For tool rows that is
    # the decision point BEFORE the call.
    def prompt_of(row):
        msgs = []
        for m in row["messages"]:
            if m["role"] in ("system", "user"):
                msgs.append({"role": m["role"], "content": m["content"]})
            else:
                break
        return msgs

    fh = io.open(OUT, "w", encoding="utf-8")
    agg = {label: defaultdict(lambda: [0, 0]) for _, label in MODELS}
    t0 = time.time()

    # MODEL-MAJOR: all rows for one model before the next. The first version alternated
    # models per row, which would force Ollama to swap 17GB of weights on every row —
    # 198 model loads instead of 3.
    results = [{"idx": i, "row_type": (row.get("meta") or {}).get("row_type")}
               for i, row in enumerate(rows)]
    for model, label in MODELS:
        print("  === %s (%s) ===" % (label, model), flush=True)
        for i, row in enumerate(rows):
            try:
                resp = call(model, prompt_of(row))
            except Exception:
                resp = None
            j = judge(row, resp)
            results[i][label] = j
            for k, v in j.items():
                if v is None:
                    continue
                agg[label][k][1] += 1
                if v:
                    agg[label][k][0] += 1
            if (i + 1) % 20 == 0:
                el = time.time() - t0
                print("    %d/%d  %.1f calls/min" % (i + 1, len(rows), 60 * (i + 1) / max(el, 1)),
                      flush=True)
    for rec in results:
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    fh.close()

    print()
    print("  %-28s %12s %12s %12s" % ("axis", "v3.4", "v3.3", "base"))
    for k in ("answered", "shape_ok", "tool_call_when_expected", "args_present",
              "no_fabrication_on_empty"):
        line = "  %-28s" % k
        for _, label in MODELS:
            ok, n = agg[label][k]
            line += ("%8d/%-4d" % (ok, n)) if n else "%12s" % "-"
        print(line)
    print()
    print("  elapsed %.1f min -> %s" % ((time.time() - t0) / 60, OUT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
