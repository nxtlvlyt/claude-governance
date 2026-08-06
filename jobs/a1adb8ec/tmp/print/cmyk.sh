cd /root/print-pipeline
command -v gs >/dev/null || apt-get install -y ghostscript >/dev/null 2>&1
for f in card-2boots flyer-2boots; do gs -q -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK -o ${f}-cmyk.pdf ${f}.pdf; done
/root/print-venv/bin/python - <<PYEOF
from pypdf import PdfReader
for f in ['card-2boots-cmyk.pdf','flyer-2boots-cmyk.pdf']:
    r=PdfReader(f)
    print(f, len(r.pages), 'pages', round(float(r.pages[0].mediabox.width)/72,3), 'x', round(float(r.pages[0].mediabox.height)/72,3), 'in')
PYEOF
cp card-2boots-cmyk.pdf flyer-2boots-cmyk.pdf /mnt/c/Users/marka/
