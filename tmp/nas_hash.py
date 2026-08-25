import paramiko
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('192.168.2.27', username='nxtlvl', password='Synlvl1!', timeout=10)
cmd = """echo 'Synlvl1!' | sudo -S /usr/local/bin/docker exec urmomis-php php -r "echo password_hash('muddy-goose-2026', PASSWORD_DEFAULT);" 2>/dev/null"""
_, o, e = c.exec_command(cmd)
print(o.read().decode().strip())
c.close()
