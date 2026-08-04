#!/usr/bin/env bash
# Where does the training environment actually live? The v1 run trained a 27B successfully on
# this box, so torch/unsloth exist somewhere — just not in /usr/bin/python3, which is what the
# overnight chain calls.
set -uo pipefail
echo "=== candidate venvs ==="
for d in /root/*env* /root/venv* /opt/*env* /mnt/d/*env* /mnt/d/conductor-qwen/*env* /root/.venv*; do
  [ -d "$d" ] && echo "  $d"
done

echo
echo "=== which pythons exist, and which has torch? ==="
for py in /usr/bin/python3 $(ls -d /root/*env*/bin/python3 /mnt/d/*env*/bin/python3 /root/.venv*/bin/python3 2>/dev/null); do
  [ -x "$py" ] || continue
  printf "  %-46s " "$py"
  "$py" -c 'import torch,sys; print("torch", torch.__version__, "cuda", torch.cuda.is_available())' 2>/dev/null \
    || echo "no torch"
done

echo
echo "=== what did the v1 run use? (its scripts name the interpreter) ==="
for f in /mnt/c/Users/marka/conductor-qwen/nxtbeast/wsl-run.sh /mnt/c/Users/marka/conductor-qwen/nxtbeast/wsl-run-v11.sh; do
  [ -f "$f" ] && { echo "  --- ${f##*/} ---"; grep -nE 'python|venv|activate|source' "$f" | head -8 | sed 's/^/    /'; }
done

echo
echo "=== does nxtbeast have the conductor-qwen tree at all? ==="
ls -d /mnt/c/Users/marka/conductor-qwen 2>/dev/null && ls /mnt/c/Users/marka/conductor-qwen | head -12
echo "  phase4 present?"; ls /mnt/c/Users/marka/conductor-qwen/phase4 2>/dev/null | head -8 || echo "    no phase4"
