#!/usr/bin/env bash
# Where did search die? Separate the rows measured with a live backend from the void rows.
#
# Brave returned HTTP 402 "Usage limit exceeded", current_spend 5.0 of usage_limit 5.0
# monthly. All four SearXNG engines (brave, braveapi, duckduckgo, startpage) then went
# unresponsive and searches returned 0 results.
#
# The n=31 scoring (58.06%, 22/31 reaching an answer) was taken while search was live, so
# those rows are valid. Rows generated after the quota ran out measured a void and must not
# be scored - that is precisely how web_search_base 14.00% was manufactured.
#
# A row that reached an answer had working search. A row with search calls and no answer,
# late in the file, is the signature of the void.
set -uo pipefail
F=/root/bfclproj/result/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json

echo "=== total rows banked: $(wc -l < "$F") ==="
echo
python3 - "$F" <<'PY'
import io, json, re, sys
p = sys.argv[1]
rows = []
for line in io.open(p, encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    r = json.loads(line)
    s = json.dumps(r.get("result"))
    rows.append({
        "id": r.get("id"),
        "queries": len(re.findall(r"search_engine_query", s)),
        "answered": ("'answer'" in s or '"answer"' in s),
    })

print("  %-4s %-26s %8s %9s" % ("#", "id", "queries", "answered"))
for i, r in enumerate(rows, 1):
    mark = ""
    if i > 31:
        mark = "   <- generated after the n=31 scoring"
    print("  %-4d %-26s %8d %9s%s" % (i, r["id"], r["queries"], "YES" if r["answered"] else "no", mark))

first31 = rows[:31]
rest = rows[31:]
def rate(g):
    return (sum(1 for x in g if x["answered"]), len(g))
a, n = rate(first31)
b, m = rate(rest)
print()
print("  rows 1-31   (search live)     : %d/%d answered  (%.0f%%)" % (a, n, 100.0*a/max(n,1)))
if m:
    print("  rows 32-%-3d (suspect)         : %d/%d answered  (%.0f%%)" % (len(rows), b, m, 100.0*b/max(m,1)))
    if b == 0:
        print("  -> ZERO answered after row 31. Consistent with the backend being dead for all of them.")
    elif 100.0*b/m < 100.0*a/n * 0.5:
        print("  -> answer rate collapsed after row 31. Treat those rows as void.")
    else:
        print("  -> answer rate held. The boundary is not where assumed - inspect before discarding.")
else:
    print("  no rows beyond 31 - nothing was banked after the valid scoring.")
PY

echo
echo "=== the search-call log, if the guard was installed in time ==="
[ -f /root/bfclproj/search-calls.jsonl ] && wc -l /root/bfclproj/search-calls.jsonl && tail -3 /root/bfclproj/search-calls.jsonl || echo "  guard installed after this run started - no per-call record for it"
