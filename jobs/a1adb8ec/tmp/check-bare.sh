#!/usr/bin/env bash
# Is the benchmarked tag serving WITHOUT the system prompt it was trained with?
#
# Every one of v3.3's 360 training rows carried a 4340-char system prompt (verified today:
# build-modelfile.py extracted exactly one distinct system prompt across all rows). The tag
# under benchmark is "arch-gov-27b-v33-bare". If bare means no SYSTEM block, then every BFCL
# number for this model measures the model in a configuration it never trained in - which is
# RUNBOOK trap 18, the precise defect build-modelfile-v33.py exists to close.
#
# That would not invalidate the measurement - the operator's stated v3.4 goal is a model that
# works as a fresh download with no wrapper, so bare is a legitimate condition to test. But it
# changes what the number MEANS: it would measure "works without its system prompt", not
# "multi-turn capability", and those must not be reported as the same thing.
set -uo pipefail
OLLAMA=http://172.30.144.1:11434

for M in arch-gov-27b-v33-bare arch-gov-27b-v33 qwen3.6:27b; do
  echo "==================== $M ===================="
  curl -s "$OLLAMA/api/show" -d "{\"model\":\"$M\"}" | python3 -c '
import sys, json
d = json.load(sys.stdin)
if "error" in d:
    print("  ERROR:", str(d["error"])[:120]); raise SystemExit
sysp = d.get("system") or ""
print("  system block : %d chars" % len(sysp))
if sysp:
    print("    head: %s" % sysp[:150].replace("\n"," "))
mf = d.get("modelfile") or ""
has_sys_line = any(l.strip().startswith("SYSTEM") for l in mf.splitlines())
print("  modelfile has SYSTEM line : %s" % has_sys_line)
print("  parameters   : %s" % (d.get("parameters") or "(none)").replace("\n", " | ")[:170])
'
done

echo
echo "=== DEFERRED: live probe of the bare tag ==="
echo "A live /api/chat against arch-gov-27b-v33-bare would LOAD a 17GB model and evict"
echo "qwen3.6:27b, which is currently serving the control benchmark. Operator concurrency"
echo "ruling 2026-07-02: chain big models run SERIAL among themselves, never two at once."
echo "Run it once the control generation is done. The /api/show evidence above is metadata"
echo "only and loads nothing."

echo
echo "=== instead, read the EMPTY responses already on disk (free, and more direct) ==="
python3 - <<'PY'
import io, json
path = "/root/bfclproj/result/arch-gov-27b/multi_turn/BFCL_v4_multi_turn_base_result.json"
empty = nonempty = 0
samples = []
for line in io.open(path, encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    r = json.loads(line)
    res = r.get("result")
    if not isinstance(res, list):
        continue
    for ti, turn in enumerate(res):
        steps = turn if isinstance(turn, list) else [turn]
        for s in steps:
            if not isinstance(s, str):
                continue
            if s.strip():
                nonempty += 1
                if len(samples) < 6 and len(s.strip()) > 5:
                    samples.append((r.get("id"), ti, s.strip()[:150]))
            else:
                empty += 1
tot = empty + nonempty
print("  tuned model turn-responses: %d total" % tot)
print("    EMPTY string : %d  (%.1f%%)" % (empty, 100.0*empty/max(tot,1)))
print("    non-empty    : %d  (%.1f%%)" % (nonempty, 100.0*nonempty/max(tot,1)))
print()
print("  what the non-empty ones look like:")
for i, t, s in samples:
    print("    [%s turn %d] %r" % (i, t, s))
PY
