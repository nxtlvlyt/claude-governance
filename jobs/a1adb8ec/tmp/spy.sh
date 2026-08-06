PID=$(pgrep -f train_student_generic.py | sort -n | tail -1)
echo "pid=$PID cpu=$(ps -o %cpu= -p $PID)"
/root/cq-venv/bin/py-spy dump --pid $PID 2>&1 | grep -A6 "Thread.*active\|MainThread"| head -14
