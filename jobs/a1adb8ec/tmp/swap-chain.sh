#!/usr/bin/env bash
# Swap the queued trainer chain onto the patched script:
# kill the WAITING chain (loses nothing — it is pre-work), then the caller ships the new file
# and refires the schtask. Refuses if the trainer has already started (never kill a live train).
set -uo pipefail
if [ "$(ps -eo args | grep -c '[t]rain_student_generic' || true)" -gt 0 ]; then
  echo "REFUSE: trainer already running — do not swap now"
  exit 1
fi
for pid in $(ps -eo pid,args | grep '[t]rain-v35.sh' | awk '{print $1}'); do
  echo "killing waiting chain pid $pid"
  kill "$pid" 2>/dev/null || true
done
sleep 2
ps -eo pid,args | grep '[t]rain-v35' | grep -v grep || echo "chain gone"
exit 0
