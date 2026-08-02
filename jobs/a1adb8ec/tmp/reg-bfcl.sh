#!/bin/bash
python3 - <<'PY'
import io,os
C=os.path.expanduser("~/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py")
t=io.open(C,encoding='utf-8').read()
if 'arch-gov-27b-v33-bfcl' in t:
    print("ALREADY"); raise SystemExit
t=t.replace('        model_name="arch-gov-27b-v33-bare",\n        display_name="Arch-Gov-27B v3.3 (Prompt)",',
            '        model_name="arch-gov-27b-v33-bfcl",\n        display_name="Arch-Gov-27B v3.3 (Prompt, num_predict=512)",',1)
io.open(C,'w',encoding='utf-8').write(t)
print("REPOINTED arch-gov-27b -> arch-gov-27b-v33-bfcl (capped)")
PY
pkill -f "bfcl generate" 2>/dev/null; sleep 3
echo "killed old run: $(pgrep -f 'bfcl generate' | wc -l) remaining"
~/bfclenv/bin/python -c "
from bfcl_eval.constants.model_config import MODEL_CONFIG_MAPPING as M
c=M['arch-gov-27b']; print(' registry ->', c.model_name)"
