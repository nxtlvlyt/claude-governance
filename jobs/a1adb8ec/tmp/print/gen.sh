cd /root/bfclproj && set -a && . ./.env && set +a
cd /root/print-pipeline/assets
gen() { curl -s https://api.aimlapi.com/v1/images/generations -H "Authorization: Bearer $AIMLAPI_KEY" -H "Content-Type: application/json" -d "$1" > "$2"; python3 -X utf8 -c "
import json,base64,urllib.request,sys
d=json.load(open(\"$2\"))
if \"data\" not in d: print(\"GEN-ERR:\", str(d)[:300]); sys.exit(1)
item=d[\"data\"][0]
if \"b64_json\" in item: open(\"$3\",\"wb\").write(base64.b64decode(item[\"b64_json\"]))
else: urllib.request.urlretrieve(item[\"url\"],\"$3\")
print(\"SAVED $3\")"; }
gen "{\"model\":\"flux-2-pro\",\"prompt\":\"residential front lawn in autumn covered with fallen orange and red maple leaves, a leaf rake resting against a porch step, soft overcast morning light, clean photographic style, calm suburban street, generous plain sky and quiet space in the upper third, no people, no text, no letters, no words, no logos, no watermarks\",\"size\":\"1792x1024\"}" fall.json fall-bg.png
gen "{\"model\":\"flux-2-pro\",\"prompt\":\"freshly cleared residential driveway and walkway after heavy snowfall, neat snow banks on both sides, snow shovel standing upright in a snowbank, soft blue winter morning light, cozy suburban home, generous plain sky in the upper third, no people, no text, no letters, no words, no logos, no watermarks\",\"size\":\"1792x1024\"}" winter.json winter-bg.png
/root/print-venv/bin/python -c "
from PIL import Image
for f in [\"fall-bg.png\",\"winter-bg.png\"]:
    try:
        im=Image.open(f); print(f, im.size)
        im.convert(\"RGB\").save(f.replace(\".png\",\".jpg\"), quality=92)
    except Exception as e: print(f,\"ERR\",e)"
