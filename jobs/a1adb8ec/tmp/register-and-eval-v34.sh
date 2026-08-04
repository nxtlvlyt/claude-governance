#!/usr/bin/env bash
# Register v3.4 in BFCL and score it — paired with its controls, per spec §4.6.
#
# §4.6 (V34-SUNNAH-SPEC, added 2026-08-04 after three uncontrolled lanes shipped):
# "no measurement is registered without its control named in the same act. Lanes queue as
# PAIRS or not at all." So every v3.4 lane here has its v3.3 counterpart already on disk, and
# the base controls run in the same chain rather than being left for later.
#
# THE MATRIX THIS COMPLETES
#              Prompt      FC
#   v3.3       51.00%   67.00%   done
#   base        queued   queued   (run-base-control.sh / run-base-fc.sh)
#   v3.4         here     here
#
# Serial by construction: one bfcl generate at a time against one Ollama. Two concurrent
# processes produced 366 timed-out rows earlier in this project.
set -uo pipefail
LOG=/root/bfclproj/eval-v34.log
MC=/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py
BFCL=/root/bfclenv/bin/bfcl
RES=/root/bfclproj/result
SCORE=/root/bfclproj/score

cd /root/bfclproj
set -a; . ./.env; set +a
exec > >(tee -a "$LOG") 2>&1
echo "######## REGISTER + EVAL v3.4 $(date -Is) ########"

echo "=== preflight: search must be live, or every score is void ==="
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
echo "=== register v3.4 lanes (Prompt + FC) ==="
python3 - "$MC" <<'PYEOF'
import io, sys
p = sys.argv[1]
src = io.open(p, encoding="utf-8").read()
anchor = '    "arch-gov-27b-sys": ModelConfig('
assert anchor in src, "anchor missing; refusing to guess an insertion point"
add = ""
for key, model, disp, fc in [
    ("arch-gov-27b-v34",    "arch-gov-27b-v34", "Arch-Gov-27B v3.4 (Prompt, WITH system prompt)", False),
    ("arch-gov-27b-v34-FC", "arch-gov-27b-v34", "Arch-Gov-27B v3.4 (FC, WITH system prompt)",     True),
]:
    if '"%s"' % key in src:
        print("  already registered: %s" % key); continue
    add += '''    "%s": ModelConfig(
        model_name="%s",
        display_name="%s",
        url="local://arch-gov-27b-v34",
        org="local",
        license="apache-2.0",
        model_handler=ArchLocalHandler,
        input_price=None,
        output_price=None,
        is_fc_model=%s,
        underscore_to_dot=False,
    ),
''' % (key, model, disp, fc)
    print("  registering: %s" % key)
if add:
    io.open(p, "w", encoding="utf-8").write(src.replace(anchor, add + anchor, 1))
PYEOF

wait_clear () {
  while [ "$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)" -gt 0 ]; do sleep 60; done
}
unload () {
  for m in $(curl -s http://172.30.144.1:11434/api/ps | python3 -c 'import sys,json;[print(x["name"]) for x in (json.load(sys.stdin).get("models") or [])]' 2>/dev/null); do
    curl -s http://172.30.144.1:11434/api/generate -d "{\"model\":\"$m\",\"keep_alive\":0}" -o /dev/null
  done
}

lane () {
  local model="$1" cat="$2"
  echo
  echo "===== $model :: $cat :: $(date -Is) ====="
  wait_clear
  $BFCL generate --model "$model" --test-category "$cat" \
      --skip-server-setup --num-threads 4 --result-dir "$RES"
  echo "  generate rc=$?"
  ( $BFCL evaluate --model "$model" --test-category "$cat" \
      --result-dir "$RES" --score-dir "$SCORE" 2>&1 | grep -E "Accuracy|Error" ) || true
}

# v3.4, both modes — the numbers directly comparable to v3.3's 51.00 / 67.00
lane arch-gov-27b-v34-FC web_search_base
lane arch-gov-27b-v34    web_search_base

# The controls, so nothing above is uncontrolled (§4.6)
echo
echo "=== base controls ==="
wait_clear; bash /mnt/c/Users/marka/run-base-control.sh || echo "  base-prompt rc=$?"
wait_clear; bash /mnt/c/Users/marka/run-base-fc.sh      || echo "  base-fc rc=$?"

echo
echo "=== THE MATRIX ==="
cat "$SCORE/data_agentic.csv" 2>/dev/null
echo
echo "=== search spend ==="
python3 - <<'PY'
import io, json, os
p="/root/bfclproj/search-calls.jsonl"
if os.path.exists(p):
    rs=[json.loads(l) for l in io.open(p,encoding='utf-8') if l.strip()]
    if rs:
        x=rs[-1]; print("  calls=%d empty=%d (%.1f%%)  approx $%.2f" % (x['calls'],x['empty'],100.0*x['empty']/max(x['calls'],1),x['calls']*5.0/1000))
PY
echo "######## EVAL v3.4 DONE $(date -Is) ########"
