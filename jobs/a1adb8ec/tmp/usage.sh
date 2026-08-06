cd /mnt/c/Users/marka/cgsports-pipeline
KEY=$(grep "^ODDS_API_KEY=" odds.env | cut -d= -f2- | tr -d "\r\n\"")
curl -s -D /tmp/h2.txt "https://api.the-odds-api.com/v4/sports/?apiKey=$KEY" -o /dev/null
grep -i "x-requests-used" /tmp/h2.txt
