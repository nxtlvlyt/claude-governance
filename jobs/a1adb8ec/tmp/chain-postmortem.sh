#!/usr/bin/env bash
# The overnight chain died without reaching its DONE marker. What is still alive, how far did
# it get, and is anything lost?
set -uo pipefail
echo "=== $(date) ==="
echo
echo "--- processes ---"
echo -n "  chain      : "; ps -eo args | grep -c '[o]vernight-chain' || true
echo -n "  generate   : "; ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true
echo -n "  fc-lane sh : "; ps -eo args | grep -c '[r]un-fc-lane' || true
echo -n "  keepalive  : "; ps -eo args | grep -c '[s]leep 43200' || true
echo -n "  training   : "; ps -eo args | grep -c '[t]rain_student_generic' || true

echo
echo "--- how far did the chain get? (its own log) ---"
tr '\r' '\n' < /root/bfclproj/overnight.log 2>/dev/null | grep -E '^===|^###|^####' | tail -12

echo
echo "--- launch log, in case it died before writing to overnight.log ---"
tail -12 /root/bfclproj/overnight-launch.log 2>/dev/null | grep -v '^[[:space:]]*$' || echo "  (empty)"

echo
echo "--- work banked (nothing here is lost) ---"
for f in /root/bfclproj/result/*/agentic/*.json /root/bfclproj/result/*/multi_turn/*.json; do
  [ -f "$f" ] && printf "  %4s rows  %s/%s\n" "$(wc -l < "$f")" "$(basename "$(dirname "$(dirname "$f")")")" "$(basename "$f")"
done

echo
echo "--- scores on record ---"
cat /root/bfclproj/score/data_agentic.csv 2>/dev/null | head -6

echo
echo "--- was it OOM / killed by the kernel? ---"
dmesg 2>/dev/null | tail -20 | grep -iE 'killed process|out of memory|oom' || echo "  no OOM in dmesg (or dmesg unavailable)"
