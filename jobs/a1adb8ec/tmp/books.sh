cd /mnt/c/Users/marka/cgsports-pipeline
python3 -c "
import json
d=json.load(open(\"/tmp/b.json\"))
books=set()
for ev in d:
    for bk in ev.get(\"bookmakers\",[]): books.add(bk[\"key\"])
print(\"api books:\", sorted(books))"
grep -rn "bettable" --include="*.py" -l . | head -3
grep -rhn "BETTABLE[_A-Z]*\s*=" --include="*.py" . | head -4
