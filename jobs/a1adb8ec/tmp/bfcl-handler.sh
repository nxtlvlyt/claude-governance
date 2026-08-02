#!/bin/bash
SP=~/bfclenv/lib/python3.12/site-packages/bfcl_eval
cp /mnt/c/Users/marka/arch_handler.py $SP/model_handler/api_inference/arch_local.py
python3 - <<'PY'
import io,os
C=os.path.expanduser("~/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py")
t=io.open(C,encoding='utf-8').read()
imp="from bfcl_eval.model_handler.api_inference.arch_local import ArchLocalHandler\n"
if "ArchLocalHandler" not in t.split("MODEL_CONFIG_MAPPING")[0]:
    a="from bfcl_eval.model_handler.api_inference.novita import NovitaHandler\n"
    t=t.replace(a, a+imp, 1)
t=t.replace("model_handler=QwenHandler,\n        input_price=None,\n        output_price=None,\n        is_fc_model=False,\n        underscore_to_dot=False,\n    ),\n    \"arch-gov-27b-FC\"",
            "model_handler=ArchLocalHandler,\n        input_price=None,\n        output_price=None,\n        is_fc_model=False,\n        underscore_to_dot=False,\n    ),\n    \"arch-gov-27b-FC\"",1)
# replace the handler for the three entries we added
import re
for name in ("arch-gov-27b","arch-gov-27b-FC","qwen3.6-27b-base"):
    m=re.search(r'("%s": ModelConfig\((?:.|\n)*?)model_handler=QwenHandler,' % re.escape(name), t)
    if m: t = t[:m.start()] + m.group(1) + "model_handler=ArchLocalHandler," + t[m.end():]
io.open(C,'w',encoding='utf-8').write(t)
print("import present:", "arch_local import ArchLocalHandler" in t)
import subprocess
PY
echo "=== verify config imports cleanly ==="
~/bfclenv/bin/python -c "
from bfcl_eval.constants.model_config import MODEL_CONFIG_MAPPING as M
for k in ('arch-gov-27b','arch-gov-27b-FC','qwen3.6-27b-base'):
    c=M.get(k); print(' ',k,'->',c.model_handler.__name__ if c else 'MISSING','| model_name=',c.model_name if c else '-')
" 2>&1 | tail -6
