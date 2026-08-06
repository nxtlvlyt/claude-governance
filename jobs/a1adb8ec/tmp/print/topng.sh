cd /root/print-pipeline
command -v pdftoppm >/dev/null || { apt-get install -y poppler-utils >/dev/null 2>&1; }
pdftoppm -png -r 100 card-2boots.pdf card && pdftoppm -png -r 60 flyer-2boots.pdf flyer && ls card-*.png flyer-*.png
cp card-*.png flyer-*.png /mnt/c/Users/marka/
