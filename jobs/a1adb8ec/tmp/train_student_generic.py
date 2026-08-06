#!/usr/bin/env python3
"""
Train one student from a MODEL PROFILE. Family-agnostic; idempotent.

WHY THIS REPLACES train_student.py / train_student_v11.py
---------------------------------------------------------
Those two are near-duplicates with `--student a|b` selecting between two hardcoded students.
Everything that differs between base-model FAMILIES is baked into the source:

    line 22-30  candidate HF repo ids, per student
    line 25/30  max_seq_length = 2048
    line 58     r=16, lora_alpha, dropout
    line 59     target_modules=[q_proj,k_proj,v_proj,o_proj,gate_proj,up_proj,down_proj]
    line 64     tokenizer.apply_chat_template(ex["messages"], ...)
    line 72-76  batch/accum/epochs/lr/optim/bf16

Operator, 2026-08-03: "is our process being updated so we can apply this tune to other models
qwen 3.8 is coming next week" and "what about when we do Laguna or Gemma 4".

Two of those hardcodes are not merely inconvenient on a family swap - they are SILENT:

  target_modules  Module names are architecture-specific. Passing a name the architecture does
                  not have can attach zero adapters to that projection. Training then completes,
                  reports a falling loss, produces a merged model - and has trained less than
                  intended. Nothing errors. So this script REFUSES to guess: the profile must
                  declare them, and every declared name is VERIFIED to exist in the loaded model
                  before a single step runs.

  apply_chat_template  Every corpus row here carries a `system` message. Gemma has no system
                  role (vendor-confirmed, ai.google.dev/gemma/docs/core/prompt-structure:
                  "the system role or a system turn is not supported"). Depending on template
                  version that line raises, or silently drops the governance prompt that is the
                  entire point of the tune. So rendering goes through corpus_render.py, which is
                  unit-tested (18 checks) and validates every row.

THE 9B STUDENT IS DELIBERATELY ABSENT.
Operator ruling, recorded in ~/.claude/rules/operator-rulings.md 2026-08-01: "why are you still
messing with 9b, the last instance wasted a whole day with this model and I told them to stop 4
times and they never listened." No training run, corpus build, or eval lane may target the 9B.
It is omitted here rather than left available-but-discouraged, because a `--student b` flag is an
invitation and the ruling exists precisely because the reasoning for using it is seductive
("cheaper, faster, validates the pipeline"). A fresh instance re-derives that argument on its own;
removing the option is the only thing that survives instance rotation.

Usage:
  python3 train_student_generic.py --profile /path/to/profile.json [--dry-run]

--dry-run does everything except trainer.train(): loads the profile, renders and validates the
corpus, loads the model, verifies target_modules exist, prints the plan. Run it before
committing hours of GPU. It is the cheapest possible way to catch a family mismatch.
"""

import argparse
import json
import os
import sys
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))          # for corpus_render
sys.path.insert(0, HERE)

RUN = os.environ.get("CQ_RUN_DIR", "/mnt/c/Users/marka/conductor-qwen-run")


