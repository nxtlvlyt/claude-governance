#!/usr/bin/env bash
# Kill the stale overnight chain, keep the newest.
#
# The relaunch left TWO chains alive: the launcher's pkill named 'queue-runner.sh' (the script
# it originally replaced) and not 'overnight-chain.sh'. Both would have reached the training
# stage and run it concurrently — the exact double-process failure that produced 366 timed-out
# rows earlier in this project, but with a 40-minute GPU job instead of a benchmark.
#
# Keeps the HIGHEST pid (most recently started) and kills the rest. Verifies before and after.
set -uo pipefail

echo "=== chains before ==="
ps -eo pid,lstart,args | grep '[o]vernight-chain.sh' || echo "  none"

PIDS=$(pgrep -f 'bash /mnt/c/Users/marka/overnight-chain.sh' | sort -n)
COUNT=$(echo "$PIDS" | grep -c . || true)
echo
echo "  chain pids: $(echo $PIDS | tr '\n' ' ')  (count $COUNT)"

if [ "${COUNT:-0}" -le 1 ]; then
  echo "  nothing to dedupe"
else
  KEEP=$(echo "$PIDS" | tail -1)
  echo "  keeping newest: $KEEP"
  for p in $PIDS; do
    if [ "$p" != "$KEEP" ]; then
      echo "  killing stale: $p"
      kill "$p" 2>/dev/null || true
    fi
  done
  sleep 3
fi

echo
echo "=== chains after ==="
ps -eo pid,lstart,args | grep '[o]vernight-chain.sh' || echo "  none"
echo
echo "  generate procs: $(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)"
echo "  keepalive     : $(ps -eo args | grep -c '[s]leep 43200' || true)"
