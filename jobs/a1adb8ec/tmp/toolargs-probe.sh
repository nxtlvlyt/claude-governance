#!/usr/bin/env bash
# Do the tool-call ARGUMENTS survive the chat template, or does the model learn to call
# functions with no parameters?
#
# The template renders:
#     <tool_call>
#     <function=read_result_json>
#     </function>
# with no visible arguments in the first 700 chars. The builder passed
# {"mission": "<name>"}. Two possibilities:
#   a) the args render further down (truncation artifact of the preview) — fine
#   b) the args are genuinely dropped — then 238 rows teach argument-less tool calls, which is
#      worse than having no tool rows at all, because it trains a WRONG reflex rather than an
#      absent one.
#
# Training on (b) would be a defect baked into weights and invisible until evaluation.
set -uo pipefail
PY=/root/cq-venv/bin/python3
export HF_HOME=/root/.cache/huggingface

"$PY" - <<'PYEOF'
import io, json
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("unsloth/Qwen3.6-27B", local_files_only=True)

rows = [json.loads(l) for l in io.open("/mnt/c/Users/marka/cq-v34/phase4/train-v34-train.jsonl",
                                       encoding="utf-8") if l.strip()]
tool_rows = [r for r in rows if any(m["role"] == "tool" for m in r["messages"])]
r = tool_rows[0]

print("=== WHAT THE ROW CONTAINS ===")
for m in r["messages"]:
    if m["role"] == "assistant" and m.get("tool_calls"):
        print("  assistant tool_calls:", json.dumps(m["tool_calls"]))
    elif m["role"] == "tool":
        print("  tool result (%d chars): %s" % (len(m["content"]), (m["content"] or "(empty)")[:80]))

txt = tok.apply_chat_template(r["messages"], tokenize=False, add_generation_prompt=False)
print("\n=== FULL RENDERED TEXT (%d chars) ===" % len(txt))
print(txt[:1800])

print("\n=== DID THE ARGUMENTS SURVIVE? ===")
args = None
for m in r["messages"]:
    if m.get("tool_calls"):
        args = json.loads(m["tool_calls"][0]["function"]["arguments"])
print("  args in the row:", args)
if args:
    for k, v in args.items():
        ink = k in txt
        inv = str(v) in txt
        print("    key %-10s in text: %-5s   value %-40s in text: %s" % (k, ink, str(v)[:40], inv))
    lost = [k for k, v in args.items() if str(v) not in txt]
    print("\n  VERDICT: %s" % ("ARGUMENTS LOST — rows would teach argument-less calls"
                               if lost else "arguments present in the rendered text"))
else:
    print("  the row carried NO arguments to begin with")

# How many rows carry args at all?
n_args = sum(1 for x in tool_rows
             for m in x["messages"]
             if m.get("tool_calls") and json.loads(m["tool_calls"][0]["function"]["arguments"]))
print("\n  tool rows with non-empty arguments: %d of %d" % (n_args, len(tool_rows)))
PYEOF
