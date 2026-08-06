cp /mnt/c/Users/marka/rack-2boots-edging.html /root/print-pipeline/ && cd /root/print-pipeline
/root/print-venv/bin/weasyprint rack-2boots-edging.html rack-2boots-edging.pdf
gs -q -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK -o rack-2boots-edging-cmyk.pdf rack-2boots-edging.pdf
pdftoppm -png -r 90 -f 1 -l 1 rack-2boots-edging.pdf edgechk
/root/print-venv/bin/python -c "
from pypdf import PdfReader
for f in [\"rack-2boots-edging.pdf\",\"rack-2boots-edging-cmyk.pdf\"]:
    r=PdfReader(f); print(f, len(r.pages), round(float(r.pages[0].mediabox.width)/72,3),\"x\",round(float(r.pages[0].mediabox.height)/72,3))"
cp rack-2boots-edging.pdf rack-2boots-edging-cmyk.pdf edgechk-1.png /mnt/c/Users/marka/
