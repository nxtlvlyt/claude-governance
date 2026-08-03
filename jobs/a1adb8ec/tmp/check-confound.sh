#!/usr/bin/env bash
# Is the 36.36% vs 0.00% result a capability difference, or a generation-length artifact?
#
# The tuned model's registry display_name literally reads "num_predict=512". If the tuned
# model is truncated at 512 tokens and the control is not, then the comparison measures
# output budget, not multi-turn ability - and reporting "the tune destroyed multi-turn"
# would be a causal claim with an unchecked confound sitting in plain sight.
#
# Conductor law 5 (temporal coverage / grade it or refute it): a causal claim ships only
# behind a receipt or tagged as HYPOTHESIS. This is the receipt attempt.
set -uo pipefail
MC=/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py

echo "=== registry entries, full ==="
sed -n '1645,1690p' "$MC"

echo
echo "=== any num_predict / max_tokens in the handler or config ==="
grep -rn "num_predict\|max_tokens\|max_completion" \
  /root/bfclenv/lib/python3.12/site-packages/bfcl_eval/model_handler/api_inference/arch_local.py \
  /root/bfclenv/lib/python3.12/site-packages/bfcl_eval/model_handler/api_inference/openai_completion.py 2>/dev/null | head -20

echo
echo "=== what the two Ollama tags actually declare ==="
for M in arch-gov-27b-v33-bare qwen3.6:27b; do
  echo "--- $M ---"
  curl -s http://172.30.144.1:11434/api/show -d "{\"model\":\"$M\"}" | python3 -c '
import sys,json
d=json.load(sys.stdin)
p=d.get("parameters") or ""
print("  parameters block:", repr(p[:200]) if p else "(none)")
det=d.get("details") or {}
print("  family=%s params=%s" % (det.get("family"), det.get("parameter_size")))
'
done

echo
echo "=== empirical: how long are the actual responses in each result file? ==="
python3 - <<'PY'
import io, json, statistics
for name, path in [
    ("control (qwen3.6-27b-base)", "/root/bfclproj/result/qwen3.6-27b-base/multi_turn/BFCL_v4_multi_turn_base_result.json"),
    ("tuned   (arch-gov-27b)",     "/root/bfclproj/result/arch-gov-27b/multi_turn/BFCL_v4_multi_turn_base_result.json"),
]:
    lens, turns, ids = [], [], set()
    try:
        for line in io.open(path, encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            ids.add(r.get("id"))
            res = r.get("result")
            # result is a list of turns, each a list of steps
            if isinstance(res, list):
                turns.append(len(res))
                for t in res:
                    if isinstance(t, list):
                        for s in t:
                            if isinstance(s, str):
                                lens.append(len(s))
                    elif isinstance(t, str):
                        lens.append(len(t))
    except Exception as e:
        print("  %s: unreadable (%s)" % (name, e)); continue
    if lens:
        print("  %-28s rows=%-4d resp_chars: mean=%-7.0f median=%-7.0f max=%-7d  turns/entry mean=%.1f"
              % (name, len(ids), statistics.mean(lens), statistics.median(lens), max(lens),
                 statistics.mean(turns) if turns else 0))
        over = sum(1 for x in lens if x > 1800)   # ~512 tokens is roughly 1800-2000 chars
        print("      responses over ~1800 chars (approx 512 tokens): %d / %d (%.1f%%)"
              % (over, len(lens), 100.0*over/len(lens)))
    else:
        print("  %-28s no response strings parsed" % name)
PY
