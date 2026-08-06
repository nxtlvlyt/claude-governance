tail -c 300 /root/bfclproj/train-v35.log | grep -aoE "[0-9]+/720 \[[^]]*\]" | tail -1
