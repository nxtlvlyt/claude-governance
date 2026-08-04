#!/usr/bin/env bash
# Can the tokenizer's chat template actually RENDER the Type B tool-call rows?
#
# WHY THIS IS THE NEXT REAL RISK
# 270 of the 1741 training rows are multi-turn tool loops:
#     system -> user -> assistant(tool_calls) -> tool -> assistant
# corpus_render.py was verified to PRESERVE tool_calls and tool results through the fold
# (0 lost across all 270). That proves the RENDERER is safe. It says nothing about whether
# tokenizer.apply_chat_template() — which train_student_generic.py:~230 calls on every row —
# can turn that shape into text at all.
#
# If the template lacks tool support, training raises partway through building the dataset:
# a failure at minute 20 of a 40-minute window, after the GPU is already committed.
#
# Tokenizer-only. No weights, no GPU, no interference with the running FC lane.
set -uo pipefail
PY=/root/cq-venv/bin/python3
export HF_HOME=/root/.cache/huggingface

"$PY" - <<'PYEOF'
import io, json, sys
sys.path.insert(0, "/mnt/c/Users/marka/cq-v34")

CORPUS = "/mnt/c/Users/marka/cq-v34/phase4/train-v34-train.jsonl"
rows = [json.loads(l) for l in io.open(CORPUS, encoding="utf-8") if l.strip()]
plain = [r for r in rows if not any(m["role"] == "tool" for m in r["messages"])]
tools = [r for r in rows if any(m["role"] == "tool" for m in r["messages"])]
print("  rows: %d total  %d plain  %d with tool turns" % (len(rows), len(plain), len(tools)))

from transformers import AutoTokenizer
CANDS = ["unsloth/Qwen3.6-27B", "unsloth/Qwen3.6-27B-bnb-4bit", "Qwen/Qwen3.6-27B"]
tok = None
for c in CANDS:
    try:
        tok = AutoTokenizer.from_pretrained(c, local_files_only=True)
        print("  tokenizer: %s" % c)
        break
    except Exception as e:
        print("  %-34s unavailable (%s)" % (c, type(e).__name__))
if tok is None:
    print("  NO TOKENIZER CACHED LOCALLY — cannot verify. Training will download one first.")
    raise SystemExit(3)

def render(msgs):
    return tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=False)

ok = bad = 0
errs = {}
sample_tool = None
for r in rows:
    try:
        t = render(r["messages"])
        if not t or len(t) < 20:
            raise ValueError("rendered %d chars" % len(t))
        ok += 1
        if sample_tool is None and any(m["role"] == "tool" for m in r["messages"]):
            sample_tool = t
    except Exception as e:
        bad += 1
        k = "%s: %s" % (type(e).__name__, str(e)[:90])
        errs[k] = errs.get(k, 0) + 1

print("\n  RENDER RESULT: %d ok, %d failed" % (ok, bad))
for k, v in sorted(errs.items(), key=lambda kv: -kv[1])[:5]:
    print("    %5d  %s" % (v, k))

if sample_tool:
    print("\n  --- a rendered TOOL-LOOP row (first 700 chars) ---")
    print("  " + sample_tool[:700].replace("\n", "\n  "))
    has_call = ("tool_call" in sample_tool) or ("tool" in sample_tool.lower())
    print("\n  tool turn survived into the text: %s" % has_call)
else:
    print("\n  NO tool row rendered — the 270 multi-turn rows would train as nothing.")
PYEOF
