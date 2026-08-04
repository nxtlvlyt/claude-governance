#!/usr/bin/env bash
set -uo pipefail
echo "=== full recent log (25 lines, CR-split) ==="
tr '\r' '\n' < /root/bfclproj/eval-and-spec.log | grep -v '^\s*$' | tail -25
echo
echo "=== residency with expiry (who loaded it, roughly when does it lapse) ==="
curl -s http://172.30.144.1:11434/api/ps | python3 -m json.tool 2>/dev/null | grep -E '"name"|expires_at|size_vram'
echo
echo "=== eval process CPU time (advancing = alive, frozen = hung) ==="
ps -eo pid,etime,cputime,args | grep '[h]oldout-eval'
sleep 20
ps -eo pid,etime,cputime,args | grep '[h]oldout-eval'
