#!/bin/bash
# cq-v35 stall watchdog: frozen train log + live trainer = wedge -> relaunch.
LOG=/root/bfclproj/train-v35.log
if pgrep -f train_student_generic.py >/dev/null; then
  AGE=$(( $(date +%s) - $(stat -c %Y "$LOG") ))
  if [ "$AGE" -gt 600 ]; then
    echo "$(date -u +%FT%TZ) WATCHDOG: log frozen ${AGE}s with live trainer — relaunching" >> /root/bfclproj/watchdog.log
    pkill -f train_student_generic.py; pkill -f train-v35.sh; sleep 8
  fi
else
  if ! grep -a "rc=0" "$LOG" | tail -1 | grep -q .; then
    echo "$(date -u +%FT%TZ) WATCHDOG: no trainer, no rc=0 — relaunching" >> /root/bfclproj/watchdog.log
  fi
fi
# relaunch only when nothing alive (covers both branches above)
if ! pgrep -f train_student_generic.py >/dev/null && ! pgrep -f train-v35.sh >/dev/null; then
  if ! grep -a "^### TRAIN rc=0" "$LOG" >/dev/null 2>&1; then
    /mnt/c/Windows/System32/schtasks.exe /run /tn cq-train-v35 >/dev/null 2>&1
    echo "$(date -u +%FT%TZ) WATCHDOG: refire issued" >> /root/bfclproj/watchdog.log
  fi
fi
