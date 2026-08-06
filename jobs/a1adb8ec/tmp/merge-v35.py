# merge-v35.py — standalone re-run of train_student_generic.py's merge step (lines 268-270),
# which silently wrote an empty dir under HF_HUB_OFFLINE=1 (saving_utils wanted a hub lookup;
# warned "Model unsloth/Qwen3.6-27B not found" and saved nothing). Network ON for this run.
# Loads base exactly as the trainer did (from_pretrained lines 188-190), applies the final
# checkpoint-720 adapter, saves merged 16-bit to the same dir the pipeline expects.
import json, os, sys

PROFILE = "/mnt/c/Users/marka/cq-v34/model-profiles/arch-gov-27b-v35.json"
CKPT = "/mnt/d/conductor-qwen-run/ckpt-arch-gov-27b-v35/checkpoint-720"
MERGED = "/mnt/d/conductor-qwen-run/models/arch-gov-27b-v35-merged"

t = json.load(open(PROFILE))["training"]

from unsloth import FastLanguageModel
model = None
for cand in t["base_candidates"]:
    try:
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=cand, max_seq_length=t["max_seq_length"],
            load_in_4bit=t["load_in_4bit"], dtype=None)
        print("[merge] base loaded:", cand, flush=True)
        break
    except Exception as e:
        print("[merge] candidate failed:", cand, str(e)[:150], flush=True)
if model is None:
    sys.exit("no base candidate loaded")

from peft import PeftModel
model = PeftModel.from_pretrained(model, CKPT)
print("[merge] adapter applied from", CKPT, flush=True)

os.makedirs(MERGED, exist_ok=True)
model.save_pretrained_merged(MERGED, tokenizer, save_method="merged_16bit")
print("[merge] saved to", MERGED, flush=True)

import glob
files = sorted(glob.glob(MERGED + "/*"))
total = sum(os.path.getsize(f) for f in files if os.path.isfile(f))
print("[merge] %d files, %.1f GB" % (len(files), total / 1e9), flush=True)
if total < 10e9:
    sys.exit("MERGE-VERIFY-FAIL: dir under 10GB — not a real 27B 16-bit merge")
print("MERGE-OK", flush=True)
