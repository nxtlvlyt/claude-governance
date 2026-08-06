cp /mnt/c/Users/marka/card-2boots.html /root/print-pipeline/
cd /root/print-pipeline
/root/print-venv/bin/weasyprint card-2boots.html card-2boots.pdf
pdftoppm -png -r 100 card-2boots.pdf card
cp card-2.png card-2boots.pdf flyer-2boots.pdf /mnt/c/Users/marka/
