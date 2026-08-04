#!/usr/bin/env bash
# Every scored lane, so "is the tune better than base" is answered from the score files
# rather than from memory of them.
set -uo pipefail
for f in /root/bfclproj/score/data_*.csv; do
  [ -f "$f" ] || continue
  echo "########## ${f##*/} ##########"
  cat "$f"
  echo
done
echo "########## which models have ANY result files ##########"
for d in /root/bfclproj/result/*/; do
  n=$(find "$d" -name '*_result.json' 2>/dev/null | wc -l)
  echo "  ${d}  ->  $n result files"
  find "$d" -name '*_result.json' 2>/dev/null | while read -r x; do
    echo "        $(wc -l < "$x") rows  ${x##*/}"
  done
done
