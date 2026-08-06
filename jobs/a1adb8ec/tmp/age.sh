echo "log-age-s: $(( $(date +%s) - $(stat -c %Y /root/bfclproj/train-v35.log) ))"
tail -2 /root/bfclproj/watchdog.log
