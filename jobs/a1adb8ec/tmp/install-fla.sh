#!/usr/bin/env bash
# Install the fast linear-attention kernels the qwen3.5/3.6 arch wants (fixes the slow-mask grind).
set -uo pipefail
P=/root/cq-venv/bin/pip
echo "=== flash-linear-attention (triton, pure pip) ==="
"$P" install --quiet flash-linear-attention 2>&1 | tail -2
echo "=== causal-conv1d (may need CUDA build) ==="
"$P" install --quiet causal-conv1d 2>&1 | tail -3
echo "=== verify imports ==="
/root/cq-venv/bin/python3 -c "import fla; print('fla OK', fla.__version__ if hasattr(fla,'__version__') else '')" 2>&1
/root/cq-venv/bin/python3 -c "import causal_conv1d; print('causal_conv1d OK')" 2>&1
exit 0
