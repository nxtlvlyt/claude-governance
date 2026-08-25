import paramiko, os, time
LOCAL = r"E:\nas-recovery\muddytires"
os.makedirs(LOCAL, exist_ok=True)
OUT = os.path.join(LOCAL, "public-site-backup.tar")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.2.27", username="nxtlvl", password="Synlvl1!", timeout=20)
# full public site, EXCLUDING the already-backed-up post videos (map/post)
cmd = "cd /mnt/recover1/web/web/vanlife && tar cf - --exclude=./map/post --exclude=./.venv ."
_, stdout, stderr = c.exec_command(cmd, timeout=600)
total = 0; t0 = time.time()
with open(OUT, "wb") as f:
    while True:
        d = stdout.read(1024*1024)
        if not d: break
        f.write(d); total += len(d)
err = stderr.read().decode(errors="replace").strip()
c.close()
print(f"DONE: wrote {total/1024/1024:.1f} MB to {OUT} in {time.time()-t0:.0f}s")
if err: print("stderr:", err[:300])
import tarfile
with tarfile.open(OUT) as t:
    names = t.getnames()
print(f"VERIFIED: {len(names)} entries; sample:", names[:8])
