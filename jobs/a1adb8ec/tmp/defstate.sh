#!/bin/bash
echo "--- exact processes ---"
ps -eo pid,etime,cmd 2>/dev/null | grep -E "bfcl (generate|evaluate)" | grep -v grep | head -4
echo "--- rows + mtime ---"
for f in ~/bfclproj/result/arch-gov-27b/multi_turn/*.json; do
  [ -f "$f" ] && echo "  $(wc -l < "$f") rows  $(date -r "$f" +%H:%M:%S)  $(basename $f)"
done
echo "--- keepalive ---"
pgrep -fc "sleep 43200" 2>/dev/null | sed 's/^/  sleepers: /'
