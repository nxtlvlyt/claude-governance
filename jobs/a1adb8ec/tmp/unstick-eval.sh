#!/usr/bin/env bash
# The holdout eval is starving: 49 min elapsed, 0 CPU time. qwen3.6:27b is resident AND busy,
# so Ollama cannot evict it to load arch-gov-27b-v34, and every v3.4 call times out at 240s
# into resp=None. Left alone this "completes" in ~3.5h with a garbage all-None table for the
# tuned models — the phantom-scoring failure wearing yet another costume.
#
# Suspect: a stray bfcl generate that survived earlier pkills (one 'gen=1' leftover was seen
# right after the quarantine). Find it, kill it, restart the eval clean (results write at the
# end, so nothing banked is lost).
set -uo pipefail
echo "=== $(date) ==="
echo "=== every process that could be driving qwen3.6:27b ==="
ps -eo pid,etime,pcpu,args | grep -E '[b]fcl|[o]llama|[h]oldout|[i]nterim|[r]un-base|[f]c-lane|[q]ueue-runner|[o]vernight' | grep -v grep

echo
echo "=== kill strays: bfcl generates and old lane scripts ==="
pkill -f 'bfcl generate' 2>/dev/null && echo "  killed bfcl generate" || echo "  no bfcl generate"
pkill -f 'run-base-control' 2>/dev/null && echo "  killed base-control" || true
pkill -f 'run-base-fc' 2>/dev/null && echo "  killed base-fc" || true
pkill -f 'run-fc-lane' 2>/dev/null && echo "  killed fc-lane" || true
pkill -f 'register-and-eval' 2>/dev/null && echo "  killed register-eval" || true

echo
echo "=== kill the starved eval (it holds ~12 rows of None; restart is cheaper than salvage) ==="
pkill -f 'holdout-eval' 2>/dev/null && echo "  killed" || echo "  not running"
pkill -f 'nxt-eval-and-spec' 2>/dev/null || true
sleep 3

echo
echo "=== force-unload everything so v3.4 can load first ==="
for m in $(curl -s http://172.30.144.1:11434/api/ps | python3 -c 'import sys,json;[print(x["name"]) for x in (json.load(sys.stdin).get("models") or [])]' 2>/dev/null); do
  echo "  unloading $m"
  curl -s http://172.30.144.1:11434/api/generate -d "{\"model\":\"$m\",\"keep_alive\":0}" -o /dev/null
done
sleep 8
echo "  gpu now: $(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader | head -1)"

echo
echo "=== truncate the empty results file and restart via the surviving schtask ==="
: > /mnt/c/Users/marka/cq-v34/phase4/holdout-results.jsonl
echo "restart is via: schtasks /run /tn cq-evalspec (fired from Windows side next)"
