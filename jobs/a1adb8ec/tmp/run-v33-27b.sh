source /root/cq-venv/bin/activate
cd /mnt/c/Users/marka/conductor-qwen-run
export UNSLOTH_CE_LOSS_TARGET_GB=0.5
python3 train_student_v33_27b.py --student a
echo EXIT-v33-27b=$?
