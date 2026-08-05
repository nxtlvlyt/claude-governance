#!/usr/bin/env bash
# What holds the lane? bfcl procs, python procs, ollama residency + recent api hits.
set -uo pipefail
echo "--- bfcl gen procs (the wait-loop's exact pattern) ---"
ps -eo pid,etime,args | grep '[b]fcl' | head -6 || echo "(none)"
echo "--- all bfclenv/cq python procs ---"
ps -eo pid,etime,args | grep -E '[b]fclenv|[c]q-v34|[h]oldout' | head -8 || echo "(none)"
echo "--- ollama residency ---"
curl -s --max-time 10 http://172.30.144.1:11434/api/ps | python3 -c 'import sys,json; ms=json.load(sys.stdin).get("models") or []; print("(none)" if not ms else "\n".join("%s expires=%s" % (m["name"], m.get("expires_at","?")) for m in ms))'
exit 0
