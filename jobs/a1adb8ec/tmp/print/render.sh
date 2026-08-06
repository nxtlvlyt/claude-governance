cp /mnt/c/Users/marka/card-2boots.html /mnt/c/Users/marka/flyer-2boots.html /root/print-pipeline/
cd /root/print-pipeline
/root/print-venv/bin/weasyprint card-2boots.html card-2boots.pdf
/root/print-venv/bin/weasyprint flyer-2boots.html flyer-2boots.pdf
/root/print-venv/bin/python - <<PYEOF
from pypdf import PdfReader
for f in ['card-2boots.pdf','flyer-2boots.pdf']:
    r = PdfReader(f)
    for i,p in enumerate(r.pages):
        w=float(p.mediabox.width)/72; h=float(p.mediabox.height)/72
        print(f, 'page', i+1, round(w,3), 'x', round(h,3), 'in')
PYEOF
