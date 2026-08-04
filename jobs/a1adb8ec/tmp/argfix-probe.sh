#!/usr/bin/env bash
# Why are the tool-call arguments dropped, and what shape does the template actually want?
#
# The rendered call is argument-less:
#     <tool_call>
#     <function=read_result_json>
#     </function>
#     </tool_call>
# while the row carries {"mission": "auth-pattern-sota-check"}.
#
# The previous probe reported "arguments present in the rendered text" — a FALSE PASS. It
# searched the WHOLE rendered string, and the value also appears in the user turn
# ("DONE missions/auth-pattern-sota-check.mission.txt"), so a substring match succeeded while
# the tool call itself was empty. This version searches ONLY inside the <tool_call> block.
#
# Hypothesis: the builder emits arguments as a JSON STRING
#     {"function": {"name": "...", "arguments": "{\"mission\": \"x\"}"}}
# and the Qwen template expects a DICT. Tested below against both shapes.
#
# If 238 rows train argument-less calls, the model learns to invoke tools with no parameters —
# a WRONG reflex baked into weights, worse than having no tool rows at all.
set -uo pipefail
PY=/root/cq-venv/bin/python3
export HF_HOME=/root/.cache/huggingface

"$PY" - <<'PYEOF'
import json, re
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("unsloth/Qwen3.6-27B", local_files_only=True)

SYS = "You work inside a governed system."
USER = "DONE missions/example-mission.mission.txt\n\nDid every step commit?"
RESULT = '{"ok": false, "stoppedAt": 3}'
FINAL = "No — the return shows ok false at step 3."

def build(args_shape):
    return [
        {"role": "system", "content": SYS},
        {"role": "user", "content": USER},
        {"role": "assistant", "content": "",
         "tool_calls": [{"type": "function",
                         "function": {"name": "read_result_json", "arguments": args_shape}}]},
        {"role": "tool", "name": "read_result_json", "content": RESULT},
        {"role": "assistant", "content": FINAL},
    ]

def toolblock(txt):
    m = re.search(r"<tool_call>(.*?)</tool_call>", txt, re.S)
    return m.group(1).strip() if m else "(no <tool_call> block)"

CASES = [
    ("arguments as JSON STRING (what the builder emits)", '{"mission": "example-mission"}'),
    ("arguments as DICT",                                  {"mission": "example-mission"}),
]
for label, shape in CASES:
    print("=" * 74)
    print(label)
    try:
        txt = tok.apply_chat_template(build(shape), tokenize=False, add_generation_prompt=False)
        blk = toolblock(txt)
        print("  tool_call block:")
        for line in blk.splitlines():
            print("    " + line)
        has = "example-mission" in blk
        print("  ARGUMENT INSIDE THE CALL: %s" % ("YES" if has else "NO — dropped"))
    except Exception as e:
        print("  RENDER FAILED: %s: %s" % (type(e).__name__, str(e)[:110]))
PYEOF
