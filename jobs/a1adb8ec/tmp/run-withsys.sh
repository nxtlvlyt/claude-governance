#!/usr/bin/env bash
# Isolate trap 18 from real capability loss.
#
# THE FINDING THIS TESTS
# arch-gov-27b-v33-bare serves with a 0-char system block. All 360 training rows carried a
# 4340-char system prompt. 60.1% of the tuned model's benchmark turn-responses are EMPTY
# strings, while the non-empty ones are correctly formatted BFCL calls ([ls()], [cd(...)]).
# So "0.00% on multi_turn" may measure a serving mismatch, not lost capability.
#
# THE DECISIVE COMPARISON
#   tuned BARE        (have it)  0.00% on the 11 matched IDs, 4.00% over 200
#   tuned WITH SYSTEM (this run) - the missing cell
#   untuned control   (partial)  36.36% on those same 11
# If with-system recovers, the defect is serving. If it does not, the tune really did cost
# multi-turn ability and v3.4 must address it directly.
#
# WHY THE CONTROL RUN IS BEING STOPPED FOR THIS
# The control needs ~20 more hours and only adds precision to a directional answer already in
# hand. This run costs ~2h at the tuned model's measured ~33s/entry. Sequencing decisions are
# the conductor's call, not the operator's (operator-rulings: only identity-bound items are
# ever "on the operator").
set -uo pipefail

MC=/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py
RES=/root/bfclproj/result
SCORE=/root/bfclproj/score

echo "=== 1. stop the control generation cleanly ==="
# Kill the launcher first so it does not advance to the next serial stage, then the worker.
pkill -f 'bash /mnt/c/Users/marka/run-multiturn-serial.sh' 2>/dev/null && echo "  launcher stopped" || echo "  launcher not running"
sleep 2
pkill -f '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' 2>/dev/null && echo "  generate stopped" || echo "  generate not running"
sleep 3
echo -n "  remaining generate procs: "
ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true
echo "  control rows banked (kept, never deleted): $(wc -l < $RES/qwen3.6-27b-base/multi_turn/BFCL_v4_multi_turn_base_result.json 2>/dev/null || echo 0)"

echo
echo "=== 2. register the WITH-SYSTEM tag if absent ==="
if grep -q '"arch-gov-27b-sys"' "$MC"; then
  echo "  already registered"
else
  cp "$MC" "$MC.bak-withsys-20260803"
  python3 - "$MC" <<'PY'
import io, re, sys
p = sys.argv[1]
src = io.open(p, encoding="utf-8").read()
anchor = '    "arch-gov-27b": ModelConfig('
assert anchor in src, "anchor entry not found; refusing to guess an insertion point"
entry = '''    "arch-gov-27b-sys": ModelConfig(
        model_name="arch-gov-27b-v33-sys",
        display_name="Arch-Gov-27B v3.3 (Prompt, WITH trained system prompt)",
        url="local://arch-gov-27b-v33",
        org="local",
        license="apache-2.0",
        model_handler=ArchLocalHandler,
        input_price=None,
        output_price=None,
        is_fc_model=False,
        underscore_to_dot=False,
    ),
'''
src = src.replace(anchor, entry + anchor, 1)
io.open(p, "w", encoding="utf-8").write(src)
print("  registered arch-gov-27b-sys")
PY
fi

echo
echo "=== 3. point the handler's model id at the WITH-SYSTEM ollama tag ==="
# The handler sends model_name to Ollama. arch-gov-27b-v33 is the tag carrying the 4371-char
# SYSTEM block; arch-gov-27b-v33-sys does not exist as a tag, so alias it.
if curl -s http://172.30.144.1:11434/api/tags | grep -q 'arch-gov-27b-v33-sys'; then
  echo "  tag arch-gov-27b-v33-sys already exists"
else
  echo "  creating tag arch-gov-27b-v33-sys -> copy of arch-gov-27b-v33"
  curl -s http://172.30.144.1:11434/api/copy \
    -d '{"source":"arch-gov-27b-v33","destination":"arch-gov-27b-v33-sys"}' -o /dev/null -w "  http %{http_code}\n"
fi
echo -n "  verify system block on the new tag: "
curl -s http://172.30.144.1:11434/api/show -d '{"model":"arch-gov-27b-v33-sys"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("%d chars" % len(d.get("system") or ""))'

echo
echo "=== 4. generate multi_turn_base WITH the system prompt ==="
cd /root/bfclproj
/root/bfclenv/bin/bfcl generate --model arch-gov-27b-sys --test-category multi_turn_base \
    --skip-server-setup --num-threads 4 --result-dir "$RES"
echo "generate rc=$?"
echo -n "  rows: "; wc -l < "$RES/arch-gov-27b-sys/multi_turn/BFCL_v4_multi_turn_base_result.json" 2>/dev/null || echo 0

echo
echo "=== 5. score it ==="
/root/bfclenv/bin/bfcl evaluate --model arch-gov-27b-sys --test-category multi_turn_base \
    --result-dir "$RES" --score-dir "$SCORE" 2>&1 | grep -E "Accuracy|Test completed|Error"

echo
echo "=== 6. empty-response rate, the mechanism under test ==="
python3 - <<'PY'
import io, json
for name, path in [
    ("BARE     ", "/root/bfclproj/result/arch-gov-27b/multi_turn/BFCL_v4_multi_turn_base_result.json"),
    ("WITH SYS ", "/root/bfclproj/result/arch-gov-27b-sys/multi_turn/BFCL_v4_multi_turn_base_result.json"),
]:
    empty = nonempty = 0
    try:
        for line in io.open(path, encoding="utf-8"):
            line = line.strip()
            if not line: continue
            res = json.loads(line).get("result")
            if not isinstance(res, list): continue
            for turn in res:
                for s in (turn if isinstance(turn, list) else [turn]):
                    if isinstance(s, str):
                        (nonempty := nonempty + 1) if s.strip() else (empty := empty + 1)
    except Exception as e:
        print("  %s unreadable: %s" % (name, e)); continue
    tot = empty + nonempty
    print("  %s empty %d/%d (%.1f%%)" % (name, empty, tot, 100.0*empty/max(tot,1)))
PY

echo
echo "=== FINAL TABLE ==="
date
cat "$SCORE/data_multi_turn.csv"
