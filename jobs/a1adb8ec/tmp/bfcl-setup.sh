#!/bin/bash
set -o pipefail
echo "PY=$(python3 --version 2>&1)"
if ! python3 -m pip --version >/dev/null 2>&1; then
  echo "PIP=absent, bootstrapping via ensurepip"
  python3 -m ensurepip --upgrade 2>&1 | tail -2
fi
python3 -m pip --version 2>&1 | head -1
echo "--- venv for bfcl (keeps system python clean) ---"
python3 -m venv ~/bfclenv 2>&1 | tail -2 || echo "VENV-FAILED (python3-venv may be missing)"
if [ -x ~/bfclenv/bin/pip ]; then
  ~/bfclenv/bin/pip install --quiet --upgrade pip 2>&1 | tail -1
  echo "VENV_PIP=$(~/bfclenv/bin/pip --version | cut -c1-40)"
else
  echo "NO-VENV-PIP"
fi
