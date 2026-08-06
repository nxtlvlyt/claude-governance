cd /root/print-pipeline && mkdir -p assets && cd assets
for f in logo.png hero.webp work-lawn.webp work-pressure-washing.webp work-decks.webp work-gutters.webp; do curl -sL -A "Mozilla/5.0" -o "$f" "https://2boots.ca/$f"; done
/root/print-venv/bin/python - <<PYEOF
from PIL import Image
import os
for f in sorted(os.listdir('.')):
    try:
        im = Image.open(f); print(f, im.size, im.mode)
        if f.endswith('.webp'): im.convert('RGB').save(f.replace('.webp','.jpg'), quality=92)
    except Exception as e: print(f, 'ERR', e)
PYEOF
