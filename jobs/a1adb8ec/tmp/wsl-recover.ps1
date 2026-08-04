# Recover from the orphaned-WSL-VM failure and restart the benchmark.
#
# SIGNATURE (documented in ~/.claude/.../memory/nxtbeast-wsl-orphaned-vm.md, written earlier
# in this same project):
#     wsl -d Ubuntu        -> Wsl/Service/CreateInstance/MountDisk/HCS/E_ACCESSDENIED
#     wsl --list --running -> "There are no running distributions."
# An orphaned vmmemWSL still holds D:\WSL\Ubuntu\ext4.vhdx, so a fresh attach is denied.
#
# `wsl --shutdown` is safe HERE specifically because WSL reports no running distribution -
# the benchmark inside it is already dead. It would NOT be safe while a job was running, which
# is why this checks first rather than applying the remembered fix reflexively.
#
# Banked rows live inside the vhdx and survive the shutdown.

$ssh = "C:\WINDOWS\System32\OpenSSH\ssh.exe"

Write-Output "=== 1. confirm the orphan: wsl says nothing running, but VM processes are alive ==="
& $ssh -o ConnectTimeout=30 nxtbeast 'powershell -NoProfile -Command "Get-Process vmmem*,wsl* -ErrorAction SilentlyContinue | ForEach-Object { $_.Name + '' pid='' + $_.Id }"' 2>&1 |
    ForEach-Object { "  $_" }

Write-Output ""
Write-Output "=== 2. wsl --shutdown ==="
& $ssh -o ConnectTimeout=60 nxtbeast "wsl --shutdown" 2>&1 | ForEach-Object { "  $_" }
Write-Output "  (waiting 10s for teardown)"
Start-Sleep -Seconds 10

Write-Output ""
Write-Output "=== 3. retry attach, and confirm banked rows survived ==="
$out = & $ssh -o ConnectTimeout=120 nxtbeast "wsl -d Ubuntu -- bash -lc 'echo WSL_OK; echo -n ""rows: ""; wc -l < /root/bfclproj/result/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json; echo -n ""typeA corpus: ""; wc -l < /mnt/c/Users/marka/conductor-qwen/phase4/train-v34.jsonl'" 2>&1
$out | Where-Object { $_ -notmatch 'screen size' } | ForEach-Object { "  $_" }

Write-Output ""
Write-Output "=== 4. relaunch detached if WSL recovered ==="
if ($out -match "WSL_OK") {
    & $ssh -o ConnectTimeout=120 nxtbeast "wsl -d Ubuntu -- bash /mnt/c/Users/marka/launch-detached.sh" 2>&1 |
        Where-Object { $_ -notmatch 'screen size' } | ForEach-Object { "  $_" }
} else {
    Write-Output "  WSL did NOT recover - not relaunching. Manual attention needed."
}
