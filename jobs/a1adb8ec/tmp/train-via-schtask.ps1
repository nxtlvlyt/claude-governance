# Launch v3.4 training as a WINDOWS SCHEDULED TASK on nxtbeast, so it is owned by the Task
# Scheduler service and not by any ssh connection.
#
# WHY, WITH RECEIPTS FROM TODAY
#   setsid nohup (PIPELINE.md:23)  -> died within minutes, 6 times (chain x5, training x1)
#   held foreground ssh            -> ran 5h for the FC lane, BUT died at 27% of training the
#                                     moment the local Bash task was killed
# Both are tethered to my session. Local tasks in this environment get killed often — that is
# observed, not hypothetical — and each kill has taken the remote job with it.
#
# A scheduled task is owned by Windows. It survives ssh drops, local task kills, and the
# session ending entirely. This is the only launch mode not tied to something that has
# already proven unreliable.
#
# The task runs once, immediately, then deletes itself. Output goes to a log inside WSL.

$ssh = "C:\WINDOWS\System32\OpenSSH\ssh.exe"
$taskName = "cq-train-v34"

Write-Output "=== is a checkpoint recoverable from the 27% run? ==="
& $ssh -o ConnectTimeout=40 nxtbeast "wsl -d Ubuntu -- ls -la /mnt/d/conductor-qwen-run/ckpt-arch-gov-27b-v34" 2>&1 |
    Where-Object { $_ -notmatch 'screen size' } | ForEach-Object { "  $_" }

Write-Output ""
Write-Output "=== remove any prior task with this name ==="
& $ssh -o ConnectTimeout=40 nxtbeast "schtasks /delete /tn $taskName /f" 2>&1 |
    ForEach-Object { "  $_" }

Write-Output ""
Write-Output "=== create the task (runs once, 1 min from now, highest privileges) ==="
# /sc ONCE with a start time a minute ahead; /ru SYSTEM so it needs no interactive session.
$when = (Get-Date).AddMinutes(1).ToString("HH:mm")
$cmd = "schtasks /create /tn $taskName /tr `"wsl -d Ubuntu -- bash /mnt/c/Users/marka/train-now.sh`" /sc ONCE /st $when /ru SYSTEM /rl HIGHEST /f"
& $ssh -o ConnectTimeout=60 nxtbeast $cmd 2>&1 | ForEach-Object { "  $_" }

Write-Output ""
Write-Output "=== run it immediately rather than waiting for the clock ==="
& $ssh -o ConnectTimeout=60 nxtbeast "schtasks /run /tn $taskName" 2>&1 | ForEach-Object { "  $_" }

Start-Sleep -Seconds 25

Write-Output ""
Write-Output "=== verify it is actually running (task state + the process itself) ==="
& $ssh -o ConnectTimeout=40 nxtbeast "schtasks /query /tn $taskName /fo LIST" 2>&1 |
    Where-Object { $_ -match 'Status|TaskName|Last Result|Next Run' } | ForEach-Object { "  $_" }
& $ssh -o ConnectTimeout=60 nxtbeast "wsl -d Ubuntu -- bash /mnt/c/Users/marka/train-check.sh" 2>&1 |
    Where-Object { $_ -notmatch 'screen size' } | Select-Object -First 10 | ForEach-Object { "  $_" }
