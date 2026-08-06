cd /root/print-pipeline && cp /mnt/c/Users/marka/social-2boots-square.html /mnt/c/Users/marka/social-2boots-story.html .
/root/print-venv/bin/weasyprint social-2boots-square.html social-sq.pdf && pdftoppm -png -r 270 social-sq.pdf sq && mv sq-1.png social-2boots-square.png
/root/print-venv/bin/weasyprint social-2boots-story.html social-st.pdf && pdftoppm -png -r 300 social-st.pdf st && mv st-1.png social-2boots-story.png
/root/print-venv/bin/python -c "
from PIL import Image
for f in [\"social-2boots-square.png\",\"social-2boots-story.png\"]: print(f, Image.open(f).size)"
for f in rack-2boots-fall rack-2boots-winter card-2boots-realtor doorhanger-2boots; do pdftoppm -png -r 150 $f.pdf bl2-$f; done
/root/print-venv/bin/python - <<PYEOF
from PIL import Image
import glob
def strip(im, side, a, b):
    w,h = im.size
    box = {"L":(a,0,b,h),"R":(w-b,0,w-a,h),"T":(0,a,w,b),"B":(0,h-b,w,h-a)}[side]
    px = list(im.crop(box).convert("L").getdata())
    return sum(1 for p in px if p>245)/len(px)
for f in sorted(glob.glob("bl2-*.png")):
    im = Image.open(f); out=[]
    for s in "LRTB":
        o,i = strip(im,s,0,6), strip(im,s,18,24)
        out.append(s+":"+("white-safe" if o>.98 and i>.98 else "art-bleeds" if o<.6 else "MISSING-BLEED" if o>.9 and i<.6 else "mixed-ok"))
    print(f, " ".join(out))
PYEOF
cp social-2boots-square.png social-2boots-story.png /mnt/c/Users/marka/kitout/