def log(msg):
    line = time.strftime("%H:%M:%S ") + msg
    print(line, flush=True)
    try:
        os.makedirs(RUN, exist_ok=True)
        with open(os.path.join(RUN, "RUN.log"), "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


REQUIRED = ("tag", "base_family", "system_strategy", "training")
REQUIRED_TRAINING = ("base_candidates", "target_modules", "max_seq_length",
                     "lora_r", "lora_alpha", "load_in_4bit", "epochs",
                     "learning_rate", "batch_size", "grad_accum", "optim")


def load_profile(path):
    with open(path, encoding="utf-8") as fh:
        p = json.load(fh)
    miss = [k for k in REQUIRED if k not in p]
    if miss:
        sys.exit("profile missing: %s" % ", ".join(miss))
    t = p["training"]
    miss = [k for k in REQUIRED_TRAINING if k not in t]
    if miss:
        sys.exit(
            "profile.training missing: %s\n"
            "  Every one of these is family-specific. There are no defaults on purpose:\n"
            "  a default that is right for qwen and wrong for gemma fails silently."
            % ", ".join(miss))
    if not isinstance(t["target_modules"], list) or not t["target_modules"]:
        sys.exit("profile.training.target_modules must be a non-empty list")
    if "9b" in p["tag"].lower() or "9B" in str(t.get("base_candidates")):
        sys.exit("This profile targets a 9B student. Operator ruling 2026-08-01 forbids it. "
                 "See the module docstring.")
    return p


def verify_target_modules(model, declared):
    """Every declared target module must EXIST in the model.

    This is the check that turns a silent under-train into a loud stop. peft attaches adapters
    to modules whose names match; a name that matches nothing is not an error there, so a
    typo or a cross-family copy-paste yields a model trained on fewer projections than
    intended, with a perfectly normal-looking loss curve.
    """
    present = set()
    for name, _ in model.named_modules():
        leaf = name.split(".")[-1]
        if leaf:
            present.add(leaf)
    missing = [m for m in declared if m not in present]
    if missing:
        sample = sorted(x for x in present if "proj" in x or "fc" in x or "linear" in x)[:24]
        sys.exit(
            "TARGET MODULE MISMATCH - refusing to train.\n"
            "  declared but absent from this architecture: %s\n"
            "  projection-like modules that DO exist       : %s\n"
            "  Training would have completed with fewer adapters than intended and reported\n"
            "  a normal loss. Fix profile.training.target_modules against the list above."
            % (", ".join(missing), ", ".join(sample) or "(none found)"))
    return sorted(set(declared))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", required=True)
    ap.add_argument("--corpus", help="override profile.training.corpus_path")
    ap.add_argument("--dry-run", action="store_true",
                    help="do everything except the training step")
    a = ap.parse_args()

    p = load_profile(a.profile)
    t = p["training"]
    tag = p["tag"]
    strategy = p["system_strategy"]

    merged_dir = os.path.join(RUN, "models", tag + "-merged")
    if os.path.exists(os.path.join(merged_dir, "config.json")) and not a.dry_run:
        log("[%s] merged model already exists - skipping train" % tag)
        return 0

    corpus = a.corpus or t.get("corpus_path") or os.path.join(RUN, "train.jsonl")
    if not os.path.exists(corpus):
        sys.exit("corpus not found: %s" % corpus)

    # ---- render + validate the corpus BEFORE touching the GPU ------------------------
    from corpus_render import render_messages, validate, RenderError

    rows, bad = [], 0
    with open(corpus, encoding="utf-8") as fh:
        for i, line in enumerate(fh, 1):
            if not line.strip():
                continue
            row = json.loads(line)
            try:
                rendered = render_messages(row["messages"], strategy)
            except RenderError as e:
                log("[%s] row %d unrenderable: %s" % (tag, i, e))
                bad += 1
                continue
            probs = validate(row["messages"], rendered, strategy)
            if probs:
                log("[%s] row %d failed validation: %s" % (tag, i, probs[0]))
                bad += 1
                continue
            rows.append({"messages": rendered})
    if bad:
        sys.exit("%d of %d rows failed rendering under strategy=%s. Not training on a corpus "
                 "that is partly the wrong shape." % (bad, bad + len(rows), strategy))
    log("[%s] corpus: %d rows rendered clean under strategy=%s" % (tag, len(rows), strategy))

    from unsloth import FastLanguageModel
    from datasets import Dataset
    from trl import SFTTrainer, SFTConfig

    model = tokenizer = None
    for cand in t["base_candidates"]:
        try:
            log("[%s] trying base %s" % (tag, cand))
            model, tokenizer = FastLanguageModel.from_pretrained(
                model_name=cand, max_seq_length=t["max_seq_length"],
                load_in_4bit=t["load_in_4bit"], dtype=None)
            log("[%s] loaded %s" % (tag, cand))
            break
        except Exception as e:
            log("[%s] %s failed: %s: %s" % (tag, cand, e.__class__.__name__, str(e)[:200]))
    if model is None:
        sys.exit("[%s] FATAL: no candidate base model loaded" % tag)

    targets = verify_target_modules(model, t["target_modules"])
    log("[%s] target modules verified present: %s" % (tag, ", ".join(targets)))

    # The rendered corpus must survive the tokenizer's own template too. If the family has no
    # system role, this is where a NON-folded corpus would have blown up or silently lost text.
    probe = tokenizer.apply_chat_template(rows[0]["messages"], tokenize=False,
                                          add_generation_prompt=False)
    sys_seen = strategy == "system_role"
    log("[%s] chat-template probe: %d chars, strategy=%s" % (tag, len(probe), strategy))
    if not sys_seen:
        first_user = rows[0]["messages"][0]["content"]
        head = first_user[:120]
        if head not in probe:
            sys.exit("chat template did not carry the folded prompt into the rendered text - "
                     "the fold and the template disagree. Inspect before training.")
        log("[%s] folded prompt confirmed present in templated text" % tag)

    model = FastLanguageModel.get_peft_model(
        model, r=t["lora_r"], lora_alpha=t["lora_alpha"],
        lora_dropout=t.get("lora_dropout", 0), target_modules=targets,
        use_gradient_checkpointing=t.get("grad_checkpointing", "unsloth"),
        random_state=t.get("seed", 3407))

    ds = Dataset.from_list([{"text": tokenizer.apply_chat_template(
        r["messages"], tokenize=False, add_generation_prompt=False)} for r in rows])
    log("[%s] dataset rows: %d" % (tag, len(ds)))

    plan = {k: t[k] for k in REQUIRED_TRAINING if k != "base_candidates"}
    plan["corpus"] = corpus
    plan["strategy"] = strategy
    log("[%s] PLAN %s" % (tag, json.dumps(plan)))

    if a.dry_run:
        log("[%s] --dry-run: stopping before trainer.train()" % tag)
        return 0

    trainer = SFTTrainer(
        model=model, tokenizer=tokenizer, train_dataset=ds,
        args=SFTConfig(
            dataset_text_field="text", max_seq_length=t["max_seq_length"],
            per_device_train_batch_size=t["batch_size"],
            gradient_accumulation_steps=t["grad_accum"],
            num_train_epochs=t["epochs"], learning_rate=t["learning_rate"],
            lr_scheduler_type=t.get("lr_scheduler", "cosine"),
            warmup_ratio=t.get("warmup_ratio", 0.03), optim=t["optim"],
            logging_steps=t.get("logging_steps", 10),
            output_dir=os.path.join(RUN, "ckpt-" + tag),
            # step-based checkpoints (2026-08-06): "epoch" never fired on the 720-step v3.5
            # runs (no epoch boundary reached before any of 13 failures), so every relaunch
            # restarted from zero. 60 steps ~= 20 min at 19s/it; limit 2 bounds C: usage.
            save_strategy=t.get("save_strategy", "steps"),
            save_steps=t.get("save_steps", 60),
            save_total_limit=t.get("save_total_limit", 2),
            seed=t.get("seed", 3407),
            bf16=t.get("bf16", True), report_to="none"))
    log("[%s] training starts" % tag)
    t0 = time.time()
    # RESUME-FIRST (2026-08-06): if a checkpoint exists for this tag, continue from it
    # instead of from zero — the operator's "we got to 200/720, why can we not pick back
    # up there". Fresh runs are unaffected (no ckpt dir -> None -> from scratch).
    _ckpt_root = os.path.join(RUN, "ckpt-" + tag)
    _last_ckpt = None
    if os.path.isdir(_ckpt_root):
        _cks = [d for d in os.listdir(_ckpt_root) if d.startswith("checkpoint-") and d.split("-")[-1].isdigit()]
        if _cks:
            _last_ckpt = os.path.join(_ckpt_root, max(_cks, key=lambda d: int(d.split("-")[-1])))
            log("[%s] RESUMING from %s" % (tag, _last_ckpt))
    trainer.train(resume_from_checkpoint=_last_ckpt)
    log("[%s] training done in %.1f min" % (tag, (time.time() - t0) / 60))

    os.makedirs(merged_dir, exist_ok=True)
    model.save_pretrained_merged(merged_dir, tokenizer, save_method="merged_16bit")
    log("[%s] merged 16-bit saved to %s" % (tag, merged_dir))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception:
        log("FATAL: " + traceback.format_exc()[-800:])
        sys.exit(1)
