#!/usr/bin/env bash
# Why is the control run stuck at 9 rows, and why are there TWO bfcl generate processes?
# Read-only diagnosis. Kill nothing until the picture is clear - a wrong kill costs the run.
set -uo pipefail
OLLAMA=http://172.30.144.1:11434

echo "=== date ==="; date

echo
echo "=== every bfcl-related process, with start time and full command ==="
ps -eo pid,ppid,lstart,etime,stat,args | grep -i "[b]fcl" || echo "  none"

echo
echo "=== process tree around them ==="
for p in $(pgrep -f "bfcl generate"); do
  echo "--- pid $p ---"
  ps -o pid,ppid,etime,stat,args -p "$p"
  echo "  parent:"; ps -o pid,ppid,etime,args -p "$(ps -o ppid= -p "$p" | tr -d ' ')" 2>/dev/null
done

echo
echo "=== row counts (all models) ==="
for f in /root/bfclproj/result/*/multi_turn/*_result.json; do
  [ -f "$f" ] && printf "  %6s  %s  (mtime %s)\n" "$(wc -l < "$f")" "$(basename "$(dirname "$(dirname "$f")")")/$(basename "$f")" "$(stat -c %y "$f" | cut -d. -f1)"
done

echo
echo "=== ollama: what is loaded, and is anything actually running? ==="
curl -s "$OLLAMA/api/ps" | python3 -c '
import sys,json
d=json.load(sys.stdin)
ms=d.get("models") or []
if not ms: print("  NOTHING RESIDENT  <-- if generate is alive, it is waiting on a load")
for m in ms:
    print("  %-26s vram=%.1fGB expires=%s" % (m.get("name"), (m.get("size_vram") or 0)/1e9, m.get("expires_at")))
'

echo
echo "=== established connections to ollama, per pid ==="
ss -tnp 2>/dev/null | grep 11434 | sed 's/^/  /' | head -12

echo
echo "=== serial-multiturn log: last 12 real lines (CR-split) ==="
tr '\r' '\n' < /root/bfclproj/serial-multiturn.log | grep -v '^\s*$' | tail -12

echo
echo "=== is a SECOND launcher running? ==="
ps -eo pid,etime,args | grep "[r]un-multiturn-serial" || echo "  no launcher script processes"

echo
echo "=== GPU ==="
nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader 2>/dev/null || echo "  nvidia-smi unavailable in this namespace"
