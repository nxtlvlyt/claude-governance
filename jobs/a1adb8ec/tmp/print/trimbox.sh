cd /root/print-pipeline
/root/print-venv/bin/python - <<PYEOF
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
import shutil
B = 9.0  # 0.125in in points
files = ["card-2boots","rack-2boots","rack-2boots-offer","rack-2boots-edging","flyer-2boots"]
for stem in files:
    for suffix in ["", "-cmyk"]:
        f = stem + suffix + ".pdf"
        r = PdfReader(f); w = PdfWriter()
        for p in r.pages:
            mb = p.mediabox
            p.trimbox = RectangleObject((float(mb.left)+B, float(mb.bottom)+B, float(mb.right)-B, float(mb.top)-B))
            p.bleedbox = RectangleObject((float(mb.left), float(mb.bottom), float(mb.right), float(mb.top)))
            w.add_page(p)
        out = f.replace(".pdf", "-press.pdf")
        with open(out, "wb") as fh: w.write(fh)
        rr = PdfReader(out); tb = rr.pages[0].trimbox
        print(out, "trim:", round((float(tb.right)-float(tb.left))/72,3), "x", round((float(tb.top)-float(tb.bottom))/72,3))
PYEOF
cp *-press.pdf /mnt/c/Users/marka/
