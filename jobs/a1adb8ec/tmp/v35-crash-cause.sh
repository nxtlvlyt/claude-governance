#!/usr/bin/env bash
# The rc=134 run's actual error: log lines 400-500 region, minus progress bars.
set -uo pipefail
sed -n '380,500p' /root/bfclproj/train-v35.log | tr '\r' '\n' | grep -vE '^\s*$|/720 \[' | tail -40
exit 0
