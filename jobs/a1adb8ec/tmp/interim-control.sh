#!/usr/bin/env bash
# Interim control reading on MATCHED entry IDs, without disturbing the running generation.
#
# WHY MATCHED IDs AND NOT "50 vs 200":
# The tuned model scored 4.00% over all 200 multi_turn_base entries. The control is only ~50
# entries in. Comparing 50 control rows against 200 tuned rows compares two different question
# sets - multi_turn entries vary enormously in difficulty and turn count, so a subset is not a
# sample of the whole in any useful sense. Scoring BOTH models on exactly the IDs the control
# has finished is like-for-like and is valid at any n; only the confidence interval changes.
#
# SAFETY: reads only. Copies result files to a scratch dir and scores the COPIES, so the live
# generation's output files are never touched, locked, or truncated. `bfcl evaluate` for
# multi_turn is CPU-side state comparison, so this does not contend with the GPU.
set -uo pipefail

RES=/root/bfclproj/result
WORK=/root/bfclproj/interim
CTRL_SRC="$RES/qwen3.6-27b-base/multi_turn/BFCL_v4_multi_turn_base_result.json"
TUNED_SRC="$RES/arch-gov-27b/multi_turn/BFCL_v4_multi_turn_base_result.json"

MIN_ROWS=${1:-40}

rows=$( [ -f "$CTRL_SRC" ] && wc -l < "$CTRL_SRC" || echo 0 )
echo "control rows available: $rows (threshold $MIN_ROWS)"
if [ "$rows" -lt "$MIN_ROWS" ]; then
  echo "NOT YET - waiting for $MIN_ROWS. Exiting without scoring."
  exit 0
fi

rm -rf "$WORK"
mkdir -p "$WORK/result/qwen3.6-27b-base/multi_turn" "$WORK/result/arch-gov-27b/multi_turn" "$WORK/score"

cp "$CTRL_SRC" "$WORK/result/qwen3.6-27b-base/multi_turn/BFCL_v4_multi_turn_base_result.json"

python3 - "$WORK" "$TUNED_SRC" <<'PY'
import io, json, os, sys
work, tuned_src = sys.argv[1], sys.argv[2]
ctrl = os.path.join(work, "result/qwen3.6-27b-base/multi_turn/BFCL_v4_multi_turn_base_result.json")

ids = []
for line in io.open(ctrl, encoding="utf-8"):
    line = line.strip()
    if line:
        ids.append(json.loads(line)["id"])
ids_set = set(ids)
print("  control completed IDs: %d" % len(ids_set))

kept = 0
out = os.path.join(work, "result/arch-gov-27b/multi_turn/BFCL_v4_multi_turn_base_result.json")
with io.open(out, "w", encoding="utf-8") as fh:
    for line in io.open(tuned_src, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        r = json.loads(line)
        if r["id"] in ids_set:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
            kept += 1
print("  tuned rows on those same IDs: %d" % kept)
if kept != len(ids_set):
    print("  NOTE: %d control IDs have no tuned counterpart; comparison covers the intersection"
          % (len(ids_set) - kept))
PY

echo
for M in qwen3.6-27b-base arch-gov-27b; do
  echo "--- evaluate $M (partial, matched IDs) ---"
  ( cd /root/bfclproj && /root/bfclenv/bin/bfcl evaluate --model "$M" \
      --test-category multi_turn_base --partial-eval \
      --result-dir "$WORK/result" --score-dir "$WORK/score" 2>&1 \
      | grep -E "Accuracy|Test completed|Error|Traceback" ) || true
done

echo
echo "=== INTERIM MATCHED-ID TABLE ==="
date
cat "$WORK/score/data_multi_turn.csv" 2>/dev/null || echo "(no score csv written)"
echo
echo "n is small; treat as directional. The full 200-entry run continues untouched."
