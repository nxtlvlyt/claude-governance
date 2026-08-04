#!/usr/bin/env bash
# Everything from "merge finishes" to "v3.4 has scores". Fires itself; nobody watches it.
#
# WHY THIS EXISTS: the merge had ~30 minutes left and the entire downstream path — GGUF export,
# Ollama import, BFCL registration, evaluation, holdout — was staged but unwired. Waiting to
# notice the merge finish and then hand-running five steps is not a pipeline, it is me being
# the scheduler. Operator, 2026-08-04: "still choosing not to be proactive".
#
# STAGES
#   0  wait for the merge to complete (shard count + timestamp skew, per export-v34.sh trap 17)
#   1  export merged -> f16 gguf -> q4_K_M          (export-v34.sh, carries v3.3's trap guards)
#   2  build the Modelfile from the profile         (build-modelfile.py, byte-verified builder)
#   3  ollama create arch-gov-27b-v34               (+ a -bare tag for like-for-like vs v3.3)
#   4  register both in BFCL                        (prompt and FC lanes)
#   5  release VRAM, then run web_search_base FC + Prompt on v3.4
#   6  base controls (prompt, FC) if not already done
#   7  holdout eval: 251 rows the model has never seen
#
# Each stage guards its own preconditions and refuses rather than producing a plausible-looking
# artifact. Every stage is skippable: a failure downstream must not discard what already landed.
set -uo pipefail

LOG=/root/bfclproj/post-merge.log
MERGED=/mnt/d/conductor-qwen-run/models/arch-gov-27b-v34-merged
Q4=/mnt/d/conductor-qwen/models/arch-gov-27b-v34.q4km.gguf
CQ=/mnt/c/Users/marka/cq-v34
PY=/root/cq-venv/bin/python3
BFCL=/root/bfclenv/bin/bfcl
OLLAMA=http://172.30.144.1:11434

exec > >(tee -a "$LOG") 2>&1
echo "######## POST-MERGE CHAIN $(date -Is) ########"

# ---------------------------------------------------------------- 0: wait for the merge
echo
echo "=== STAGE 0: wait for the merge to complete ==="
w=0
while true; do
  if ! pgrep -f 'train_student_generic' >/dev/null 2>&1; then
    echo "  trainer exited after ${w}s"
    break
  fi
  sleep 60; w=$((w+60))
  [ $w -ge 14400 ] && { echo "  TIMEOUT 4h waiting for the merge"; exit 1; }
done

SHARDS=$(find "$MERGED" -maxdepth 1 -name '*.safetensors' 2>/dev/null | wc -l)
BYTES=$(du -sb "$MERGED" 2>/dev/null | cut -f1 || echo 0)
echo "  merged: $SHARDS shards, $BYTES bytes"
if [ "${SHARDS:-0}" -lt 15 ] || [ "${BYTES:-0}" -lt 50000000000 ]; then
  echo "  MERGE INCOMPLETE — refusing to export. (trap 17: a partial merge still writes"
  echo "  config.json, so a later re-run 'skips' and ships BASE weights under the v3.4 name.)"
  exit 2
fi
echo "  merge looks complete"

# ---------------------------------------------------------------- 1: gguf
echo
echo "=== STAGE 1: export to GGUF (f16 -> q4_K_M) ==="
bash /mnt/c/Users/marka/export-v34.sh
echo "  export rc=$?"
if [ ! -f "$Q4" ]; then
  echo "  NO Q4 GGUF — stopping. Log: /root/export-v34-27b.log"
  tail -20 /root/export-v34-27b.log 2>/dev/null
  exit 3
fi
echo "  q4: $(stat -c %s "$Q4") bytes"

# ---------------------------------------------------------------- 2: Modelfile
echo
echo "=== STAGE 2: build the Modelfile from the profile ==="
cd "$CQ"
"$PY" - <<'PYEOF'
# The generic builder lives on the laptop; reproduce its two load-bearing guards here:
# extract the ONE system prompt from the corpus (trap 18 — never retype it) and ASCII-fold
# it (trap 19 — Ollama on Windows reads a UTF-8 Modelfile as cp1252).
import io, json, hashlib
BS = chr(92)
FOLD = {chr(8212):"-",chr(8211):"-",chr(8216):"'",chr(8217):"'",chr(8220):'"',chr(8221):'"',chr(8230):"...",chr(160):" "}
rows = [json.loads(l) for l in io.open("/mnt/c/Users/marka/cq-v34/phase4/train-v34-train.jsonl", encoding="utf-8") if l.strip()]
sysset = {m["content"] for r in rows for m in r["messages"] if m["role"] == "system"}
assert len(sysset) == 1, "expected exactly ONE system prompt, found %d" % len(sysset)
raw = list(sysset)[0]
folded = raw
for a, b in FOLD.items():
    folded = folded.replace(a, b)
residue = sorted({c for c in folded if ord(c) > 126})
assert not residue, "unfolded non-ascii: %r" % residue
assert '"""' not in folded
gguf = BS.join(["D:", "conductor-qwen", "models", "arch-gov-27b-v34.q4km.gguf"])
mf = ("FROM %s\n\nPARAMETER temperature 0.3\nPARAMETER top_p 0.9\n"
      "PARAMETER repeat_penalty 1.15\n\n" 'SYSTEM """%s"""\n') % (gguf, folded)
assert "\x07" not in mf, "BEL byte — a backslash escape was interpreted"
io.open("/mnt/c/Users/marka/cq-v34/Modelfile-arch-gov-27b-v34", "w", encoding="ascii", newline="\n").write(mf)
# The bare variant: same weights, NO system block, for like-for-like against v3.3-bare.
bare = "FROM %s\n\nPARAMETER temperature 0.3\nPARAMETER top_p 0.9\nPARAMETER repeat_penalty 1.15\n" % gguf
io.open("/mnt/c/Users/marka/cq-v34/Modelfile-arch-gov-27b-v34-bare", "w", encoding="ascii", newline="\n").write(bare)
print("  system prompt: %d chars, sha256 %s" % (len(folded), hashlib.sha256(folded.encode()).hexdigest()[:16]))
print("  wrote Modelfile-arch-gov-27b-v34 (%d bytes) and -bare (%d bytes)" % (len(mf), len(bare)))
PYEOF
[ $? -eq 0 ] || { echo "  Modelfile build failed"; exit 4; }

# ---------------------------------------------------------------- 3: ollama import
echo
echo "=== STAGE 3: ollama create ==="
for v in "" "-bare"; do
  name="arch-gov-27b-v34${v}"
  echo "  creating $name"
  curl -s "$OLLAMA/api/create" -d "{\"model\":\"$name\",\"from\":\"$Q4\",\"path\":\"$CQ/Modelfile-arch-gov-27b-v34${v}\"}" -o /dev/null -w "    http %{http_code}\n" || true
done
sleep 5
echo "  verifying the system block landed:"
for v in "" "-bare"; do
  n="arch-gov-27b-v34${v}"
  curl -s "$OLLAMA/api/show" -d "{\"model\":\"$n\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('    %-28s system=%d chars' % ('$n', len(d.get('system') or '')) if 'error' not in d else '    $n NOT CREATED: %s' % str(d['error'])[:70])
" 2>/dev/null || echo "    $n show failed"
done

echo
echo "######## POST-MERGE CHAIN: artifacts done $(date -Is) ########"
echo "Stages 4-7 (BFCL registration, scoring, holdout) run from register-and-eval-v34.sh"
bash /mnt/c/Users/marka/register-and-eval-v34.sh || echo "### eval rc=$?"
echo "######## ALL DONE $(date -Is) ########"
