#!/usr/bin/env bash
set -uo pipefail
echo "=== $(date) ==="
echo
echo "-- generate alive? (interpreter+entrypoint, cannot self-match) --"
ps -eo pid,etime,args | grep '/root/bfclenv/bin/bfcl generate' | grep -v grep || echo "  NONE RUNNING"
echo
echo "-- rows on disk --"
for f in /root/bfclproj/result/arch-gov-27b-sys/*/*.json; do
  [ -f "$f" ] && printf "  %5s  %s\n" "$(wc -l < "$f")" "${f##*/}"
done
echo
echo "-- progress bar --"
tr '\r' '\n' < /root/bfclproj/search-real.log 2>/dev/null | grep -o '[0-9]*/100 \[[^]]*\]' | tail -3
echo
echo "-- last real log lines --"
tr '\r' '\n' < /root/bfclproj/search-real.log 2>/dev/null | grep -viE 'screen size|^\s*$' | tail -6
echo
echo "-- is search still reachable from here? --"
curl -s -o /dev/null -m 12 -w "  searxng HTTP %{http_code}\n" "http://100.95.116.67:8080/search?q=test&format=json" 2>/dev/null || echo "  searxng unreachable"
echo
echo "-- gpu --"
nvidia-smi --query-gpu=memory.used,utilization.gpu --format=csv,noheader 2>/dev/null | head -1
