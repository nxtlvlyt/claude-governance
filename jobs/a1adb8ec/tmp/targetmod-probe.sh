#!/usr/bin/env bash
# Do the declared target_modules actually exist in Qwen3.6-27B?
#
# train_student_generic.py refuses to train on a mismatch — but that check runs AFTER the model
# is loaded onto the GPU, which is the expensive place to discover a typo. The parameter names
# are in the cached safetensors index, readable from disk with no GPU and no weights.
#
# Why it matters beyond a typo: peft attaches adapters to modules whose names MATCH. A name
# that matches nothing is not an error there — training completes, loss falls, a model is
# produced, and it has trained on fewer projections than intended. Silent under-training, the
# same family as the tool-argument defect found minutes ago.
#
# The profile declares the qwen/llama set:
#   q_proj k_proj v_proj o_proj gate_proj up_proj down_proj
set -uo pipefail
PY=/root/cq-venv/bin/python3
export HF_HOME=/root/.cache/huggingface

"$PY" - <<'PYEOF'
import glob, json, os, re
from collections import Counter

root = "/root/.cache/huggingface/hub"
cands = glob.glob(os.path.join(root, "models--unsloth--Qwen3.6-27B*"))
print("cached model dirs:")
for c in cands:
    print("  " + c)
if not cands:
    print("  NONE — cannot verify without a download"); raise SystemExit(3)

idx = []
for c in cands:
    idx += glob.glob(os.path.join(c, "snapshots", "*", "*.safetensors.index.json"))
    idx += glob.glob(os.path.join(c, "snapshots", "*", "config.json"))
print("\nindex/config files found: %d" % len(idx))

names = set()
for f in idx:
    if not f.endswith("index.json"):
        continue
    try:
        d = json.load(open(f, encoding="utf-8"))
    except Exception:
        continue
    for k in (d.get("weight_map") or {}):
        leaf = k.split(".")[-2] if k.endswith(".weight") or k.endswith(".bias") else k.split(".")[-1]
        names.add(leaf)

DECLARED = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
if not names:
    print("  no weight index cached — checking config.json for the architecture instead")
    for f in idx:
        if f.endswith("config.json"):
            d = json.load(open(f, encoding="utf-8"))
            print("  architectures:", d.get("architectures"))
            print("  model_type   :", d.get("model_type"))
            print("  hidden/inter :", d.get("hidden_size"), d.get("intermediate_size"))
            break
    print("\n  VERDICT: cannot confirm module names from cache; the dry-run's own check covers it.")
    raise SystemExit(0)

print("\nprojection-like modules present in the weights:")
for n in sorted(x for x in names if "proj" in x or "fc" in x):
    print("  " + n)

print("\nDECLARED vs PRESENT")
missing = [m for m in DECLARED if m not in names]
for m in DECLARED:
    print("  %-12s %s" % (m, "OK" if m in names else "** ABSENT **"))
print("\n  VERDICT: %s" % ("all declared target_modules exist"
                           if not missing else "MISSING: %s — training would silently under-attach" % missing))
PYEOF
