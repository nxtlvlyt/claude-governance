#!/bin/bash
echo "WSL_PY=$(python3 --version 2>&1)"
python3 -c "import numpy; print('NUMPY='+numpy.__version__)" 2>/dev/null || echo "NUMPY=absent"
echo "PIP=$(python3 -m pip --version 2>&1 | cut -c1-40)"
echo "VENVS=$(ls -d ~/venv* ~/.venv* 2>/dev/null | tr '\n' ' ')"
echo "TORCH=$(python3 -c 'import torch; print(torch.__version__)' 2>/dev/null || echo absent)"
