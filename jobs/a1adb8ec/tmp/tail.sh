awk "/######## TRAIN v3.5 2026-08-06T04:08:10/,0" /root/bfclproj/train-v35.log | grep -avE "it/s|s/it" | tail -8
