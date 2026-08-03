#!/usr/bin/env bash
# Do the candidate base families actually SUPPORT a system prompt?
#
# WHY THIS MATTERS FOR LAGUNA / GEMMA 4:
# This pipeline's trap-18 fix bakes a SYSTEM block into the Modelfile, because every training
# row carries a system prompt and serving without one is a train/inference mismatch. That fix
# ASSUMES the base family has a system role. Gemma's chat template historically did not - a
# system message is folded into the first user turn or dropped. If that still holds for
# gemma4, "swap the profile" is NOT sufficient for a Gemma student, and discovering it after
# a training run is the expensive way to learn it.
#
# LANE DISCIPLINE (operator ruling 2026-07-02, nxtbeast concurrency):
#   "small models may run IN PARALLEL WITH the chain's big local models ... chain big models
#    run SERIAL among themselves (never two big at once)."
# qwen3.6:27b is resident RIGHT NOW serving the BFCL control run. Sending a chat to
# gemma4:31b would evict it mid-benchmark and corrupt a measurement already 1+ hour in.
# So:
#   /api/show  - metadata only, loads nothing  -> safe for every model, run now
#   /api/chat  - loads the model               -> SMALL models only while the big lane is busy
# The gemma4 live test is deferred, by design, not forgotten. It is listed at the end.
set -uo pipefail
OLLAMA=http://172.30.144.1:11434

BIG_LANE_BUSY=$(pgrep -c -f "bfcl generate" || echo 0)
echo "big lane busy: $BIG_LANE_BUSY bfcl process(es) -> live tests restricted to small models"
echo

show () {
  python3 - "$OLLAMA" "$1" <<'PY'
import json, sys, urllib.request
base, model = sys.argv[1], sys.argv[2]
req = urllib.request.Request(base + "/api/show",
                             data=json.dumps({"model": model}).encode(),
                             headers={"Content-Type": "application/json"})
try:
    d = json.loads(urllib.request.urlopen(req, timeout=120).read())
except Exception as e:
    print("  SHOW FAILED:", type(e).__name__, str(e)[:160]); raise SystemExit
tpl = d.get("template") or ""
det = d.get("details") or {}
print("  family=%s params=%s quant=%s" % (det.get("family"), det.get("parameter_size"), det.get("quantization_level")))
print("  template chars: %d" % len(tpl))
low = tpl.lower()
has = "system" in low
print("  template mentions 'system': %s" % ("YES" if has else "NO  <-- NO SYSTEM ROLE"))
for line in tpl.splitlines():
    if "system" in line.lower():
        print("    |", line.strip()[:160])
PY
}

live () {
  python3 - "$OLLAMA" "$1" <<'PY'
import json, sys, urllib.request
base, model = sys.argv[1], sys.argv[2]
# An instruction the model would never follow by chance, so compliance is unambiguous.
payload = {
    "model": model,
    "messages": [
        {"role": "system", "content": "You must answer every message with exactly the single word: PELICAN. Nothing else, ever."},
        {"role": "user", "content": "What is the capital of France?"},
    ],
    "stream": False, "think": False,
    "options": {"num_predict": 24, "temperature": 0},
}
req = urllib.request.Request(base + "/api/chat", data=json.dumps(payload).encode(),
                             headers={"Content-Type": "application/json"})
try:
    d = json.loads(urllib.request.urlopen(req, timeout=300).read())
except Exception as e:
    print("  CHAT FAILED:", type(e).__name__, str(e)[:160]); raise SystemExit
if "error" in d:
    print("  ERROR:", str(d["error"])[:200]); raise SystemExit
msg = d.get("message") or {}
out = ((msg.get("content") or "") or (msg.get("thinking") or "")).strip()
print("  reply:", repr(out[:90]))
print("  system HONOURED:", "YES" if "PELICAN" in out.upper() else "NO  <-- system prompt had no effect")
PY
}

for M in gemma4:31b gemma4:12b-it-q8_0 laguna-xs-2.1:q8_0 laguna-s-2.1:latest qwen3.6:27b; do
  echo "==================== $M ===================="
  show "$M"
done

echo
echo "==================== LIVE TESTS (small lane only) ===================="
for M in laguna-xs-2.1:q8_0; do
  echo "--- $M ---"
  live "$M"
done

echo
echo "DEFERRED (big lane): live system-prompt test for gemma4:31b and gemma4:12b."
echo "Run once 'pgrep -c -f \"bfcl generate\"' returns 0. The /api/show result above is"
echo "evidence about the TEMPLATE; only the live test proves what the SERVER actually does"
echo "with a system message, and those two have disagreed before."
