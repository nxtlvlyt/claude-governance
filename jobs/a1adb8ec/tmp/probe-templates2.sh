#!/usr/bin/env bash
# System-prompt support per base family - CORRECTED PROBE.
#
# v1 of this probe read /api/show's `template` field and got 13 characters for EVERY model,
# including qwen3.6:27b - a model we know honours system prompts, because the entire v3.3
# tune depends on it. 13 chars is "{{ .Prompt }}", Ollama's placeholder for a model whose
# real chat template lives in GGUF metadata rather than in a Modelfile TEMPLATE block.
#
# Had that output been reported, it would have produced the claim "Gemma has no system role"
# from an instrument that returns the same answer for every model on the box. That is the
# same failure this session has already made with a disposition scorer, a situation
# extractor, a pushback regex, and a JSON matcher: measure with a broken instrument, then
# report the result as a property of the thing being measured.
#
# So this version reads model_info["tokenizer.chat_template"] via verbose show - the actual
# Jinja template baked into the GGUF - and greps it for system-role handling.
# /api/show does not load weights, so this remains safe while the big lane is busy.
set -uo pipefail
OLLAMA=http://172.30.144.1:11434

for M in gemma4:31b gemma4:12b-it-q8_0 laguna-xs-2.1:q8_0 laguna-s-2.1:latest qwen3.6:27b qwen3.5:9b; do
  echo "==================== $M ===================="
  python3 - "$OLLAMA" "$M" <<'PY'
import json, re, sys, urllib.request
base, model = sys.argv[1], sys.argv[2]
req = urllib.request.Request(
    base + "/api/show",
    data=json.dumps({"model": model, "verbose": True}).encode(),
    headers={"Content-Type": "application/json"})
try:
    d = json.loads(urllib.request.urlopen(req, timeout=180).read())
except Exception as e:
    print("  SHOW FAILED:", type(e).__name__, str(e)[:160]); raise SystemExit

det = d.get("details") or {}
info = d.get("model_info") or {}
print("  family=%s params=%s quant=%s" % (det.get("family"), det.get("parameter_size"),
                                          det.get("quantization_level")))

tpl = ""
for k, v in info.items():
    if "chat_template" in k and isinstance(v, str):
        tpl = v
        print("  template key: %s (%d chars)" % (k, len(v)))
        break
if not tpl:
    tpl = d.get("template") or ""
    print("  NOTE: no tokenizer.chat_template in model_info; falling back to Modelfile "
          "template (%d chars)" % len(tpl))
    keys = [k for k in info if "token" in k.lower() or "template" in k.lower()]
    print("  model_info keys mentioning token/template:", keys[:10])

if not tpl:
    print("  VERDICT: cannot determine - no template available from this endpoint")
    raise SystemExit

low = tpl.lower()
has_sys = "system" in low
print("  mentions 'system' : %s" % ("YES" if has_sys else "NO"))
if has_sys:
    hits = [l.strip() for l in tpl.splitlines() if "system" in l.lower()]
    for h in hits[:5]:
        print("    |", h[:150])
    # The distinction that matters: a real system TURN vs folding it into the user turn.
    folded = bool(re.search(r"system[^\n]{0,80}(first|user|prepend|\+)", low))
    print("  VERDICT: system role present%s"
          % (" BUT appears to be FOLDED into the user turn - inspect above" if folded else ""))
else:
    print("  VERDICT: NO system role in the baked template -> a SYSTEM block in the "
          "Modelfile may be silently dropped at serve time")
PY
  echo
done
