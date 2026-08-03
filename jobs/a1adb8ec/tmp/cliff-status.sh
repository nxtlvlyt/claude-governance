#!/usr/bin/env bash
# Did the cliff test actually die, or did only the local ssh client drop?
#
# Earlier today a "completed exit 0" notification meant the ssh died while the remote job ran
# on for another hour. The inverse is equally possible. The local task status is evidence
# about the CLIENT, not about the work. Check the work.
set -uo pipefail
RES=/root/bfclproj/result
echo "=== date ==="; date
echo
echo "=== generate processes (interpreter+entrypoint, cannot self-match) ==="
ps -eo pid,etime,args | grep '^ *[0-9]* *[0-9:]* */root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl' || echo "  none running"
echo
echo "=== cliff-test launcher ==="
ps -eo pid,etime,args | grep '[r]un-cliff-test' || echo "  launcher gone"
echo
echo "=== rows produced so far ==="
for f in "$RES"/arch-gov-27b-sys/*/*.json; do
  [ -f "$f" ] && printf "  %5s  %s  (mtime %s)\n" "$(wc -l < "$f")" "${f#$RES/arch-gov-27b-sys/}" "$(stat -c %y "$f" | cut -d. -f1)"
done
echo
echo "=== cliff-test log, last 12 real lines ==="
tr '\r' '\n' < /root/bfclproj/cliff-test.log 2>/dev/null | grep -v '^\s*$' | tail -12
echo
echo "=== ollama residency ==="
curl -s http://172.30.144.1:11434/api/ps | python3 -c '
import sys,json
ms=(json.load(sys.stdin).get("models") or [])
print("  (nothing resident)" if not ms else "")
for m in ms: print("  %-28s vram=%.1fGB" % (m.get("name"), (m.get("size_vram") or 0)/1e9))
'
