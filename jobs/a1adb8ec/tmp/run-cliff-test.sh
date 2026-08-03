#!/usr/bin/env bash
# Does the "generalisation cliff" survive when the model is served with its system prompt?
#
# WHAT IS AT STAKE
# V34-SUNNAH-SPEC section 0 rests on this table, all measured on arch-gov-27b-v33-BARE:
#     irrelevance            94.58%   "the drilled shape"
#     web_search_base        14.00%   "untrained shape"
#     web_search_no_snippet   7.00%   "untrained shape"
# and concludes v3.3 learned one situation kind and collapses outside it.
#
# That tag has a 0-char system block while all 360 training rows carried a 4340-char system
# prompt. Measured today on matched multi_turn ids: bare emits EMPTY strings on 61.8% of turns;
# with the system prompt, 0.0%. Accuracy went 0.00% -> 30.00%.
#
# So the cliff numbers may be measuring silence, not incapacity. If web_search rises with the
# system prompt the way multi_turn did, the spec's diagnosis needs revising before v3.4 trains
# against it. If it does not rise, the cliff is real and the spec stands.
#
# Either result is worth having. Shipping a corpus built on an unexamined premise is not.
#
# ORDER: web_search first (the load-bearing claim), irrelevance last (it already scores well
# bare, so it is the control - if IT also moves, something broader is going on).
set -uo pipefail

BFCL=/root/bfclenv/bin/bfcl
RES=/root/bfclproj/result
SCORE=/root/bfclproj/score
LOG=/root/bfclproj/cliff-test.log

exec > >(tee -a "$LOG") 2>&1
echo "######## CLIFF TEST START $(date -Is) ########"

echo "=== stop the multi_turn with-system run (directional answer already banked) ==="
pkill -f 'bash /mnt/c/Users/marka/run-withsys.sh' 2>/dev/null && echo "  launcher stopped" || echo "  launcher not running"
sleep 2
pkill -f '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' 2>/dev/null && echo "  generate stopped" || echo "  generate not running"
sleep 3
echo -n "  generate procs remaining: "
ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true
echo "  multi_turn with-system rows banked (kept): $(wc -l < $RES/arch-gov-27b-sys/multi_turn/BFCL_v4_multi_turn_base_result.json 2>/dev/null || echo 0)"

stage () {
  local cat="$1"
  echo
  echo "===== $cat :: WITH SYSTEM PROMPT :: $(date -Is) ====="
  local n
  n=$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)
  if [ "${n:-0}" -gt 0 ]; then
    echo "ABORT: $n generate process(es) already running; refusing to stack a second."
    return 1
  fi
  $BFCL generate --model arch-gov-27b-sys --test-category "$cat" \
      --skip-server-setup --num-threads 4 --result-dir "$RES"
  echo "  generate rc=$?"
  for f in "$RES"/arch-gov-27b-sys/*/*"${cat}"_result.json; do
    [ -f "$f" ] && echo "  rows: $(wc -l < "$f")  $(basename "$f")"
  done
  echo "----- evaluate -----"
  ( cd /root/bfclproj && $BFCL evaluate --model arch-gov-27b-sys --test-category "$cat" \
      --result-dir "$RES" --score-dir "$SCORE" 2>&1 | grep -E "Accuracy|Test completed|Error" ) || true
}

stage web_search_base
stage web_search_no_snippet
stage irrelevance

echo
echo "######## CLIFF TEST DONE $(date -Is) ########"
echo "=== BARE (already on record, V33-SCORECARD) vs WITH SYSTEM (this run) ==="
echo "  irrelevance            bare 94.58%"
echo "  web_search_base        bare 14.00%"
echo "  web_search_no_snippet  bare  7.00%"
echo
for f in "$SCORE"/data_agentic.csv "$SCORE"/data_non_live.csv "$SCORE"/data_overall.csv; do
  [ -f "$f" ] && { echo "--- $(basename "$f") ---"; cat "$f"; echo; }
done
