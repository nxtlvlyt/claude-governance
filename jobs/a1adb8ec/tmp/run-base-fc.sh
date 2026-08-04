#!/usr/bin/env bash
# Base FC control — the counterpart to the tuned FC lane.
#
# WHY IT EXISTS, AND WHO ASKED FOR IT
# The operator, 2026-08-04: "will there be a base fc?" — spotted before I did that the tuned FC
# lane was about to produce another uncontrolled number. That is the third missing control he
# has caught first today; the pattern is that I queue the interesting measurement and forget
# the boring one that makes it mean anything.
#
# The full matrix this completes:
#   tuned  Prompt  51.00%  (done, n=100)
#   tuned  FC      running
#   base   Prompt  staged  (run-base-control.sh)
#   base   FC      THIS
#
# Only with all four can "did the tune help?" be separated from "does FC mode help?" — two
# effects that would otherwise be confounded in every comparison.
#
# The base gets an FC registry entry pointing at the untuned qwen3.6:27b with is_fc_model=True.
# No system prompt: that is its native condition, it was never trained with one.
set -uo pipefail
MC=/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py
BFCL=/root/bfclenv/bin/bfcl
RES=/root/bfclproj/result
SCORE=/root/bfclproj/score

cd /root/bfclproj
set -a; . ./.env; set +a

echo "=== preflight: search live ==="
python3 - <<'PY'
import sys
sys.path.insert(0, "/root/bfclenv/lib/python3.12/site-packages")
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.web_search import WebSearchAPI
out = str(WebSearchAPI().search_engine_query(keywords="2024 academy awards best picture"))
if len(out) < 200:
    print("PREFLIGHT FAIL: %d chars" % len(out)); raise SystemExit(2)
print("  live: %d chars" % len(out))
PY
[ $? -ne 0 ] && exit 2

echo
echo "=== register qwen3.6-27b-base-FC ==="
if grep -q '"qwen3.6-27b-base-FC"' "$MC"; then
  echo "  already registered"
else
  cp "$MC" "$MC.bak-basefc-20260804"
  python3 - "$MC" <<'PY'
import io, sys
p = sys.argv[1]
src = io.open(p, encoding="utf-8").read()
anchor = '    "qwen3.6-27b-base": ModelConfig('
assert anchor in src, "anchor not found; refusing to guess"
entry = '''    "qwen3.6-27b-base-FC": ModelConfig(
        model_name="qwen3.6:27b",
        display_name="Qwen3.6-27B untuned control (FC)",
        url="local://qwen3.6-27b",
        org="Qwen",
        license="apache-2.0",
        model_handler=ArchLocalHandler,
        input_price=None,
        output_price=None,
        is_fc_model=True,
        underscore_to_dot=False,
    ),
'''
io.open(p, "w", encoding="utf-8").write(src.replace(anchor, entry + anchor, 1))
print("  registered qwen3.6-27b-base-FC")
PY
fi

n=$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)
if [ "${n:-0}" -gt 0 ]; then echo "ABORT: $n generate running — must be SERIAL"; exit 3; fi

echo
echo "=== untuned base :: FC :: web_search_base :: $(date -Is) ==="
$BFCL generate --model qwen3.6-27b-base-FC --test-category web_search_base \
    --skip-server-setup --num-threads 4 --result-dir "$RES"
echo "  rc=$?"
$BFCL evaluate --model qwen3.6-27b-base-FC --test-category web_search_base \
    --result-dir "$RES" --score-dir "$SCORE" 2>&1 | grep -E "Accuracy|Error"

echo
echo "=== THE FULL 2x2 ==="
cat "$SCORE/data_agentic.csv"
echo
echo "### BASE FC DONE $(date -Is)"
