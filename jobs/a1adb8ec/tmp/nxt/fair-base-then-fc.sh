#!/usr/bin/env bash
# 1) Fair base holdout pass (think:false — the 0/66 was think-starvation, probe-confirmed),
# 2) then resume the base-FC bfcl lane (2h of rows banked, bfcl tops up by ID).
set -uo pipefail
LOG=/root/bfclproj/fairbase.log
exec > >(tee -a "$LOG") 2>&1
echo "######## FAIR BASE + FC RESUME $(date -Is) ########"

python3 - <<'PY'
import io, json, time, urllib.request
OLLAMA = "http://172.30.144.1:11434"
rows = [json.loads(l) for l in io.open("/mnt/c/Users/marka/cq-v34/phase4/holdout-v34-valid.jsonl", encoding="utf-8") if l.strip()]
def prompt_of(r):
    return [{"role": m["role"], "content": m["content"]} for m in r["messages"] if m["role"] in ("system", "user")]
import re
TOOL_RX = re.compile(r"<tool_call>|<function=|\[\s*\w+\s*\(", re.I)
FAB = ("the root cause was", "failed because", "the failure was caused by")
ans = shape = tool = fabfree = fabn = 0
t0 = time.time()
for i, r in enumerate(rows):
    body = {"model": "qwen3.6:27b", "messages": prompt_of(r), "stream": False,
            "think": False, "options": {"num_predict": 600, "temperature": 0.3}}
    req = urllib.request.Request(OLLAMA + "/api/chat", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        d = json.loads(urllib.request.urlopen(req, timeout=240).read().decode("utf-8", "replace"))
        c = ((d.get("message") or {}).get("content") or "").strip()
    except Exception:
        c = ""
    if c: ans += 1
    if 40 <= len(c) <= 4000: shape += 1
    is_tool = any(m.get("role") == "tool" for m in r["messages"])
    if is_tool and TOOL_RX.search(c): tool += 1
    if is_tool and not (next(m for m in r["messages"] if m["role"] == "tool").get("content") or "").strip():
        if c:
            fabn += 1
            if not any(f in c.lower() for f in FAB): fabfree += 1
    if (i + 1) % 20 == 0:
        print("  %d/66  %.1f/min" % (i + 1, 60 * (i + 1) / (time.time() - t0)), flush=True)
print()
print("FAIR BASE (think off): answered %d/66  shape_ok %d/66  tool_calls %d/32  no_fab %d/%d"
      % (ans, shape, tool, fabfree, fabn))
PY

echo
echo "=== resume base-FC bfcl lane (tops up banked rows) ==="
n=$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)
if [ "${n:-0}" -gt 0 ]; then echo "  lane busy, skipping"; else bash /mnt/c/Users/marka/run-base-fc.sh || echo "  rc=$?"; fi
echo "######## FAIR BASE + FC DONE $(date -Is) ########"
