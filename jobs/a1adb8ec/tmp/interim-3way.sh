#!/usr/bin/env bash
# Three-way comparison on MATCHED entry IDs:
#   arch-gov-27b       tuned, BARE        (0-char system block)
#   arch-gov-27b-sys   tuned, WITH SYSTEM (4371-char system block)
#   qwen3.6-27b-base   untuned control
#
# WHY MATCHED IDs: multi_turn entries vary enormously in difficulty and turn count, so N rows
# of one model against M rows of another compares different question sets. Scoring all three
# on exactly the IDs ALL THREE have completed is like-for-like and valid at any n; only the
# confidence interval changes. The control stopped at 11 rows, so 11 is the ceiling here.
#
# WHAT IT DECIDES: whether v3.3's 0.00%/4.00% on multi_turn measures lost capability or a
# serving mismatch. 60.1% of the bare model's turn-responses are EMPTY strings while its
# non-empty ones are correctly formatted BFCL calls. If WITH-SYSTEM recovers, the defect is
# trap 18 in the benchmark, not the tune.
#
# SAFETY: copies result files to a scratch dir and scores the copies. The live generation's
# files are never touched. bfcl evaluate for multi_turn is CPU-side state comparison.
set -uo pipefail

RES=/root/bfclproj/result
WORK=/root/bfclproj/interim3
MIN=${1:-11}

declare -A SRC=(
  [arch-gov-27b]="$RES/arch-gov-27b/multi_turn/BFCL_v4_multi_turn_base_result.json"
  [arch-gov-27b-sys]="$RES/arch-gov-27b-sys/multi_turn/BFCL_v4_multi_turn_base_result.json"
  [qwen3.6-27b-base]="$RES/qwen3.6-27b-base/multi_turn/BFCL_v4_multi_turn_base_result.json"
)

for m in "${!SRC[@]}"; do
  n=$( [ -f "${SRC[$m]}" ] && wc -l < "${SRC[$m]}" || echo 0 )
  echo "  $m: $n rows"
done

sysn=$( [ -f "${SRC[arch-gov-27b-sys]}" ] && wc -l < "${SRC[arch-gov-27b-sys]}" || echo 0 )
if [ "$sysn" -lt "$MIN" ]; then
  echo "WITH-SYSTEM has $sysn rows, need $MIN. Not scoring yet."
  exit 0
fi

rm -rf "$WORK"; mkdir -p "$WORK/score"
for m in "${!SRC[@]}"; do mkdir -p "$WORK/result/$m/multi_turn"; done

python3 - "$WORK" "${SRC[arch-gov-27b]}" "${SRC[arch-gov-27b-sys]}" "${SRC[qwen3.6-27b-base]}" <<'PY'
import io, json, os, sys
work = sys.argv[1]
paths = {"arch-gov-27b": sys.argv[2], "arch-gov-27b-sys": sys.argv[3], "qwen3.6-27b-base": sys.argv[4]}

rows = {}
for m, p in paths.items():
    d = {}
    if os.path.exists(p):
        for line in io.open(p, encoding="utf-8"):
            line = line.strip()
            if line:
                r = json.loads(line)
                d[r["id"]] = r
    rows[m] = d
    print("  %-20s %d ids" % (m, len(d)))

common = set.intersection(*[set(v) for v in rows.values()]) if all(rows.values()) else set()
print("  COMMON IDS: %d" % len(common))
if not common:
    raise SystemExit("no common ids")

for m, d in rows.items():
    out = os.path.join(work, "result", m, "multi_turn", "BFCL_v4_multi_turn_base_result.json")
    with io.open(out, "w", encoding="utf-8") as fh:
        for i in sorted(common):
            fh.write(json.dumps(d[i], ensure_ascii=False) + "\n")
PY

echo
for M in arch-gov-27b arch-gov-27b-sys qwen3.6-27b-base; do
  echo "--- $M ---"
  ( cd /root/bfclproj && /root/bfclenv/bin/bfcl evaluate --model "$M" \
      --test-category multi_turn_base --partial-eval \
      --result-dir "$WORK/result" --score-dir "$WORK/score" 2>&1 \
      | grep -E "Accuracy|Error|Traceback" ) || true
done

echo
echo "=== EMPTY-RESPONSE RATE on the common ids (the mechanism) ==="
python3 - "$WORK" <<'PY'
import io, json, os, sys
work = sys.argv[1]
for m in ("arch-gov-27b", "arch-gov-27b-sys", "qwen3.6-27b-base"):
    p = os.path.join(work, "result", m, "multi_turn", "BFCL_v4_multi_turn_base_result.json")
    empty = nonempty = 0
    for line in io.open(p, encoding="utf-8"):
        line = line.strip()
        if not line: continue
        res = json.loads(line).get("result")
        if not isinstance(res, list): continue
        for turn in res:
            for s in (turn if isinstance(turn, list) else [turn]):
                if isinstance(s, str):
                    if s.strip(): nonempty += 1
                    else: empty += 1
    tot = empty + nonempty
    print("  %-20s empty %4d/%-4d (%5.1f%%)" % (m, empty, tot, 100.0*empty/max(tot,1)))
PY

echo
echo "=== TABLE ==="
date
cat "$WORK/score/data_multi_turn.csv" 2>/dev/null
echo
echo "n is small - directional. Full runs continue."
