cd /root/print-pipeline
for f in card-2boots rack-2boots rack-2boots-offer rack-2boots-edging flyer-2boots; do pdftoppm -png -r 150 $f.pdf bl-$f; done
/root/print-venv/bin/python - <<PYEOF
from PIL import Image
import glob
def strip_stats(im, side, a, b):
    w,h = im.size
    if side=="L": box=(a,0,b,h)
    elif side=="R": box=(w-b,0,w-a,h)
    elif side=="T": box=(0,a,w,b)
    else: box=(0,h-b,w,h-a)
    px = list(im.crop(box).convert("L").getdata())
    white = sum(1 for p in px if p>245)
    return white/len(px)
BLEED=18  # 0.12in at 150dpi
for f in sorted(glob.glob("bl-*.png")):
    im = Image.open(f)
    verdicts=[]
    for side in "LRTB":
        outer = strip_stats(im, side, 0, 6)
        inner = strip_stats(im, side, BLEED, BLEED+6)
        if outer>0.98 and inner>0.98: verdicts.append(side+":white-safe")
        elif outer<0.6: verdicts.append(side+":art-bleeds")
        elif outer>0.9 and inner<0.6: verdicts.append(side+":MISSING-BLEED")
        else: verdicts.append(side+":mixed(o=%.2f,i=%.2f)"%(outer,inner))
    print(f, " ".join(verdicts))
PYEOF
