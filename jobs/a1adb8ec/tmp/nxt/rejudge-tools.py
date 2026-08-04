#!/usr/bin/env python3
"""Re-judge the tool-loop rows with a content-parsing fallback, and probe the base artifact.

TWO SUSPECT NUMBERS FROM THE HOLDOUT TABLE (2026-08-04), both instrument-shaped:
  tool_call_when_expected 0/32 for ALL models — the judge read only the API `tool_calls`
    field, which Ollama populates only when a `tools` array is sent. Models trained on
    <tool_call> TEXT emit it in content. The audit predicted this miss verbatim ("parse
    content as fallback"); it was not implemented before the run. This re-judges from text.
  base answered 0/66 — the base tag carries `top_p 0` in its Modelfile (degenerate nucleus).
    One probe with top_p overridden distinguishes broken-tag from broken-model.
"""
import io, json, re, time, urllib.request
from collections import Counter

OLLAMA = "http://172.30.144.1:11434"
HOLDOUT = "/mnt/c/Users/marka/cq-v34/phase4/holdout-v34-valid.jsonl"
OUT = "/mnt/c/Users/marka/cq-v34/phase4/rejudge-tools-results.json"

MODELS = [("arch-gov-27b-v34", "v3.4"), ("arch-gov-27b-v33", "v3.3")]

TOOLCALL_RX = re.compile(r"<tool_call>|<function=|\[\s*\w+\s*\(", re.I)
PARAM_RX = re.compile(r"<parameter=\w+>|\w+\s*=\s*[\"'\w]", re.I)


def call(model, messages, opts=None):
    body = {"model": model, "messages": messages, "stream": False,
            "options": dict({"num_predict": 600, "temperature": 0.3}, **(opts or {}))}
    req = urllib.request.Request(OLLAMA + "/api/chat", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    d = json.loads(urllib.request.urlopen(req, timeout=240).read().decode("utf-8", "replace"))
    m = d.get("message") or {}
    return {"content": (m.get("content") or "").strip(), "tool_calls": m.get("tool_calls") or []}


def main():
    rows = [json.loads(l) for l in io.open(HOLDOUT, encoding="utf-8") if l.strip()]
    tool_rows = [r for r in rows if any(m.get("role") == "tool" for m in r["messages"])]
    print("tool-loop rows: %d" % len(tool_rows))

    def prompt_of(row):
        out = []
        for m in row["messages"]:
            if m["role"] in ("system", "user"):
                out.append({"role": m["role"], "content": m["content"]})
            else:
                break
        return out

    res = {}
    for model, label in MODELS:
        c = Counter()
        for i, row in enumerate(tool_rows):
            try:
                r = call(model, prompt_of(row))
            except Exception:
                c["error"] += 1
                continue
            api_call = bool(r["tool_calls"])
            text_call = bool(TOOLCALL_RX.search(r["content"]))
            has_args = bool(r["tool_calls"]) or (text_call and bool(PARAM_RX.search(r["content"])))
            if api_call or text_call:
                c["tool_call"] += 1
                if has_args:
                    c["with_args"] += 1
            elif r["content"]:
                c["prose_instead"] += 1
            else:
                c["empty"] += 1
        res[label] = dict(c)
        print("  %-5s %s" % (label, dict(c)), flush=True)

    print()
    print("=== base probe: is 0/66 the tag's top_p=0, or the model? ===")
    msgs = prompt_of(tool_rows[0])
    for label, opts in [("tag defaults", None), ("top_p corrected", {"top_p": 0.9})]:
        try:
            r = call("qwen3.6:27b", msgs, opts)
            print("  %-16s content=%4d chars  head: %s"
                  % (label, len(r["content"]), r["content"][:90].replace("\n", " ")))
        except Exception as e:
            print("  %-16s FAILED %s" % (label, str(e)[:80]))
    res["base_probe"] = "see log"
    io.open(OUT, "w", encoding="utf-8").write(json.dumps(res, indent=2))
    print("\n-> %s" % OUT)


if __name__ == "__main__":
    main()
