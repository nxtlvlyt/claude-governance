#!/usr/bin/env bash
# Which pass is the 75/80 counter: fair-base (prompt) or base-FC resume?
set -uo pipefail
echo "--- chain section markers in fairbase.log ---"
grep -n '===\|####' /root/bfclproj/fairbase.log | tail -8
echo "--- result dirs present ---"
ls /root/bfclproj/result/ 2>/dev/null
echo "--- banked rows per relevant result file ---"
for d in /root/bfclproj/result/*/; do
  for f in "$d"*web_search_base*; do
    [ -f "$f" ] && echo "  $(wc -l < "$f") rows  $f"
  done
done 2>/dev/null
exit 0
