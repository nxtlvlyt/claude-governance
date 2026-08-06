pgrep -fc train_student_generic.py
nvidia-smi --query-gpu=memory.used,utilization.gpu --format=csv,noheader
PID=$(pgrep -f train_student_generic.py | sort -n | tail -1)
echo "pid=$PID cpu=$(ps -o %cpu= -p $PID 2>/dev/null)"
/root/cq-venv/bin/py-spy dump --pid $PID 2>&1 | grep -B1 -A8 "Thread.*active" | head -22
