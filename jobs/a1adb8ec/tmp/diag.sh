#!/bin/bash
echo "--- bfcl processes ---"
pgrep -af "bfcl|python" | head -5 || echo "(none)"
echo "--- bfclproj contents ---"
ls -la ~/bfclproj/ 2>/dev/null | head -8
echo "--- any result dir ---"
find ~/bfclproj/result -type f 2>/dev/null | head -5 || echo "(no result files)"
echo "--- can WSL reach ollama right now? ---"
curl -s -o /dev/null -w "  172.30.144.1:11434 -> %{http_code}\n" --max-time 10 http://172.30.144.1:11434/api/tags
echo "--- host gateway ip now ---"
ip route show default | awk '{print "  gw="$3}'
