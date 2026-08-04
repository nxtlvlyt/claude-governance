#!/usr/bin/env bash
# STOP the eval chain and quarantine anything it produced.
#
# Audit finding #2 (verified): ollama create returned HTTP 400 for BOTH v34 tags — no
# arch-gov-27b-v34 exists in /api/tags — yet post-merge-chain.sh proceeded into stages 4-7 and
# register-and-eval-v34.sh began "scoring" a nonexistent model. Every row it wrote is garbage
# attributed to v3.4, and every search call it makes is Brave quota spent measuring nothing.
# Root cause: export-v34.sh ABORTED (rc=3, "q4km gguf carries NO chat template") but the
# chain's guard only tested that the Q4 file EXISTED.
set -uo pipefail
echo "=== $(date) ==="

echo "=== stop the chain and any generate it started ==="
pkill -f 'post-merge-chain' 2>/dev/null && echo "  chain stopped" || echo "  chain not running"
pkill -f 'register-and-eval-v34' 2>/dev/null && echo "  eval stopped" || echo "  eval not running"
sleep 2
pkill -f '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' 2>/dev/null && echo "  generate stopped" || echo "  no generate"
sleep 2
echo -n "  remaining: chain="; ps -eo args | grep -c '[p]ost-merge-chain' || true
echo -n "  remaining: gen=";   ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true

echo
echo "=== quarantine any v34-attributed result rows (they scored a nonexistent model) ==="
for d in /root/bfclproj/result/arch-gov-27b-v34 /root/bfclproj/result/arch-gov-27b-v34-FC; do
  if [ -d "$d" ]; then
    mv "$d" "${d}.QUARANTINE-scored-nonexistent-model-20260804"
    echo "  quarantined $d"
  else
    echo "  no dir: $d"
  fi
done

echo
echo "=== confirm what the export actually said ==="
grep -E 'ABORT|EXPORT-v34|chat template' /root/export-v34-27b.log 2>/dev/null | tail -6

echo
echo "=== confirm tag absence ==="
curl -s http://172.30.144.1:11434/api/tags | grep -o 'arch-gov-27b-v34[^"]*' | head -3 || echo "  no v34 tags (as the audit found)"

echo
echo "=== what artifacts DO exist ==="
ls -la /mnt/d/conductor-qwen/models/arch-gov-27b-v34* 2>/dev/null || echo "  no v34 ggufs"
echo -n "  merged dir: "; du -sh /mnt/d/conductor-qwen-run/models/arch-gov-27b-v34-merged 2>/dev/null | cut -f1
