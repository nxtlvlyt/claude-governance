#!/usr/bin/env bash
# Matched-ID comparison for web_search_base: OLD (bare tag, dead search) vs NEW (system prompt
# + live search). Scores both on exactly the ids the new run has completed.
#
# The old number on record is 14.00% over 100 entries. Comparing 18 new rows against that 100
# is not a comparison - multi-step search entries vary a lot. Scoring both on the same 18 ids
# is like-for-like and valid at any n.
set -uo pipefail
RES=/root/bfclproj/result
WORK=/root/bfclproj/wsmatch
NEW="$RES/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json"

echo "=== locate the OLD bare-tag web_search results ==="
OLD=""
for c in "$RES"/arch-gov-27b/agentic/BFCL_v4_web_search_base_result.json \
         "$RES"/arch-gov-27b/*/BFCL_v4_web_search_base_result.json; do
  [ -f "$c" ] && { OLD="$c"; break; }
done
if [ -z "$OLD" ]; then
  echo "  NOT FOUND on disk. The 14.00% is on record in V33-SCORECARD but its result file is"
  echo "  absent here, so a matched comparison against it is impossible."
  echo "  Available result files for arch-gov-27b:"
  ls -1 "$RES"/arch-gov-27b/*/ 2>/dev/null | sed 's/^/    /'
  echo
  echo "  Scoring the NEW run alone on its completed ids instead."
else
  echo "  found: $OLD ($(wc -l < "$OLD") rows)"
fi

echo
echo "=== new run rows: $(wc -l < "$NEW" 2>/dev/null || echo 0) ==="

rm -rf "$WORK"; mkdir -p "$WORK/score" "$WORK/result/arch-gov-27b-sys/agentic"
cp "$NEW" "$WORK/result/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json"

if [ -n "$OLD" ]; then
  mkdir -p "$WORK/result/arch-gov-27b/agentic"
  python3 - "$WORK" "$OLD" <<'PY'
import io, json, os, sys
work, old = sys.argv[1], sys.argv[2]
new = os.path.join(work, "result/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json")
ids = {json.loads(l)["id"] for l in io.open(new, encoding="utf-8") if l.strip()}
out = os.path.join(work, "result/arch-gov-27b/agentic/BFCL_v4_web_search_base_result.json")
kept = 0
with io.open(out, "w", encoding="utf-8") as fh:
    for l in io.open(old, encoding="utf-8"):
        l = l.strip()
        if not l: continue
        r = json.loads(l)
        if r["id"] in ids:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n"); kept += 1
print("  matched old rows on the new run's %d ids: %d" % (len(ids), kept))
PY
fi

echo
cd /root/bfclproj
for M in arch-gov-27b-sys arch-gov-27b; do
  [ -d "$WORK/result/$M" ] || continue
  echo "--- $M ---"
  ( /root/bfclenv/bin/bfcl evaluate --model "$M" --test-category web_search_base --partial-eval \
      --result-dir "$WORK/result" --score-dir "$WORK/score" 2>&1 \
      | grep -E "Accuracy|Error" ) || true
done

echo
echo "=== did the model actually SEARCH this time? ==="
python3 - "$WORK" <<'PY'
import io, json, os, sys, re
work = sys.argv[1]
for m in ("arch-gov-27b-sys", "arch-gov-27b"):
    p = os.path.join(work, "result", m, "agentic", "BFCL_v4_web_search_base_result.json")
    if not os.path.exists(p): continue
    q = ans = empty = rows = 0
    for line in io.open(p, encoding="utf-8"):
        line = line.strip()
        if not line: continue
        rows += 1
        s = json.dumps(json.loads(line).get("result"))
        q += len(re.findall(r"search_engine_query", s))
        if "'answer'" in s or '"answer"' in s: ans += 1
        if s.strip() in ("[]", "[[]]", "null", '""'): empty += 1
    print("  %-18s rows=%-3d search_calls=%-4d rows_reaching_an_answer=%-3d empty=%d"
          % (m, rows, q, ans, empty))
PY

echo
echo "=== TABLE (on record: bare+dead-search over 100 entries = 14.00%) ==="
date
cat "$WORK/score/data_agentic.csv" 2>/dev/null || echo "(no agentic csv)"
