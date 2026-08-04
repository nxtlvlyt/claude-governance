#!/usr/bin/env bash
# Why do half the searches return nothing when Brave is live?
#
# Guard telemetry: 7 of 14 calls empty, 6 of the last 12. Brave direct returns 19 results and
# SearXNG returned 20 when probed by hand. So this is not the quota outage again - it is
# something that fails INTERMITTENTLY, which is worse, because a 50% failure rate depresses a
# score without ever looking broken.
#
# Candidates, testable:
#   a) rate limiting - 4 bfcl threads x rapid queries vs the plan's queries/sec
#   b) SearXNG's braveapi engine timing out under concurrency
#   c) genuinely empty result sets for unusual query terms
set -uo pipefail
SEARX="${SEARXNG_URL:-http://100.95.116.67:8080}"

echo "=== which queries came back empty? ==="
python3 - <<'PY'
import io, json
rs = [json.loads(l) for l in io.open("/root/bfclproj/search-calls.jsonl", encoding="utf-8") if l.strip()]
print("  %-5s %-6s %s" % ("n", "empty?", "query"))
for r in rs:
    print("  %-5d %-6s %s" % (r["n"], "EMPTY" if r["n"] == 0 else "", r["q"][:88]))
PY

echo
echo "=== serial re-test: are the empty ones genuinely empty, or was it load? ==="
python3 - "$SEARX" <<'PY'
import io, json, sys, time, urllib.parse, urllib.request
base = sys.argv[1]
rs = [json.loads(l) for l in io.open("/root/bfclproj/search-calls.jsonl", encoding="utf-8") if l.strip()]
empties = [r["q"] for r in rs if r["n"] == 0][:6]
if not empties:
    print("  no empty queries recorded"); raise SystemExit
for q in empties:
    u = base.rstrip("/") + "/search?q=" + urllib.parse.quote(q) + "&format=json"
    try:
        d = json.loads(urllib.request.urlopen(u, timeout=30).read())
        n = len(d.get("results") or [])
        un = [e[0] if isinstance(e, list) else e for e in (d.get("unresponsive_engines") or [])]
        print("  %-3d results  unresponsive=%-34s  %s" % (n, str(un[:3]), q[:60]))
    except Exception as e:
        print("  REQUEST FAILED %s  %s" % (str(e)[:50], q[:60]))
    time.sleep(2)
PY

echo
echo "=== concurrency test: 4 simultaneous queries, like bfcl's 4 threads ==="
python3 - "$SEARX" <<'PY'
import json, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
base = sys.argv[1]
qs = ["2024 academy awards best picture", "super bowl LVIII halftime performer",
      "capital of australia", "who wrote dune novel"]
def go(q):
    u = base.rstrip("/") + "/search?q=" + urllib.parse.quote(q) + "&format=json"
    try:
        d = json.loads(urllib.request.urlopen(u, timeout=30).read())
        return q, len(d.get("results") or []), [e[0] if isinstance(e, list) else e for e in (d.get("unresponsive_engines") or [])][:3]
    except Exception as e:
        return q, -1, str(e)[:40]
with ThreadPoolExecutor(max_workers=4) as ex:
    for q, n, un in ex.map(go, qs):
        print("  %-4s results  %-34s  %s" % (n if n >= 0 else "ERR", str(un), q[:46]))
PY

echo
echo "=== brave direct, to separate SearXNG from the API ==="
curl -s -m 20 -o /dev/null -w "  brave HTTP %{http_code}\n" \
  -H "X-Subscription-Token: ${BRAVE_KEY:-BSATBA-WATPAvpVguxrZ55UwWXb7Faz}" -H "Accept: application/json" \
  "https://api.search.brave.com/res/v1/web/search?q=test" 2>/dev/null
