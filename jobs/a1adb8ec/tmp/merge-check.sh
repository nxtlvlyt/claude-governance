#!/usr/bin/env bash
set -uo pipefail
echo "=== $(date) ==="
echo "--- did the training STEPS finish? ---"
grep -E 'training starts|training done|dataset rows|merged 16-bit|FATAL|Error' /root/bfclproj/train-v34.log 2>/dev/null | tail -8
echo
echo "--- last 100%/654 line ---"
tr '\r' '\n' < /root/bfclproj/train-v34.log 2>/dev/null | grep -oE '[0-9]+/654 \[[^]]*\]' | tail -3
echo
echo "--- what is it downloading, and how big? ---"
tr '\r' '\n' < /root/bfclproj/train-v34.log 2>/dev/null | grep -viE '^\s*$' | tail -12
echo
echo "--- hf cache growth (the download target) ---"
du -sh /root/.cache/huggingface 2>/dev/null
find /root/.cache/huggingface -name '*.incomplete' -newermt '-20 minutes' 2>/dev/null | head -5
echo
echo "--- network activity ---"
cat /proc/net/dev 2>/dev/null | awk 'NR>2 {rx+=$2} END {printf "  total rx bytes: %.1f GB\n", rx/1e9}'
echo
echo "--- disk on D: (merge target) ---"
df -h /mnt/d 2>/dev/null | tail -1
echo
echo "--- merged dir yet? ---"
ls -la /mnt/d/conductor-qwen-run/models/ 2>/dev/null | head -6
