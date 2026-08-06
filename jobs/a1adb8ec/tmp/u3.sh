cd /mnt/c/Users/marka/cgsports-pipeline
KEY=$(grep "^ODDS_API_KEY=" odds.env | cut -d= -f2- | tr -d "\r\n\"")
curl -s -D - "https://api.the-odds-api.com/v4/sports/?apiKey=$KEY" -o /dev/null | grep -i "x-requests-used"
ls -t *.log | head -3
for f in $(ls -t *.log | head -2); do echo "== $f"; tail -2 "$f" | cut -c1-140; done
