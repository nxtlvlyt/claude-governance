cd /mnt/c/Users/marka/cgsports-pipeline
grep -rn "the-odds-api\|ODDS_API\|apiKey" --include="*.py" --include="*.env" --include="*.json" -l . 2>/dev/null | head -5
grep -rhoE "[A-Z_]*ODDS[A-Z_]*" --include="*.py" . 2>/dev/null | sort -u | head -5
ls *.env *.key 2>/dev/null
