cd /mnt/c/Users/marka/cgsports-pipeline
set -a; . ./odds.env 2>/dev/null; set +a
curl -s -D /tmp/h.txt "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=$ODDS_API_KEY&regions=us&markets=h2h&oddsFormat=american" -o /tmp/b.json
grep -iE "^HTTP|x-requests-remaining|x-requests-used|x-requests-last" /tmp/h.txt
python3 -c "import json; d=json.load(open(\"/tmp/b.json\")); print(\"events:\", len(d) if isinstance(d,list) else d)" | head -2
