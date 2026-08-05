#!/usr/bin/env bash
# Definitive stall diagnosis: py-spy stack of the spinning trainer PID.
set -uo pipefail
/root/cq-venv/bin/pip install --quiet py-spy 2>/dev/null || true
PID=$(ps -eo pid,pcpu,args | grep '[t]rain_student_generic' | sort -k2 -rn | head -1 | awk '{print $1}')
echo "spinning pid: $PID"
/root/cq-venv/bin/py-spy dump --pid "$PID" 2>&1 | head -40
exit 0
