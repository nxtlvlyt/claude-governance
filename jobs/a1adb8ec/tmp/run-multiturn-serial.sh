#!/usr/bin/env bash
# Complete the v3.3 multi_turn picture. STRICTLY SERIAL.
#
# WHY SERIAL IS A HARD REQUIREMENT, NOT A PREFERENCE:
# Earlier in this project two `bfcl generate` processes were left running against one Ollama
# server. Eight concurrent streams produced 366 timed-out rows and corrupted an hour of
# latency measurements - including the ones used to justify an OLLAMA_NUM_PARALLEL change.
# The operator's words: "you leave old processes that you started hanging so you can progress
# further." One process at a time, verified between stages.
#
# WHY THE UNTUNED CONTROL RUNS FIRST:
# v3.3 scored 4.00% on multi_turn_base. That number is uninterpretable alone - it could mean
# the tune destroyed multi-turn ability, or that the base model never had it. The control is
# the load-bearing measurement, so it goes first in case the run is interrupted.
set -uo pipefail

BFCL=/root/bfclenv/bin/bfcl
RES=/root/bfclproj/result
SCORE=/root/bfclproj/score
LOG=/root/bfclproj/serial-multiturn.log

exec > >(tee -a "$LOG") 2>&1
echo "############ START $(date -Is) ############"

guard_single() {
  # Refuse to start if any generate is already alive. Silence is not success:
  # this must fail loudly rather than add a second stream.
  local n
  n=$(pgrep -c -f "bfcl generate" || true)
  if [ "${n:-0}" -gt 0 ]; then
    echo "ABORT: $n bfcl generate process(es) already running. Not stacking a second."
    pgrep -a -f "bfcl generate" || true
    exit 3
  fi
}

stage() {
  local model="$1" cat="$2" label="$3"
  echo
  echo "===== GENERATE $label :: $model :: $cat :: $(date -Is) ====="
  guard_single
  # No `timeout`: a previous run used `timeout 5400`, which cut three categories off
  # partway (120/200, 97/200, 100/200) and the harness then refused to score them.
  # Bound the work by rows, not by a guessed wall-clock.
  $BFCL generate --model "$model" --test-category "$cat" \
      --skip-server-setup --num-threads 4 --result-dir "$RES"
  local rc=$?
  echo "generate rc=$rc"
  # BFCL resumes: it skips IDs already present, so a re-run tops up rather than restarting.
  for f in "$RES"/*/multi_turn/*"${cat}"_result.json; do
    [ -f "$f" ] && echo "  rows: $(wc -l < "$f")  $f"
  done

  echo "----- EVALUATE $label :: $cat -----"
  ( cd /root/bfclproj && $BFCL evaluate --model "$model" --test-category "$cat" \
      --result-dir "$RES" --score-dir "$SCORE" 2>&1 | grep -E "Accuracy|Test completed|Error" )
  echo "score csv @ $(stat -c '%y' "$SCORE/data_multi_turn.csv" 2>/dev/null)"
  cat "$SCORE/data_multi_turn.csv" 2>/dev/null
}

# 1. THE LOAD-BEARING CONTROL: does the untuned base do any better than 4.00%?
# Registry key verified against model_config.py line 1673 before launching (an earlier
# draft guessed "qwen3.6-27b-untuned-control", which does not exist and would have burned
# a multi-hour run on a typo). Key -> model_name qwen3.6:27b, confirmed present in
# `ollama /api/tags`.
stage "qwen3.6-27b-base" "multi_turn_base" "CONTROL"

# 2. Finish the tuned model's remaining two categories (97/200 and 100/200 on disk).
stage "arch-gov-27b" "multi_turn_miss_func"  "TUNED"
stage "arch-gov-27b" "multi_turn_miss_param" "TUNED"

echo
echo "############ DONE $(date -Is) ############"
echo "FINAL multi_turn table:"
cat "$SCORE/data_multi_turn.csv"
