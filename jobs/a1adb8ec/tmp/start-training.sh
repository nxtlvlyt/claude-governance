#!/usr/bin/env bash
# Stop the flapping chain and launch training detached.
set -uo pipefail

echo "=== stop the old chain (it has restarted 5x and keeps racing the VM) ==="
pkill -f 'overnight-chain.sh' 2>/dev/null && echo "  stopped" || echo "  not running"
sleep 2

echo
echo "=== validate ==="
sed -i 's/\r$//' /mnt/c/Users/marka/train-now.sh
bash -n /mnt/c/Users/marka/train-now.sh && echo "  train-now.sh parses OK" || exit 2

echo
echo "=== refuse to stack a second trainer ==="
n=$(ps -eo args | grep -c '[t]rain_student_generic' || true)
if [ "${n:-0}" -gt 0 ]; then echo "  ABORT: training already running"; exit 3; fi
echo "  clear"

echo
echo "=== launch detached ==="
setsid nohup bash /mnt/c/Users/marka/train-now.sh </dev/null > /root/bfclproj/train-launch.log 2>&1 &
disown || true
sleep 20

echo "=== verify alive BEFORE returning ==="
echo "  train-now procs : $(ps -eo args | grep -c '[t]rain-now' || true)"
echo "  trainer procs   : $(ps -eo args | grep -c '[t]rain_student_generic' || true)"
echo "  gpu             : $(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader 2>/dev/null | head -1)"
echo "  log:"
tail -12 /root/bfclproj/train-v34.log 2>/dev/null | grep -v '^[[:space:]]*$' | sed 's/^/    /'
