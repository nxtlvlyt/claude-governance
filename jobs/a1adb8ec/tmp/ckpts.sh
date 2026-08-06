ls /mnt/d/conductor-qwen-run/ | grep ckpt
for d in /mnt/d/conductor-qwen-run/ckpt-arch-gov-27b-v35-resume2 /mnt/d/conductor-qwen-run/ckpt-arch-gov-27b-v35-resume-pathology-receipts /mnt/d/conductor-qwen-run/ckpt-arch-gov-27b-v35; do echo "== $d"; ls "$d" 2>/dev/null | grep checkpoint; done
