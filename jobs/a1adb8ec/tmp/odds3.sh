cd /mnt/c/Users/marka/cgsports-pipeline
KEY=$(grep "^ODDS_API_KEY=" odds.env | cut -d= -f2- | tr -d "\r\n\"" )
echo "keylen: ${#KEY}"
curl -s -D /tmp/h.txt "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=$KEY&regions=us&markets=h2h&oddsFormat=american" -o /tmp/b.json
grep -iE "^HTTP|x-requests-remaining|x-requests-used" /tmp/h.txt
python3 -c "import json; d=json.load(open(\"/tmp/b.json\")); print(\"events:\", len(d) if isinstance(d,list) else str(d)[:120])"
