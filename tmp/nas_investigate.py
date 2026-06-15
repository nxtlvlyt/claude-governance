import paramiko
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.2.27", username="nxtlvl", password="Synlvl1!", timeout=20)
def run(cmd, t=40):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode(errors="replace") + e.read().decode(errors="replace")
print("=== is RO mount still alive? ===")
print(run("mount | grep recover1 || echo NOT_MOUNTED"))
print("=== web/web structure (read-only) ===")
print(run("ls -la /mnt/recover1/web/web/ 2>&1 | head -40"))
print("=== docker volumes / cloudflared config (read-only search) ===")
print(run("find /mnt/recover1 -maxdepth 4 \\( -iname 'config.yml' -o -iname 'docker-compose*' -o -iname '*cloudflared*' \\) 2>/dev/null | head -25"))
c.close()
