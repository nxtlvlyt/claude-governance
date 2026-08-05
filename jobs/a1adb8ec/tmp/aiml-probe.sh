#!/usr/bin/env bash
# Wire the AIML key server-side (NEVER echo it) + read the bfcl registration pattern.
set -uo pipefail
# 1) newest key file on D:\Downloads
KF=$(ls -t /mnt/d/Downloads/AIMLAPI_APIkey_*.txt 2>/dev/null | head -1)
echo "key file: $KF"
KEY=$(tr -d '\r\n ' < "$KF")
echo "key length: ${#KEY} (not shown)"
# 2) validate against the API — print HTTP code + sonnet/claude model ids only
CODE=$(curl -s -o /tmp/aiml-models.json -w '%{http_code}' --max-time 20 \
  -H "Authorization: Bearer $KEY" https://api.aimlapi.com/v1/models)
echo "models endpoint HTTP: $CODE"
python3 -c "
import json
try:
    d = json.load(open('/tmp/aiml-models.json'))
    items = d.get('data', d if isinstance(d, list) else [])
    ids = [m.get('id','') for m in items if isinstance(m, dict)]
    hits = [i for i in ids if 'sonnet' in i.lower() or 'claude' in i.lower()]
    print('claude-family ids:', hits[:12])
except Exception as e:
    print('parse fail:', e)
"
# 3) wire into .env if valid and absent
if [ "$CODE" = "200" ] && ! grep -q '^AIMLAPI_KEY=' /root/bfclproj/.env; then
  echo "AIMLAPI_KEY=$KEY" >> /root/bfclproj/.env
  echo ".env: AIMLAPI_KEY appended"
else
  grep -c '^AIMLAPI_KEY=' /root/bfclproj/.env | sed 's/^/.env already has AIMLAPI_KEY lines: /'
fi
# 4) how are the local models registered?
echo "--- model_config entries 1715-1760 ---"
sed -n '1715,1760p' /root/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py
echo "--- handler files matching Arch/local ---"
grep -rln 'ArchLocal\|arch-gov' /root/bfclenv/lib/python3.12/site-packages/bfcl_eval/model_handler/ 2>/dev/null | head -4
exit 0
