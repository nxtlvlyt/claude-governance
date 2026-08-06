cd /mnt/c/Users/marka/cgsports-pipeline
set -a; . ./bot.env 2>/dev/null; set +a
KEY_VAR=$(cut -d= -f1 bot.env | grep -iE "odds" | head -1); echo "keyvar: $KEY_VAR"
KEY=$(eval echo \$$KEY_VAR)
curl -s -D /tmp/h.txt "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=$KEY&regions=us&markets=h2h&oddsFormat=american" -o /tmp/b.json
grep -iE "^HTTP|x-requests-remaining|x-requests-used" /tmp/h.txt
python3 -c "import json; d=json.load(open(\"/tmp/b.json\")); print(\"events:\", len(d) if isinstance(d,list) else d)" 2>&1 | head -2
