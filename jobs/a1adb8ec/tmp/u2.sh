cd /mnt/c/Users/marka/cgsports-pipeline
KEY=$(grep "^ODDS_API_KEY=" odds.env | cut -d= -f2- | tr -d "\r\n\"")
curl -s -D - "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=$KEY&regions=us&markets=h2h" -o /dev/null | grep -i x-requests-used
