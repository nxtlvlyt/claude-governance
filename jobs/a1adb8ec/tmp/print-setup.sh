#!/usr/bin/env bash
# Print-pipeline foundation on nxtbeast (CPU-only, zero GPU): venv + WeasyPrint + verify.
set -uo pipefail
LOG=/root/print-pipeline-setup.log
exec > >(tee -a "$LOG") 2>&1
echo "######## PRINT PIPELINE SETUP $(date -Is) ########"
if [ ! -d /root/print-venv ]; then python3 -m venv /root/print-venv; fi
/root/print-venv/bin/pip install --quiet --upgrade pip
/root/print-venv/bin/pip install --quiet weasyprint pypdf pillow
echo "=== versions ==="
/root/print-venv/bin/python3 -c "import weasyprint; print('weasyprint', weasyprint.__version__)"
/root/print-venv/bin/python3 -c "import pypdf; print('pypdf', pypdf.__version__)"
echo "=== smoke: compile a 3.75x2.25in card (3.5x2 trim + 0.125 bleed) and MEASURE it ==="
mkdir -p /root/print-pipeline
cat > /root/print-pipeline/smoke-card.html <<'HTML'
<!doctype html><html><head><style>
@page { size: 3.75in 2.25in; margin: 0; }
body { margin: 0; width: 3.75in; height: 2.25in; background: #234; color: #fff;
       font-family: sans-serif; display: flex; align-items: center; justify-content: center; }
.trim { position: absolute; top: 0.125in; left: 0.125in; right: 0.125in; bottom: 0.125in;
        border: 1px dashed rgba(255,255,255,.4); }
</style></head><body><div class="trim"></div><div>2BOOTS — smoke card</div></body></html>
HTML
/root/print-venv/bin/python3 -c "
from weasyprint import HTML
HTML('/root/print-pipeline/smoke-card.html').write_pdf('/root/print-pipeline/smoke-card.pdf')
from pypdf import PdfReader
r = PdfReader('/root/print-pipeline/smoke-card.pdf')
box = r.pages[0].mediabox
w_in, h_in = float(box.width)/72, float(box.height)/72
print(f'PDF page: {w_in:.3f}in x {h_in:.3f}in')
assert abs(w_in-3.75) < 0.01 and abs(h_in-2.25) < 0.01, 'DIMENSION FAIL'
print('DIMENSION-CHECK PASS: trim 3.5x2.0 + 0.125in bleed all around')
"
echo "######## SETUP DONE $(date -Is) ########"
exit 0
