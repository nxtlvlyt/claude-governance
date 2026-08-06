cd /root/bfclproj && set -a && . ./.env && set +a
cd /root/print-pipeline/assets
gen() { curl -s https://api.aimlapi.com/v1/images/generations -H "Authorization: Bearer $AIMLAPI_KEY" -H "Content-Type: application/json" -d "$1" > "$2"; URL=$(python3 -X utf8 -c "
import json,sys
d=json.load(open(\"$2\"))
if \"data\" not in d: print(\"ERR \"+str(d)[:200]); sys.exit(0)
item=d[\"data\"][0]
print(item.get(\"url\",\"B64\"))"); case "$URL" in ERR*) echo "$URL";; B64) python3 -X utf8 -c "
import json,base64
d=json.load(open(\"$2\"))
open(\"$3\",\"wb\").write(base64.b64decode(d[\"data\"][0][\"b64_json\"]))
print(\"SAVED-b64 $3\")";; *) curl -sL -A "Mozilla/5.0" -o "$3" "$URL" && echo "SAVED $3";; esac; }
gen "{\"model\":\"flux-2-pro\",\"prompt\":\"residential front lawn in autumn covered with fallen orange and red maple leaves, a leaf rake resting against a porch step, soft overcast morning light, clean photographic style, calm suburban street, generous plain sky and quiet space in the upper third, no people, no text, no letters, no words, no logos, no watermarks\",\"size\":\"1792x1024\"}" fall.json fall-bg.png
gen "{\"model\":\"flux-2-pro\",\"prompt\":\"freshly cleared residential driveway and walkway after heavy snowfall, neat snow banks on both sides, snow shovel standing upright in a snowbank, soft blue winter morning light, cozy suburban home, generous plain sky in the upper third, no people, no text, no letters, no words, no logos, no watermarks\",\"size\":\"1792x1024\"}" winter.json winter-bg.png
/root/print-venv/bin/python -c "
from PIL import Image
for f in [\"fall-bg.png\",\"winter-bg.png\"]:
    try:
        im=Image.open(f); print(f, im.size)
        im.convert(\"RGB\").save(f.replace(\".png\",\".jpg\"), quality=92)
    except Exception as e: print(f,\"ERR\",e)"
cp fall-bg.png winter-bg.png /mnt/c/Users/marka/ 2>/dev/null
