#!/usr/bin/env bash
# Brave search spend + empty-guard state for the running lane
set -uo pipefail
F=/root/bfclproj/search-calls.jsonl
echo -n "search calls total: "; wc -l < "$F"
echo -n "calls today       : "; grep -c '2026-08-04' "$F" || true
echo "--- last 5 call statuses ---"
tail -5 "$F" | python3 -c 'import sys,json
for l in sys.stdin:
    try:
        d=json.loads(l)
        print(" ", str(d.get("ts","?"))[:19], "empty=" + str(d.get("empty", d.get("n_results","?"))))
    except Exception:
        print("  unparsed:", l[:80])'
