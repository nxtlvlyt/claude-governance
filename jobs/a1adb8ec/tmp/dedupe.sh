#!/bin/bash
echo "--- before ---"
pgrep -af "bfcl generate" | head -5
# keep the OLDEST generate process, kill the rest (duplicates I launched)
PIDS=$(pgrep -f "bfcl generate" | sort -n)
KEEP=$(echo "$PIDS" | head -1)
for p in $PIDS; do
  if [ "$p" != "$KEEP" ]; then echo "killing duplicate pid=$p"; kill -9 "$p" 2>/dev/null; fi
done
# also kill the wrapper loops so they cannot relaunch more
pkill -f "bfcl-run-all.sh" 2>/dev/null
sleep 3
echo "--- after ---"
pgrep -af "bfcl generate" | head -5 || echo "(none)"
