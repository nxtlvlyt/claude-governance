cp /mnt/c/Users/marka/rack-2boots.html /root/print-pipeline/
cd /root/print-pipeline
/root/print-venv/bin/weasyprint rack-2boots.html rack-2boots.pdf
pdftoppm -png -r 90 rack-2boots.pdf rack
/root/print-venv/bin/python - <<PYEOF
from pypdf import PdfReader
r=PdfReader('rack-2boots.pdf')
print('rack pages', len(r.pages), round(float(r.pages[0].mediabox.width)/72,3),'x',round(float(r.pages[0].mediabox.height)/72,3))
PYEOF
cp rack-1.png rack-2.png rack-2boots.pdf /mnt/c/Users/marka/
