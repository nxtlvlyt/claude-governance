import paramiko, os, sys, time
LOCAL_DIR = r"E:\nas-recovery\muddytires"
os.makedirs(LOCAL_DIR, exist_ok=True)
OUT = os.path.join(LOCAL_DIR, "post-backup.tar")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.2.27", username="nxtlvl", password="Synlvl1!", timeout=20)
# plain tar (videos already compressed) of the muddytires post app, streamed to local file
cmd = "cd /mnt/recover1/web/web/vanlife/map && tar cf - post"
stdin, stdout, stderr = c.exec_command(cmd, timeout=900)
chan = stdout.channel
total = 0
t0 = time.time()
with open(OUT, "wb") as f:
    while True:
        data = stdout.read(1024 * 1024)
        if not data:
            break
        f.write(data)
        total += len(data)
err = stderr.read().decode(errors="replace").strip()
c.close()
mb = total / 1024 / 1024
print(f"DONE: wrote {mb:.1f} MB to {OUT} in {time.time()-t0:.0f}s")
if err:
    print("tar stderr:", err[:400])
# sanity: list the tar's top entries via local python tarfile
import tarfile
try:
    with tarfile.open(OUT) as t:
        names = t.getnames()
    print(f"VERIFIED tar: {len(names)} entries; sample:", names[:6])
except Exception as e:
    print("tar verify FAILED:", e)
