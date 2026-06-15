import sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.2.27", username="nxtlvl", password="Synlvl1!", timeout=20)
def run(cmd, t=60):
    _, o, e = c.exec_command(cmd, timeout=t)
    return (o.read()+e.read()).decode(errors="replace")
print("=== public site = vanlife minus post (the map code). size of vanlife excluding post: ===")
print(run("du -sh /mnt/recover1/web/web/vanlife 2>/dev/null; echo '--- post (already backed up):'; du -sh /mnt/recover1/web/web/vanlife/map/post 2>/dev/null"))
print("=== top of vanlife (what the public site is made of) ===")
print(run("ls -la /mnt/recover1/web/web/vanlife/ 2>&1 | head -40"))
print("=== nxtlvl.studio dir too (other public site) ===")
print(run("ls -la /mnt/recover1/web/web/nxtlvl.studio/ 2>&1 | head -20"))
c.close()
