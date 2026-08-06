cd /root/bfclproj && set -a && . ./.env && set +a
curl -s https://api.aimlapi.com/v1/models -H "Authorization: Bearer $AIMLAPI_API_KEY" | python3 -X utf8 -c "
import json,sys
d=json.load(sys.stdin)
ids=[m.get(\"id\",\"\") for m in d.get(\"data\",[])]
img=[i for i in ids if any(k in i.lower() for k in [\"flux\",\"imagen\",\"diffusion\",\"dall\",\"recraft\",\"seedream\"])]
print(\"\n\".join(img[:20]))"
