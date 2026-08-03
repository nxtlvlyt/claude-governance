#!/usr/bin/env bash
# Two questions, both currently answered only by assumption:
#
# Q1. Are the cloud teachers actually working? The first probe read message.content and got
#     "". But ~/.claude/.../memory/ollama-cloud-gemini-vision.md records that kimi-k2.6 puts
#     its answer in message.reasoning and leaves content empty. So the probe may have been
#     the broken instrument, not the model. Read BOTH fields and dump raw keys.
#
# Q2. Is the control benchmark alive or stalled? 0 rows after 11 minutes with no multi_turn
#     directory. The tuned run's progress bar also read 0/200 while holding 109 rows, so the
#     bar proves nothing either way. Check for ACTUAL inference: GPU busy, request in flight,
#     process CPU time advancing.
set -uo pipefail
OLLAMA=http://172.30.144.1:11434

echo "############ Q1: cloud teacher, reading content AND reasoning ############"
for M in kimi-k2.6:cloud glm-5.2:cloud; do
  echo "--- $M ---"
  curl -s -m 240 "$OLLAMA/api/chat" -d "{
    \"model\":\"$M\",
    \"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly: READY\"}],
    \"stream\":false,
    \"options\":{\"num_predict\":16}
  }" | python3 -c '
import sys, json
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except Exception:
    print("  NON-JSON:", raw[:300]); raise SystemExit
if "error" in d:
    print("  ERROR:", str(d["error"])[:300]); raise SystemExit
msg = d.get("message") or {}
print("  message keys :", list(msg.keys()))
print("  content      :", repr((msg.get("content") or "")[:120]))
print("  reasoning    :", repr((msg.get("reasoning") or "")[:120]))
print("  done_reason  :", d.get("done_reason"))
print("  eval_count   :", d.get("eval_count"), " prompt:", d.get("prompt_eval_count"))
'
done

echo
echo "############ Q2: is the control benchmark actually inferring? ############"
echo "--- ollama /api/ps ---"
curl -s "$OLLAMA/api/ps" | python3 -c '
import sys, json
for m in (json.load(sys.stdin).get("models") or []):
    print("  %-28s vram=%.1fGB expires=%s" % (m.get("name"), (m.get("size_vram") or 0)/1e9, m.get("expires_at")))
'

echo "--- bfcl process CPU time (sample twice, 20s apart) ---"
P=$(pgrep -f "bfcl generate" | head -1)
if [ -z "${P:-}" ]; then
  echo "  NO bfcl generate PROCESS - the run died."
else
  T1=$(ps -o cputime= -p "$P" | tr -d ' ')
  echo "  pid=$P cputime@t0=$T1"
  sleep 20
  T2=$(ps -o cputime= -p "$P" | tr -d ' ')
  echo "  pid=$P cputime@t20=$T2"
  [ "$T1" = "$T2" ] && echo "  -> CPU NOT advancing (blocked on network I/O, which is expected while waiting on Ollama)" \
                    || echo "  -> CPU advancing"
fi

echo "--- established connections from bfcl to ollama ---"
ss -tnp 2>/dev/null | grep -c 11434 || echo 0

echo "--- any result file anywhere for the control ---"
find /root/bfclproj/result -name '*multi_turn*' -path '*qwen*' 2>/dev/null || echo "  none yet"

echo "--- inference_log / partial output dir ---"
ls -la /root/bfclproj/result/qwen3.6-27b-base/ 2>/dev/null

echo "--- last 3 lines of launcher log ---"
tail -3 /root/bfclproj/serial-multiturn.log
