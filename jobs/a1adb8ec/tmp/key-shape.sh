#!/usr/bin/env bash
# Key file SHAPE only — never the content: lines, length, first 4 chars, JWT-ish?
set -uo pipefail
for f in /mnt/d/Downloads/AIMLAPI_APIkey_*.txt "/mnt/d/Downloads/muddy tires/AIMLAPI_APIkey_5695e802.txt"; do
  [ -f "$f" ] || continue
  LINES=$(wc -l < "$f")
  RAW=$(tr -d '\r\n ' < "$f")
  echo "$(basename "$f"): lines=$LINES stripped_len=${#RAW} head4=${RAW:0:4} jwt_dots=$(echo "$RAW" | tr -cd '.' | wc -c)"
done
exit 0
