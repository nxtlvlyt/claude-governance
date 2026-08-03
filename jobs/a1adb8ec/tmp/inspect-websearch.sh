#!/usr/bin/env bash
# What does BFCL's web_search category actually DO, and does it have a working backend here?
#
# WHY THIS MATTERS BEFORE WAITING 20 HOURS
# V34-SUNNAH-SPEC's "generalisation cliff" rests on web_search_base 14.00% / no_snippet 7.00%.
# If the category needs a live search API that is absent or unauthenticated on this box, those
# numbers measure a broken harness rather than the model, and BOTH the bare and with-system
# runs would be measuring the same breakage. The comparison would be worthless and the cliff
# would be an artifact of a third kind.
#
# The operator's standing position makes this sharper: search is supposed to be this model's
# advantage ("sota search, that's its secret weapon"). A search benchmark with no search is
# exactly the measurement that would hide that.
set -uo pipefail
BE=/root/bfclenv/lib/python3.12/site-packages/bfcl_eval

echo "=== what the two rows produced so far actually contain ==="
python3 - <<'PY'
import io, json
p = "/root/bfclproj/result/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json"
try:
    for line in io.open(p, encoding="utf-8"):
        line = line.strip()
        if not line: continue
        r = json.loads(line)
        print("  id:", r.get("id"))
        res = r.get("result")
        s = json.dumps(res)[:900] if not isinstance(res, str) else res[:900]
        print("  result:", s.replace("\\n", " ")[:700])
        print()
except Exception as e:
    print("  unreadable:", e)
PY

echo "=== does the web_search tool hit a real API? ==="
grep -rln "web_search\|websearch" "$BE" --include=*.py | head -12

echo
echo "=== search backend / api key references ==="
grep -rn "SERPAPI\|serpapi\|TAVILY\|tavily\|BRAVE\|brave\|GOOGLE_SEARCH\|SEARCH_API\|api_key" \
  "$BE"/constants/*.py "$BE"/utils.py 2>/dev/null | grep -i search | head -12

echo
echo "=== which env vars does bfcl expect for search? ==="
grep -rn "os.environ\|getenv" "$BE" --include=*.py 2>/dev/null \
  | grep -iE "search|serp|tavily|brave" | head -12

echo
echo "=== .env present? (keys REDACTED, presence only) ==="
for f in /root/bfclproj/.env "$BE/.env" /root/bfclenv/.env; do
  if [ -f "$f" ]; then
    echo "  $f exists; keys defined:"
    sed -E 's/=.*/=<redacted>/' "$f" | sed 's/^/    /'
  else
    echo "  $f absent"
  fi
done
