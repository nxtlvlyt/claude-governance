pkill -f train_student_generic.py; pkill -f train-v35.sh; sleep 6
cp -r /mnt/d/conductor-qwen-run/ckpt-arch-gov-27b-v35-resume2/checkpoint-240 /mnt/d/conductor-qwen-run/ckpt-arch-gov-27b-v35/ 2>/dev/null
ls /mnt/d/conductor-qwen-run/ckpt-arch-gov-27b-v35/
pgrep -fc "train_student|train-v35" || echo CLEAR
