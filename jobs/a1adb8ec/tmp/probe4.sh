#!/usr/bin/env bash
# Make kimi-k2.6:cloud usable. It is a REQUIRED teacher per operator ruling 2026-07-28
# ("only the best Kimi model must be used"), so dropping it is not an option - it gets fixed.
#
# Observed: num_predict=1200 -> eval_count=1200, len(thinking)=5935, len(content)=0,
# done_reason=length. It never stopped thinking, so no content was ever emitted.
#
# Three candidate fixes, tested in order of preference:
#   A. think:false        - Ollama's switch for hybrid reasoning models. Cheapest if honoured.
#   B. big num_predict    - let it finish thinking and still have room for content.
#   C. thinking fallback  - parse JSON out of the thinking stream (last resort: brittle).
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

probe () {
  local label="$1" extra="$2"
  echo "=================== kimi-k2.6:cloud :: $label ==================="
  local START=$(date +%s)
  python3 - "$OLLAMA" "$TASK" "$extra" <<'PY'
import json, re, sys, urllib.request
base, task, extra = sys.argv[1], sys.argv[2], sys.argv[3]
payload = {
    "model": "kimi-k2.6:cloud",
    "messages": [{"role": "user", "content": task}],
    "stream": False,
    "options": {"temperature": 0.3},
}
payload.update(json.loads(extra))
req = urllib.request.Request(base + "/api/chat", data=json.dumps(payload).encode(),
                             headers={"Content-Type": "application/json"})
try:
    d = json.loads(urllib.request.urlopen(req, timeout=900).read())
except Exception as e:
    print("  REQUEST FAILED:", type(e).__name__, str(e)[:200]); raise SystemExit
if "error" in d:
    print("  ERROR:", str(d["error"])[:300]); raise SystemExit
msg = d.get("message") or {}
content, thinking = (msg.get("content") or "").strip(), (msg.get("thinking") or "").strip()
print("  done_reason=%s eval_count=%s  len(content)=%d len(thinking)=%d"
      % (d.get("done_reason"), d.get("eval_count"), len(content), len(thinking)))
text = content or thinking
m = re.search(r"\{[^{}]*\"kind\"[^{}]*\}", text, re.S) or re.search(r"\{.*\}", text, re.S)
if not m:
    print("  JSON: none")
    print("  head:", text[:200].replace("\n", " "))
else:
    try:
        o = json.loads(m.group(0))
        ok = all(k in o for k in ("kind", "directive", "condition"))
        print("  JSON: PARSED", "SCHEMA OK" if ok else "MISSING FIELDS")
        print("  ->", json.dumps(o)[:260])
        print("  SOURCE:", "content" if content else "thinking (fallback)")
    except Exception as e:
        print("  JSON: invalid ->", str(e)[:120])
PY
  echo "  elapsed: $(( $(date +%s) - START ))s"
  echo
}

probe "A: think=false"            '{"think": false, "options": {"num_predict": 800, "temperature": 0.3}}'
probe "B: num_predict=8000"       '{"options": {"num_predict": 8000, "temperature": 0.3}}'

echo "=== benchmark still advancing? ==="
tail -1 /root/bfclproj/serial-multiturn.log | tr '\r' '\n' | tail -1
