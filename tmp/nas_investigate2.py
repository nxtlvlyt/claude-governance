import sys, paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.2.27", username="nxtlvl", password="Synlvl1!", timeout=20)
def run(cmd, t=40):
    _, o, e = c.exec_command(cmd, timeout=t)
    return (o.read()+e.read()).decode(errors="replace")
print("=== cloudflared tunnel routes ===")
print(run("cat /mnt/recover1/docker/cloudflared/config.yml 2>&1"))
print("=== vanlife/ contents (public muddytires.ca) ===")
print(run("ls -la /mnt/recover1/web/web/vanlife/ 2>&1 | head -30"))
print("=== DB usage in the site? ===")
print(run("grep -rlE 'mysqli|PDO|pg_connect' /mnt/recover1/web/web/vanlife/ 2>/dev/null | head -10"))
c.close()
