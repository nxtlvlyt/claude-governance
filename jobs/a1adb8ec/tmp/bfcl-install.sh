#!/bin/bash
P=~/bfclenv/bin/pip
$P install bfcl-eval 2>&1 | tail -6
echo "---- verify ----"
~/bfclenv/bin/python -c "import bfcl_eval, pathlib; print('BFCL_OK', bfcl_eval.__version__ if hasattr(bfcl_eval,'__version__') else 'installed'); print('PKG', pathlib.Path(bfcl_eval.__path__[0]))" 2>&1 | tail -3
ls ~/bfclenv/bin/ | grep -i bfcl || echo "no bfcl cli"
