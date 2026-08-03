#!/usr/bin/env bash
# Confirm the teachers work once given a real token budget and read on the right key.
#
# Probe 1 read message.content            -> "" (wrong key, and starved)
# Probe 2 read message.content|reasoning  -> "" (still wrong key: it is `thinking`),
#                                            and done_reason=length with eval_count=16,
#                                            i.e. num_predict=16 was fully consumed by
#                                            thinking tokens before any content existed.
#
# So this probe: real num_predict, read `thinking`, and ALSO test a realistic classification
# prompt - because a model that can emit "READY" is not evidence it can emit valid JSON for
# the actual job. Test the instrument on the work it will do, not on a toy.
set -uo pipefail
OLLAMA=http://172.30.144.1:11434

read -r -d '' TASK <<'EOF'
You classify a governance training situation. Reply with ONLY a JSON object, no prose.

SITUATION:
  agent claim: "I checked the substrate and operator_pushback is the thinnest kind - only 96 specimens exist."
  operator said: "I still don't believe any of my substrate is thin though"
  agent then: measured the transcript corpus and found its own extractor had never opened it.

Fields:
  kind        one of: humility_slow_down, operator_pushback, measurement_discipline, tool_failure
  directive   one of: D1_substrate_is_truth, D2_attempt_before_asking, D5_mark_confidence, D9_admit_mistakes, D10_push_back
  condition   one sentence, in "when X, do Y" form, that would prevent a repeat
EOF

for M in kimi-k2.6:cloud glm-5.2:cloud; do
  echo "=================== $M ==================="
  START=$(date +%s)
  python3 - "$OLLAMA" "$M" "$TASK" <<'PY'
import json, sys, urllib.request

base, model, task = sys.argv[1], sys.argv[2], sys.argv[3]
body = json.dumps({
    "model": model,
    "messages": [{"role": "user", "content": task}],
    "stream": False,
    "options": {"num_predict": 1200, "temperature": 0.3},
}).encode()
req = urllib.request.Request(base + "/api/chat", data=body,
                             headers={"Content-Type": "application/json"})
try:
    d = json.loads(urllib.request.urlopen(req, timeout=600).read())
except Exception as e:
    print("  REQUEST FAILED:", type(e).__name__, str(e)[:200]); raise SystemExit

if "error" in d:
    print("  ERROR:", str(d["error"])[:300]); raise SystemExit

msg = d.get("message") or {}
content  = (msg.get("content") or "").strip()
thinking = (msg.get("thinking") or "").strip()
print("  done_reason :", d.get("done_reason"), " eval_count:", d.get("eval_count"))
print("  len(content)=%d  len(thinking)=%d" % (len(content), len(thinking)))

text = content or thinking
print("  --- text (first 500) ---")
print("  " + text[:500].replace("\n", "\n  "))

# The real test: does it parse as the JSON the corpus pipeline will need?
import re
m = re.search(r"\{.*\}", text, re.S)
if not m:
    print("  JSON: NONE FOUND -> unusable for generation as-is")
else:
    try:
        obj = json.loads(m.group(0))
        keys = sorted(obj.keys())
        print("  JSON: PARSED, keys =", keys)
        ok = all(k in obj for k in ("kind", "directive", "condition"))
        print("  SCHEMA:", "OK - all three fields present" if ok else "MISSING FIELDS")
    except Exception as e:
        print("  JSON: FOUND BUT INVALID ->", str(e)[:120])
PY
  echo "  elapsed: $(( $(date +%s) - START ))s"
done

echo
echo "=== benchmark still advancing? ==="
tail -1 /root/bfclproj/serial-multiturn.log | tr '\r' '\n' | tail -1
