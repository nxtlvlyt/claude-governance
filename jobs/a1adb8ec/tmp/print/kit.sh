cd /root/print-pipeline
for f in rack-2boots-fall rack-2boots-winter card-2boots-realtor doorhanger-2boots rack-2boots-stcatharines rack-2boots-niagarafalls rack-2boots-portcolborne; do cp /mnt/c/Users/marka/$f.html .; /root/print-venv/bin/weasyprint $f.html $f.pdf && gs -q -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK -o $f-cmyk.pdf $f.pdf; done
/root/print-venv/bin/python - <<PYEOF
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
B=9.0
for stem in ["rack-2boots-fall","rack-2boots-winter","card-2boots-realtor","doorhanger-2boots","rack-2boots-stcatharines","rack-2boots-niagarafalls","rack-2boots-portcolborne"]:
    for suf in ["","-cmyk"]:
        f=stem+suf+".pdf"; r=PdfReader(f); w=PdfWriter()
        for p in r.pages:
            mb=p.mediabox
            p.trimbox=RectangleObject((float(mb.left)+B,float(mb.bottom)+B,float(mb.right)-B,float(mb.top)-B))
            p.bleedbox=RectangleObject((float(mb.left),float(mb.bottom),float(mb.right),float(mb.top)))
            w.add_page(p)
        w.write(open(stem+suf+"-press.pdf","wb"))
    r=PdfReader(stem+".pdf")
    print(stem, len(r.pages), round(float(r.pages[0].mediabox.width)/72,3),"x",round(float(r.pages[0].mediabox.height)/72,3))
PYEOF
for f in rack-2boots-fall rack-2boots-winter card-2boots-realtor doorhanger-2boots rack-2boots-stcatharines rack-2boots-niagarafalls rack-2boots-portcolborne; do pdftoppm -png -r 80 $f.pdf vis-$f; done
cp rack-2boots-fall*.pdf rack-2boots-winter*.pdf card-2boots-realtor*.pdf doorhanger-2boots*.pdf rack-2boots-stcatharines*.pdf rack-2boots-niagarafalls*.pdf rack-2boots-portcolborne*.pdf vis-*.png /mnt/c/Users/marka/kitout/ 2>/dev/null || { mkdir -p /mnt/c/Users/marka/kitout && cp rack-2boots-fall*.pdf rack-2boots-winter*.pdf card-2boots-realtor*.pdf doorhanger-2boots*.pdf rack-2boots-stcatharines*.pdf rack-2boots-niagarafalls*.pdf rack-2boots-portcolborne*.pdf vis-*.png /mnt/c/Users/marka/kitout/; }
