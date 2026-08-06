# merge-v35.py (attempt 3) — export checkpoint-720 as a true merged 16-bit model.
# Attempt 1 (in-trainer): HF_HUB_OFFLINE=1 starved saving_utils -> empty dir.
# Attempt 2: vanilla peft.PeftModel wrap broke unsloth's dequant -> 18G quantized save
#   (v3.4's known-good merge is 52G). Receipt: unsloth issue #611 — the fix is loading
#   the CHECKPOINT DIR directly via FastLanguageModel.from_pretrained so unsloth's own
#   peft object does the merged_16bit dequant, identical to the trainer's in-memory path.
import os, sys, glob

CKPT = "/mnt/d/conductor-qwen-run/ckpt-arch-gov-27b-v35/checkpoint-720"
MERGED = "/mnt/d/conductor-qwen-run/models/arch-gov-27b-v35-merged"

from unsloth import FastLanguageModel
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=CKPT, max_seq_length=2048, load_in_4bit=True, dtype=None)
print("[merge] checkpoint loaded via unsloth native loader", flush=True)

os.makedirs(MERGED, exist_ok=True)
model.save_pretrained_merged(MERGED, tokenizer, save_method="merged_16bit")
print("[merge] saved to", MERGED, flush=True)

files = sorted(glob.glob(MERGED + "/*"))
total = sum(os.path.getsize(f) for f in files if os.path.isfile(f))
print("[merge] %d files, %.1f GB" % (len(files), total / 1e9), flush=True)
if total < 45e9:
    sys.exit("MERGE-VERIFY-FAIL: %.1f GB — v3.4's true 16-bit merge is 52G; this is not dequantized" % (total / 1e9))
print("MERGE-OK", flush=True)
