#!/usr/bin/env bash
set -uo pipefail
L=/root/bfclproj/websearch-detached.log
echo "=== $(date) ==="
echo "=== log, last 30 real lines ==="
tr '\r' '\n' < "$L" 2>/dev/null | grep -viE 'screen size' | grep -v '^[[:space:]]*$' | tail -30
echo
echo "=== markers ==="
grep -c '### DONE' "$L" 2>/dev/null || echo 0
grep -n '### generate rc=' "$L" 2>/dev/null | tail -3
echo
echo "=== rows ==="
wc -l < /root/bfclproj/result/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json 2>/dev/null || echo 0
echo
echo "=== is the keepalive holding the VM? ==="
ps -eo etime,args | grep -c '[s]leep 43200' || echo 0
echo
echo "=== ollama reachable from WSL? ==="
curl -s -o /dev/null -m 10 -w "  ollama HTTP %{http_code}\n" http://172.30.144.1:11434/api/tags 2>/dev/null || echo "  ollama unreachable"
echo "=== searxng reachable? ==="
curl -s -o /dev/null -m 12 -w "  searxng HTTP %{http_code}\n" "http://100.95.116.67:8080/search?q=test&format=json" 2>/dev/null || echo "  searxng unreachable"
