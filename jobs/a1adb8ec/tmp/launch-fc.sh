#!/usr/bin/env bash
# Detached launcher for the FC lane. Self-contained rather than sed-patched through the
# PowerShell -> ssh -> cmd -> wsl quoting chain, which has mangled commands repeatedly today.
#
# Pattern per PIPELINE.md:23 — setsid nohup ... </dev/null, then VERIFY ALIVE before returning
# (line 30: watchers cover process-gone, a silent death with no marker is what wasted hours).
# Also checks the keepalive, because WSL2 tears the utility VM down when the last session
# exits and three runs died to exactly that today.
set -uo pipefail

LOG=/root/bfclproj/fc-detached.log
RUN=/mnt/c/Users/marka/run-fc-lane.sh

echo "=== keepalive holding the VM? ==="
KA=$(ps -eo args | grep -c '[s]leep 43200' || true)
echo "  keepalive processes: ${KA:-0}"
if [ "${KA:-0}" -eq 0 ]; then
  echo "  none — starting one so this job cannot die to a VM teardown"
  setsid nohup sleep 43200 </dev/null >/dev/null 2>&1 &
  disown || true
  sleep 2
  echo "  now: $(ps -eo args | grep -c '[s]leep 43200' || true)"
fi

echo
echo "=== refuse to stack a second generate ==="
n=$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)
if [ "${n:-0}" -gt 0 ]; then echo "  ABORT: $n already running"; exit 3; fi
echo "  clear"

sed -i 's/\r$//' "$RUN"
bash -n "$RUN" && echo "  script parses OK"

echo
echo "=== launch detached ==="
setsid nohup bash "$RUN" </dev/null > "$LOG" 2>&1 &
disown || true
sleep 15

echo "=== verify alive BEFORE returning ==="
echo "  generate procs : $(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)"
echo "  runner procs   : $(ps -eo args | grep -c '[r]un-fc-lane' || true)"
echo "  keepalive      : $(ps -eo args | grep -c '[s]leep 43200' || true)"
echo "  log:"
tr '\r' '\n' < "$LOG" 2>/dev/null | grep -viE 'screen size' | grep -v '^[[:space:]]*$' | tail -8 | sed 's/^/    /'
