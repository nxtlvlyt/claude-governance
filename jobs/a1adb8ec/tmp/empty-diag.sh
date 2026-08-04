#!/usr/bin/env bash
# Why is the FC lane's search empty rate 14.2% when the prompt lane's was 2.8%?
#
# Three candidates, each testable:
#   a) Brave quota / rate limiting  -> would show as HTTP 402 or 429 on a direct call
#   b) genuinely empty result sets  -> the same query returns 0 on a calm serial retry
#   c) FC mode issuing worse queries -> the empty ones look malformed or over-specific
#
# (c) is the interesting one: FC mode has the model emit structured tool arguments rather than
# prose, and a model unpractised at that schema can emit query strings that are syntactically
# fine but semantically junk. That would be a REAL finding about the FC lane, not a harness
# fault — and it must not be mistaken for a broken backend.
set -uo pipefail
SEARX="${SEARXNG_URL:-http://100.95.116.67:8080}"

echo "=== brave direct: quota alive? ==="
curl -s -m 20 -H "X-Subscription-Token: ${BRAVE_KEY:-BSATBA-WATPAvpVguxrZ55UwWXb7Faz}" \
  -H "Accept: application/json" "https://api.search.brave.com/res/v1/web/search?q=test" 2>/dev/null \
| python3 -c '
import sys,json
raw=sys.stdin.read()
try: d=json.loads(raw)
except Exception: print("  non-json:",raw[:120]); raise SystemExit
if "error" in d:
    e=d["error"]; m=e.get("meta") or {}
    print("  %s %s  spend=%s / limit=%s" % (e.get("status"), e.get("detail"), m.get("current_spend"), m.get("usage_limit")))
else:
    print("  LIVE — %d results" % len((d.get("web") or {}).get("results") or []))
'

echo
echo "=== the empty queries, verbatim — do they look like real questions? ==="
python3 - <<'PY'
import io, json
rs = [json.loads(l) for l in io.open("/root/bfclproj/search-calls.jsonl", encoding="utf-8") if l.strip()]
empty = [r for r in rs if r["n"] == 0]
ok    = [r for r in rs if r["n"] > 0]
print("  empty=%d  ok=%d" % (len(empty), len(ok)))
print("\n  --- EMPTY (last 12) ---")
for r in empty[-12:]:
    print("    %r" % r["q"][:100])
print("\n  --- SUCCEEDED (last 6, for contrast) ---")
for r in ok[-6:]:
    print("    n=%-3d %r" % (r["n"], r["q"][:100]))
PY

echo
echo "=== serial retry of the empty queries: genuinely empty, or transient? ==="
python3 - "$SEARX" <<'PY'
import io, json, sys, time, urllib.parse, urllib.request
base = sys.argv[1]
rs = [json.loads(l) for l in io.open("/root/bfclproj/search-calls.jsonl", encoding="utf-8") if l.strip()]
qs = [r["q"] for r in rs if r["n"] == 0][-6:]
for q in qs:
    u = base.rstrip("/") + "/search?q=" + urllib.parse.quote(q) + "&format=json"
    try:
        d = json.loads(urllib.request.urlopen(u, timeout=30).read())
        n = len(d.get("results") or [])
        un = [e[0] if isinstance(e, list) else e for e in (d.get("unresponsive_engines") or [])][:3]
        verdict = "GENUINELY EMPTY" if n == 0 else "returns %d on retry -> was transient/load" % n
        print("  %-30s %s" % (verdict, q[:60]))
    except Exception as e:
        print("  RETRY FAILED %-16s %s" % (str(e)[:16], q[:60]))
    time.sleep(2)
PY
