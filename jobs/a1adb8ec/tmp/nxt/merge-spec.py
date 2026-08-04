#!/usr/bin/env python3
"""Round 2: kimi merges both drafts against GROUND TRUTH (the real invocations).

Round 1 drafts invented CLI flags — expected, they drafted blind. The conductor supplies the
real commands; the teacher does the writing; the conductor audits the merge. Usage stays on
the cloud seats per the operator's standing instruction.
"""
import io, json, urllib.request

OLLAMA = "http://172.30.144.1:11434"
D = "/mnt/c/Users/marka/cq-v34/phase4/spec-drafts"

GROUND_TRUTH = """REAL INVOCATIONS AND FACTS — every ACTION line in the final spec must use
ONLY these (no invented flags). Where a draft's flag does not exist, either use the real
invocation or mark the step [SCRIPT-GAP: flag to add]. All paths relative to the repo root
(conductor-qwen/) unless absolute.

1 MINE:      python phase4/mine-triples.py            (no flags; paths hardcoded in-file)
             python phase4/mine-directives.py         (prints scope + specimen counts)
2 CLASSIFY:  python phase4/classify-triples.py --workers 5 [--limit N for smoke test]
             python phase4/adversarial-pass.py --workers 5
             FACT: a labeller agreeing >95% is re-tasked as a REFUTER (adversarial framing),
             not dropped. Smoke test with --limit 12 BEFORE any full pass.
3 BUILD:     python phase4/merge-v34.py               (reads typeA/typeB/directive files;
             tool_calls arguments MUST be dicts — a JSON string renders as an argument-less
             call and trains a wrong reflex)
4 HOLDOUT:   python phase4/declare-holdout.py         (session-level hash; seed printed in
             V34-HOLDOUT.md; leak-check target text against train text, expect 0)
5 VERIFY:    python corpus_render.py --selftest       (18 checks)
             python phase4/control-gate.py --audit    (refuses unpaired benchmark lanes;
             exit 2 = refusal)
             template probe: render one tool row through the REAL tokenizer and confirm
             <parameter=...> blocks appear inside <tool_call>
6 TRAIN:     python nxtbeast/train_student_generic.py --profile <profile.json> --corpus <train.jsonl> --dry-run
             then same without --dry-run. FACTS: CQ_RUN_DIR must point at the big disk;
             HF_HOME at the model cache; the dry-run loads the model and verifies
             target_modules against the architecture; 9B profiles are refused by ruling.
             LAUNCH: Windows scheduled task as logged-on user (/ru <user> /it) driving
             wsl bash — setsid died 6x, held ssh dies with the local task, SYSTEM is
             refused by WSL.
7 EXPORT:    bash pipeline/export-v34.sh              (guards: >=15 shards, config/shard
             timestamp skew, size floors, CHAT TEMPLATE PRESENT or exit 3)
             If the converter dropped the template (transformers >=5.5 writes
             chat_template.jinja separately): bash pipeline/fix-template.sh
             (gguf_new_metadata.py re-embed, verify via GGUFReader)
8 TAGS:      ollama create <tag> -f <Modelfile>       (WINDOWS-side; /api/create returned
             HTTP 400 and a chain sailed past it)
             VERIFY: /api/show — system prompt byte-count matches corpus, template ~8k chars.
             An HTTP 200 on create is NOT proof the tag exists.
9 EVAL:      python phase4/holdout-eval.py            (holdout FIRST: cheap, no quota;
             model-major loop — never alternate models per row, that swaps 17GB per row)
             then BFCL lanes AS PAIRS with controls (control-gate.py refuses otherwise);
             search preflight must return >200 chars or the lane is measuring a void
10 RECORD:   every score carries tag + system y/n + search-live y/n + n; interim numbers
             labelled with their n (one walked 72->58->51 as n grew)."""

kimi = io.open(D + "/TUNE-PIPELINE-draft-kimi.md", encoding="utf-8").read()
glm = io.open(D + "/TUNE-PIPELINE-draft-glm.md", encoding="utf-8").read()

PROMPT = ("Merge these two drafts of an ops spec into ONE final document. Keep draft A's "
          "structure (PRECONDITIONS/ACTION/VERIFICATION/REFUSALS-table-with-fix) and draft "
          "B's terseness. Replace EVERY invented command/flag with the real invocations from "
          "GROUND TRUTH below — this is the only authority on commands. Keep the refusal "
          "tables but make each message one that the real scripts actually emit or that the "
          "ground truth names. Mark genuinely missing script features as [SCRIPT-GAP: ...]. "
          "Output ONLY the final markdown.\n\n=== GROUND TRUTH ===\n" + GROUND_TRUTH +
          "\n\n=== DRAFT A (kimi) ===\n" + kimi + "\n\n=== DRAFT B (glm) ===\n" + glm)

body = {"model": "kimi-k2.6:cloud", "think": False,
        "messages": [{"role": "user", "content": PROMPT}],
        "stream": False, "options": {"num_predict": 12000, "temperature": 0.3}}
req = urllib.request.Request(OLLAMA + "/api/chat", data=json.dumps(body).encode("utf-8"),
                             headers={"Content-Type": "application/json"})
d = json.loads(urllib.request.urlopen(req, timeout=900).read().decode("utf-8", "replace"))
text = ((d.get("message") or {}).get("content") or "").strip()
io.open(D + "/TUNE-PIPELINE-merged.md", "w", encoding="utf-8").write(text)
print("merged: %d chars -> TUNE-PIPELINE-merged.md" % len(text))
