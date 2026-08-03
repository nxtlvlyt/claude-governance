#!/usr/bin/env bash
# Does a CLOUD-served teacher request compete with the LOCAL benchmark on the same Ollama?
#
# The assumption worth testing rather than believing: cloud-tagged models are proxied, so
# they should not touch the 4090 - but they still enter the same Ollama server's request
# path, which may serialise them behind local inference. If they do serialise, dispatching
# teachers now would both slow the benchmark and corrupt its latency profile (exactly the
# failure that produced 366 timed-out rows earlier in this project).
#
# Measures: (a) what is loaded and busy, (b) round-trip for a trivial cloud completion,
# (c) whether the local benchmark's row rate changes across the probe.
set -uo pipefail
OLLAMA=http://172.30.144.1:11434
RES=/root/bfclproj/result/qwen3.6-27b-base/multi_turn/BFCL_v4_multi_turn_base_result.json

rows() { [ -f "$RES" ] && wc -l < "$RES" || echo 0; }

echo "=== /api/ps (what is resident and running) ==="
curl -s "$OLLAMA/api/ps" | python3 -c '
import sys, json
d = json.load(sys.stdin)
ms = d.get("models") or []
if not ms:
    print("  (nothing resident)")
for m in ms:
    print("  %-40s size=%.1fGB  vram=%.1fGB  until=%s"
          % (m.get("name"), (m.get("size") or 0)/1e9,
             (m.get("size_vram") or 0)/1e9, m.get("expires_at","?")))
'

R0=$(rows); echo; echo "benchmark rows before probe: $R0"

echo
echo "=== cloud teacher round-trip (kimi-k2.6:cloud, 1 short completion) ==="
START=$(date +%s.%N)
BODY=$(curl -s -m 180 "$OLLAMA/api/chat" -d '{
  "model":"kimi-k2.6:cloud",
  "messages":[{"role":"user","content":"Reply with exactly the word: READY"}],
  "stream":false,
  "options":{"num_predict":8}
}')
END=$(date +%s.%N)
echo "  elapsed: $(echo "$END - $START" | bc)s"
echo "$BODY" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print("  NON-JSON RESPONSE:", sys.stdin.read()[:200]); raise SystemExit
if "error" in d:
    print("  ERROR:", str(d["error"])[:300])
else:
    print("  content:", repr((d.get("message") or {}).get("content","")[:80]))
    print("  load_ms=%s  eval_ms=%s" % (d.get("load_duration",0)//10**6,
                                        d.get("eval_duration",0)//10**6))
'

echo
echo "=== glm-5.2:cloud round-trip ==="
START=$(date +%s.%N)
BODY=$(curl -s -m 180 "$OLLAMA/api/chat" -d '{
  "model":"glm-5.2:cloud",
  "messages":[{"role":"user","content":"Reply with exactly the word: READY"}],
  "stream":false,
  "options":{"num_predict":8}
}')
END=$(date +%s.%N)
echo "  elapsed: $(echo "$END - $START" | bc)s"
echo "$BODY" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print("  NON-JSON RESPONSE:", sys.stdin.read()[:200]); raise SystemExit
if "error" in d:
    print("  ERROR:", str(d["error"])[:300])
else:
    print("  content:", repr((d.get("message") or {}).get("content","")[:80]))
'

R1=$(rows)
echo
echo "benchmark rows after probe : $R1  (delta $((R1 - R0)))"
echo "VERDICT: if both cloud calls returned in seconds AND the benchmark kept advancing,"
echo "         teacher dispatch is safe to run alongside. If a cloud call blocked for"
echo "         minutes, teachers must wait for the benchmark to finish."
