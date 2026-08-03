#!/usr/bin/env bash
# web_search, measured for the first time with BOTH fixes in place.
#
# WHAT CHANGED SINCE THE 14.00% / 7.00% FIGURES WERE TAKEN
#   1. SYSTEM PROMPT. Those runs used arch-gov-27b-v33-bare (0-char system block) while all
#      360 training rows carried a 4340-char system prompt. Measured on matched multi_turn
#      ids: bare emits EMPTY responses on 61.8% of turns, with-system on 0.0%.
#   2. SEARCH. bfcl's web_search backend is SearXNG at $SEARXNG_URL, which was unset, so it
#      fell back to localhost:8080 - unreachable from WSL (PIPELINE.md:44). Every
#      search_engine_query returned {} silently. The model was searching into a void.
#      Now SEARXNG_URL points at the Hermes laptop over Tailscale; the harness's own
#      WebSearchAPI.search_engine_query returns 4780 chars of correct results.
#
# So 14.00% and 7.00% measured a mute model using a dead tool. V34-SUNNAH-SPEC section 0 calls
# them "the untrained shape" and builds its whole diagnosis on the contrast with irrelevance
# 94.58%. This run establishes what those categories actually score.
#
# ORDER: web_search_base first - it is the load-bearing number.
set -uo pipefail

BFCL=/root/bfclenv/bin/bfcl
RES=/root/bfclproj/result
SCORE=/root/bfclproj/score
LOG=/root/bfclproj/search-real.log

cd /root/bfclproj
set -a; . ./.env; set +a

exec > >(tee -a "$LOG") 2>&1
echo "######## REAL-SEARCH RUN $(date -Is) ########"
echo "SEARXNG_URL=${SEARXNG_URL:-<unset>}"

# Fail loudly rather than repeat the silent-void run.
python3 - <<'PY'
import os, sys
sys.path.insert(0, "/root/bfclenv/lib/python3.12/site-packages")
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.web_search import WebSearchAPI
out = str(WebSearchAPI().search_engine_query(keywords="2024 academy awards best picture"))
if out.strip() in ("{}", "[]", "None", ""):
    print("PREFLIGHT FAIL: search returns empty. Refusing to run - this is the exact "
          "condition that produced the meaningless 14.00%.")
    raise SystemExit(2)
print("PREFLIGHT OK: search returned %d chars" % len(out))
PY
[ $? -ne 0 ] && { echo "aborting"; exit 2; }

guard () {
  local n; n=$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)
  [ "${n:-0}" -gt 0 ] && { echo "ABORT: $n generate already running"; return 1; }
  return 0
}

stage () {
  local cat="$1"
  echo
  echo "===== $cat :: system prompt + live search :: $(date -Is) ====="
  guard || return 1
  # Fresh results: the existing rows for this model/category were produced against a dead
  # search backend and must not be resumed into.
  rm -f "$RES"/arch-gov-27b-sys/agentic/BFCL_v4_"${cat}"_result.json
  $BFCL generate --model arch-gov-27b-sys --test-category "$cat" \
      --skip-server-setup --num-threads 4 --result-dir "$RES"
  echo "  rc=$?"
  local f="$RES/arch-gov-27b-sys/agentic/BFCL_v4_${cat}_result.json"
  [ -f "$f" ] && echo "  rows: $(wc -l < "$f")"
  ( $BFCL evaluate --model arch-gov-27b-sys --test-category "$cat" \
      --result-dir "$RES" --score-dir "$SCORE" 2>&1 | grep -E "Accuracy|Test completed|Error" ) || true
}

stage web_search_base
stage web_search_no_snippet

echo
echo "######## DONE $(date -Is) ########"
echo "BARE + DEAD SEARCH (on record):  web_search_base 14.00%   web_search_no_snippet 7.00%"
echo "THIS RUN (system prompt + live search):"
[ -f "$SCORE/data_agentic.csv" ] && cat "$SCORE/data_agentic.csv"
