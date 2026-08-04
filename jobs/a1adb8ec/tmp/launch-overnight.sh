#!/usr/bin/env bash
# Replace the old queue runner with the full overnight chain, detached, verified alive.
set -uo pipefail

echo "=== stop the old queue runner (it only ran the two controls, and is just waiting) ==="
pkill -f 'queue-runner.sh' 2>/dev/null && echo "  stopped" || echo "  not running"
sleep 2

echo
echo "=== syntax check every script the chain will call ==="
for f in /mnt/c/Users/marka/overnight-chain.sh /mnt/c/Users/marka/run-base-control.sh /mnt/c/Users/marka/run-base-fc.sh; do
  sed -i 's/\r$//' "$f"
  bash -n "$f" && echo "  OK ${f##*/}" || { echo "  PARSE FAIL ${f##*/} — refusing to launch"; exit 2; }
done

echo
echo "=== keepalive (WSL tears the VM down when the last session exits) ==="
KA=$(ps -eo args | grep -c '[s]leep 43200' || true)
echo "  present: ${KA:-0}"
if [ "${KA:-0}" -eq 0 ]; then
  setsid nohup sleep 43200 </dev/null >/dev/null 2>&1 & disown || true
  sleep 2; echo "  started: $(ps -eo args | grep -c '[s]leep 43200' || true)"
fi

echo
echo "=== launch chain detached ==="
setsid nohup bash /mnt/c/Users/marka/overnight-chain.sh </dev/null > /root/bfclproj/overnight-launch.log 2>&1 &
disown || true
sleep 8

echo "=== verify alive BEFORE returning ==="
echo "  chain procs    : $(ps -eo args | grep -c '[o]vernight-chain' || true)"
echo "  generate procs : $(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)"
echo "  keepalive      : $(ps -eo args | grep -c '[s]leep 43200' || true)"
echo "  chain log:"
tail -4 /root/bfclproj/overnight.log 2>/dev/null | sed 's/^/    /'
