#!/usr/bin/env bash
# All env flags unsloth/unsloth_zoo read for compile behavior + torch inductor worker knobs.
set -uo pipefail
echo "--- unsloth_zoo compiler.py env reads ---"
grep -n 'environ' /root/cq-venv/lib/python3.12/site-packages/unsloth_zoo/compiler.py 2>/dev/null | head -15
echo "--- all UNSLOTH_ env flags across unsloth packages ---"
grep -rhoE 'UNSLOTH_[A-Z_]+' /root/cq-venv/lib/python3.12/site-packages/unsloth/models/_utils.py /root/cq-venv/lib/python3.12/site-packages/unsloth_zoo/*.py 2>/dev/null | sort | uniq -c | sort -rn | head -20
echo "--- inductor compile_threads knob ---"
grep -n 'compile_threads\|TORCHINDUCTOR_COMPILE_THREADS' /root/cq-venv/lib/python3.12/site-packages/torch/_inductor/config.py 2>/dev/null | head -6
exit 0
