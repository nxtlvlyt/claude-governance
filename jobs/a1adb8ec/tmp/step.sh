awk "/######## TRAIN v3.5 2026-08-06T04:57:10/,0" /root/bfclproj/train-v35.log | grep -aoE "[0-9]+/720 \[[^]]*\]" | tail -1
