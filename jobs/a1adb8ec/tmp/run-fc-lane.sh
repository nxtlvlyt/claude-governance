#!/usr/bin/env bash
# Measure the FC (native function-calling) lane — the comparison where the frontier is
# strongest and this model is untested.
#
# WHY IT MATTERS
# Leaderboard, read 2026-08-04: our 51.00 on web_search_base ranks #28/110 overall but #7/36
# among PROMPT-mode models, because FC beats Prompt by a mean 21.8 points (19 of 25 paired
# models) and by 66-76 points for the leaders. Every claim about this model so far is a
# prompt-mode claim. Whether it can do native tool calling at all is simply unmeasured — and
# an unmeasured lane is exactly the gap that lets a comparison be quoted wrongly later.
#
# The registry already carries `arch-gov-27b-FC` with is_fc_model=True, but it points at the
# BARE tag (0-char system block) — the configuration proven today to suppress 60% of this
# model's output. So it would measure the same artifact all over again. This registers an FC
# entry against the WITH-SYSTEM tag.
#
# Then web_search_no_snippet, the one category never run with a live backend.
set -uo pipefail

MC=/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py
BFCL=/root/bfclenv/bin/bfcl
RES=/root/bfclproj/result
SCORE=/root/bfclproj/score
LOG=/root/bfclproj/fc-lane.log

cd /root/bfclproj
set -a; . ./.env; set +a
exec > >(tee -a "$LOG") 2>&1
echo "######## FC LANE + NO_SNIPPET $(date -Is) ########"

echo "=== preflight: search must be live ==="
python3 - <<'PY'
import sys
sys.path.insert(0, "/root/bfclenv/lib/python3.12/site-packages")
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.web_search import WebSearchAPI
out = str(WebSearchAPI().search_engine_query(keywords="2024 academy awards best picture"))
if len(out) < 200:
    print("PREFLIGHT FAIL: %d chars" % len(out)); raise SystemExit(2)
print("  search live: %d chars" % len(out))
PY
[ $? -ne 0 ] && exit 2

echo
echo "=== register arch-gov-27b-sys-FC (with-system tag, is_fc_model=True) ==="
if grep -q '"arch-gov-27b-sys-FC"' "$MC"; then
  echo "  already registered"
else
  cp "$MC" "$MC.bak-fclane-20260804"
  python3 - "$MC" <<'PY'
import io, sys
p = sys.argv[1]
src = io.open(p, encoding="utf-8").read()
anchor = '    "arch-gov-27b-sys": ModelConfig('
assert anchor in src, "anchor not found; refusing to guess an insertion point"
entry = '''    "arch-gov-27b-sys-FC": ModelConfig(
        model_name="arch-gov-27b-v33-sys",
        display_name="Arch-Gov-27B v3.3 (FC, WITH trained system prompt)",
        url="local://arch-gov-27b-v33",
        org="local",
        license="apache-2.0",
        model_handler=ArchLocalHandler,
        input_price=None,
        output_price=None,
        is_fc_model=True,
        underscore_to_dot=False,
    ),
'''
io.open(p, "w", encoding="utf-8").write(src.replace(anchor, entry + anchor, 1))
print("  registered arch-gov-27b-sys-FC")
PY
fi

guard () {
  local n; n=$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)
  [ "${n:-0}" -gt 0 ] && { echo "ABORT: $n generate already running"; return 1; }
  return 0
}

stage () {
  local model="$1" cat="$2"
  echo
  echo "===== $model :: $cat :: $(date -Is) ====="
  guard || return 1
  $BFCL generate --model "$model" --test-category "$cat" \
      --skip-server-setup --num-threads 4 --result-dir "$RES"
  echo "  rc=$?"
  ( $BFCL evaluate --model "$model" --test-category "$cat" \
      --result-dir "$RES" --score-dir "$SCORE" 2>&1 | grep -E "Accuracy|Error" ) || true
}

stage arch-gov-27b-sys-FC web_search_base
stage arch-gov-27b-sys    web_search_no_snippet

echo
echo "=== search consumption ==="
python3 - <<'PY'
import io, json, os
p = "/root/bfclproj/search-calls.jsonl"
if os.path.exists(p):
    rs = [json.loads(l) for l in io.open(p, encoding="utf-8") if l.strip()]
    if rs:
        last = rs[-1]
        print("  calls=%d empty=%d (%.1f%%)  approx spend=$%.2f"
              % (last["calls"], last["empty"], 100.0*last["empty"]/max(last["calls"],1),
                 last["calls"]*5.0/1000))
PY
echo
echo "######## DONE $(date -Is) ########"
cat "$SCORE/data_agentic.csv" 2>/dev/null
