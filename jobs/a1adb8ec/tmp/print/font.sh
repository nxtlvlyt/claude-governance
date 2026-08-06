cd /root/print-pipeline/assets
curl -sL -o Anton-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf"
ls -la Anton-Regular.ttf | awk "{print \$5}"
/root/print-venv/bin/python -c "from fontTools.ttLib import TTFont" 2>/dev/null || /root/print-venv/bin/python -c "
from PIL import ImageFont
try:
    f=ImageFont.truetype(\"Anton-Regular.ttf\", 20); print(\"FONT-OK\", f.getname())
except Exception as e: print(\"FONT-BAD\", e)"
