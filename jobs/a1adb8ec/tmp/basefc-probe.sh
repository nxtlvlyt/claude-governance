#!/usr/bin/env bash
# BASEFC-ROPE probe: DONE marker? process alive? counter fresh?
set -uo pipefail
echo "=== $(date) ==="
echo -n "DONE marker count : "
grep -c 'FAIR BASE + FC DONE' /root/bfclproj/fairbase.log 2>/dev/null || echo 0
echo -n "bfcl generate procs: "
ps -eo args | grep -c '[b]fcl generate' || true
echo -n "log mtime          : "
stat -c '%y' /root/bfclproj/fairbase.log
echo -n "latest counter     : "
tr '\r' '\n' < /root/bfclproj/fairbase.log | grep -oE '[0-9]+/80 \[[^]]*\]' | tail -1
echo "--- last 3 non-progress lines ---"
tr '\r' '\n' < /root/bfclproj/fairbase.log | grep -vE '/80 \[' | grep -v '^\s*$' | tail -3
