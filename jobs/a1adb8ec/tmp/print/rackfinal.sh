cp /mnt/c/Users/marka/rack-2boots.html /root/print-pipeline/ && cd /root/print-pipeline
/root/print-venv/bin/weasyprint rack-2boots.html rack-2boots.pdf
gs -q -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK -o rack-2boots-cmyk.pdf rack-2boots.pdf
/root/print-venv/bin/python -c "
from pypdf import PdfReader
for f in [\"rack-2boots.pdf\",\"rack-2boots-cmyk.pdf\"]:
    r=PdfReader(f); print(f, len(r.pages), round(float(r.pages[0].mediabox.width)/72,3),\"x\",round(float(r.pages[0].mediabox.height)/72,3))"
cp rack-2boots.pdf rack-2boots-cmyk.pdf /mnt/c/Users/marka/
