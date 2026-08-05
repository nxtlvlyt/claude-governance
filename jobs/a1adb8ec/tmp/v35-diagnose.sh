#!/usr/bin/env bash
# v3.5 launch-failure diagnosis: what did the release step see, and is the GPU free NOW?
set -uo pipefail
echo "--- train-v35.log: release + dryrun section ---"
grep -n 'release VRAM\|gpu:\|DRYRUN\|dry-run\|clear after\|TRAIN rc' /root/bfclproj/train-v35.log | tail -10
echo "--- GPU now ---"
nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader | head -1
echo "--- ollama residency now ---"
curl -s http://172.30.144.1:11434/api/ps | python3 -c 'import sys,json; ms=json.load(sys.stdin).get("models") or []; print("(none)" if not ms else "\n".join("%s vram=%.1fGB" % (m["name"], m.get("size_vram",0)/1e9) for m in ms))'
echo "--- unload anything resident ---"
for m in $(curl -s http://172.30.144.1:11434/api/ps | python3 -c 'import sys,json;[print(x["name"]) for x in (json.load(sys.stdin).get("models") or [])]' 2>/dev/null); do
  echo "unloading $m"
  curl -s http://172.30.144.1:11434/api/generate -d "{\"model\":\"$m\",\"keep_alive\":0}" -o /dev/null
done
sleep 15
echo "--- GPU after unload+15s ---"
nvidia-smi --query-gpu=memory.used --format=csv,noheader | head -1
exit 0
