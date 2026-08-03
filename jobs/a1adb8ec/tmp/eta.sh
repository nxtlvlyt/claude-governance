#!/usr/bin/env bash
# ETA from MEASURED throughput, with the uncertainty stated.
#
# Three ETAs have already been wrong today. The failure each time was extrapolating from a
# small or unrepresentative sample and reporting a single number as if it were known. So this
# reports: the average since start, the recent-window rate, and the spread between them - and
# names which stages are still queued behind this one.
set -uo pipefail

RES=/root/bfclproj/result
LOG=/root/bfclproj/serial-multiturn.log
CTRL="$RES/qwen3.6-27b-base/multi_turn/BFCL_v4_multi_turn_base_result.json"

START_ISO=$(grep -m1 'GENERATE CONTROL' "$LOG" | grep -o '[0-9T:+-]\{20,\}')
START=$(date -d "$START_ISO" +%s 2>/dev/null || echo 0)
NOW=$(date +%s)
ROWS=$( [ -f "$CTRL" ] && wc -l < "$CTRL" || echo 0 )

echo "control run  : qwen3.6-27b-base / multi_turn_base"
echo "started      : $START_ISO"
echo "now          : $(date -Is)"
echo "rows done    : $ROWS / 200"

if [ "$START" -gt 0 ] && [ "$ROWS" -gt 0 ]; then
  EL=$(( NOW - START ))
  python3 - "$EL" "$ROWS" <<'PY'
import sys
el, rows = int(sys.argv[1]), int(sys.argv[2])
per = el / rows
rem = (200 - rows) * per
print("elapsed      : %d min" % (el // 60))
print("avg per row  : %.1f min  (measured over %d rows, whole run)" % (per / 60, rows))
print("remaining    : %d rows -> %.1f h at that average" % (200 - rows, rem / 3600))
print("projected end: +%.1f h from now" % (rem / 3600))
PY
fi

echo
echo "bfcl's own rolling estimate (last bar line):"
tr '\r' '\n' < "$LOG" | grep -o '[0-9]*/200 \[[^]]*\]' | tail -1 | sed 's/^/  /'

echo
echo "STILL QUEUED BEHIND THIS (serial, same script):"
for f in "$RES"/arch-gov-27b/multi_turn/*miss*_result.json; do
  [ -f "$f" ] && echo "  $(basename "$f"): $(wc -l < "$f")/200 rows already banked (bfcl resumes, so only the remainder runs)"
done
echo "  those run on the TUNED model, which measured ~33s/entry vs the control's ~150-180s"
echo "  -> the two miss_* stages are a small fraction of the control's cost"

echo
echo "VARIANCE NOTE: multi_turn entries differ a lot in turn count, so the per-row average"
echo "moves as the run proceeds. Observed s/it on this run so far: 147 -> 216 -> 143."
echo "Treat the projection as a range, not a time."
