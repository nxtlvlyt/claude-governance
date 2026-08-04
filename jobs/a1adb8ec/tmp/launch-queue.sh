#!/usr/bin/env bash
# Launch the serial queue runner detached. Written as a FILE rather than an inline ssh string —
# the PowerShell -> ssh -> cmd -> wsl chain has now mangled quoting five times today, and each
# time the fix was the same: put it in a script.
set -uo pipefail

for f in /mnt/c/Users/marka/queue-runner.sh /mnt/c/Users/marka/run-base-fc.sh /mnt/c/Users/marka/run-base-control.sh; do
  sed -i 's/\r$//' "$f"
  bash -n "$f" && echo "  parses OK: ${f##*/}" || { echo "  PARSE FAIL: ${f##*/}"; exit 2; }
done

echo
echo "=== keepalive present? (WSL tears the VM down when the last session exits) ==="
KA=$(ps -eo args | grep -c '[s]leep 43200' || true)
echo "  keepalive: ${KA:-0}"
if [ "${KA:-0}" -eq 0 ]; then
  setsid nohup sleep 43200 </dev/null >/dev/null 2>&1 &
  disown || true
  sleep 2
  echo "  started one: $(ps -eo args | grep -c '[s]leep 43200' || true)"
fi

echo
echo "=== launch queue runner detached ==="
setsid nohup bash /mnt/c/Users/marka/queue-runner.sh </dev/null > /root/bfclproj/queue-launch.log 2>&1 &
disown || true
sleep 8

echo "=== verify alive before returning ==="
echo "  queue-runner procs : $(ps -eo args | grep -c '[q]ueue-runner' || true)"
echo "  generate procs     : $(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)"
echo "  keepalive          : $(ps -eo args | grep -c '[s]leep 43200' || true)"
echo "  runner log:"
tr '\r' '\n' < /root/bfclproj/queue-runner.log 2>/dev/null | grep -v '^[[:space:]]*$' | tail -5 | sed 's/^/    /'
