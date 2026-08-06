cd /mnt/c/Users/marka/cgsports-pipeline
grep -rn "BETTABLE_BOOKS = frozenset" --include="*.py" .
F=$(grep -rln "BETTABLE_BOOKS = frozenset" --include="*.py" . | head -1)
L=$(grep -n "BETTABLE_BOOKS = frozenset" "$F" | cut -d: -f1)
sed -n "${L},$((L+12))p" "$F"
