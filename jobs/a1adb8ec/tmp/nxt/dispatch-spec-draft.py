#!/usr/bin/env python
"""
Dispatch the pipeline-spec drafting to the teachers. Conductor judges; teachers write.

WHY: operator, 2026-08-04 — "have they do as much as we can to keep your usage down?" and the
standing architecture ruling: the other architects exist to keep the main architect's usage
down. Today's corpus work was teacher-heavy (1804 classifications, 1799 adversarial verdicts,
~790 generated rows — all Ollama cloud). The authoring was not. This moves drafting to them.

THE MISSION (muezzin shape): both teachers independently draft the tune-pipeline spec from the
same brief — the stage list, the gates that exist, and the day's paid-for lessons. Blind to
each other. The conductor merges, audits against receipts, and wires. Their drafts are raw
material, never shipped verbatim.
"""

import io, json, os, sys, time, urllib.request

OLLAMA = "http://172.30.144.1:11434"
OUT = "/mnt/c/Users/marka/cq-v34/phase4/spec-drafts"

BRIEF = """You are drafting an operations spec: TUNE-PIPELINE — how a governed fine-tune run
is executed end to end by a SIMPLE executor (a local model or junior operator) under a
conductor. The executor inherits CONDITIONS, not judgment: every stage must say what to run,
what must be true before, what must be true after, and what the refusal message means.

THE STAGES AND THEIR EXISTING TOOLS (all real, all on disk):
 1 mine substrate -> triples + specimens (mine-triples.py, mine-directives.py; provenance required)
 2 teacher classify + adversarial verify (classify-triples.py, adversarial-pass.py; two blind
   teachers; a labeller that always agrees is re-tasked as a refuter)
 3 build corpus (merge-v34.py; target-by-recovery rule; anti-template check; dict tool args)
 4 declare holdout BY SESSION before training (declare-holdout.py; row-level splits leak via
   chained conversations)
 5 verify serving BEFORE training (corpus_render.py self-tests; template probe against the
   real tokenizer; control-gate.py refuses unpaired benchmark lanes)
 6 dry-run then train (train_student_generic.py --dry-run; verifies target_modules against the
   loaded model; artifacts to the big disk, never the OS disk)
 7 export gguf (export script with trap guards: shard count, timestamp skew, size floors,
   CHAT TEMPLATE PRESENT or refuse)
 8 create + verify served tags (system-prompt byte count and template length via /api/show;
   an HTTP 200 create is not proof - the tag must be shown to exist)
 9 evaluate: holdout first (cheap, no quota), then benchmark lanes AS PAIRS with controls
10 record: every score with its serving condition; interim numbers labelled with n

THE PAID-FOR LESSONS (each one cost real time in the last 48h; encode as conditions):
- an instrument's output is a claim about the instrument until tested on a known case
- no measurement without its control named in the same act
- a silent empty (search returning {}, args dropped by a template) is worse than a crash
- waits are work time: verify preconditions DURING the wait, not after the failure
- when substrate layers conflict, prefer the one carrying a receipt
- a keepalive process inside a VM cannot hold the VM open
- refusal messages must name their own fix

FORMAT: markdown. Per stage: PRECONDITIONS / ACTION (exact command) / VERIFICATION (exact
check + expected output) / REFUSALS (message -> meaning -> fix). Terse. No preamble. An
executor should be able to run the whole pipeline knowing nothing but this document."""


def call(model, prompt, timeout=600):
    body = {"model": model, "think": False,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False, "options": {"num_predict": 8000, "temperature": 0.4}}
    req = urllib.request.Request(OLLAMA + "/api/chat", data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    d = json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "replace"))
    m = d.get("message") or {}
    return (m.get("content") or "").strip()


def main():
    os.makedirs(OUT, exist_ok=True)
    for model, tag in (("kimi-k2.6:cloud", "kimi"), ("glm-5.2:cloud", "glm")):
        t0 = time.time()
        print("dispatching %s ..." % model, flush=True)
        try:
            text = call(model, BRIEF)
        except Exception as e:
            print("  FAILED %s: %s" % (model, str(e)[:120]))
            continue
        p = os.path.join(OUT, "TUNE-PIPELINE-draft-%s.md" % tag)
        io.open(p, "w", encoding="utf-8").write(text)
        print("  %s: %d chars in %.0fs -> %s" % (tag, len(text), time.time() - t0, p))
    return 0


if __name__ == "__main__":
    sys.exit(main())
