# daemon-supervisor.ps1 — built 2026-07-01 after diagnosing a real, repeating incident:
# conduct-cycle.mjs's STUCK-TASK healer (its own 5-min auto-heal cadence, running inside
# the daemon's own process) issues `taskkill /PID <daemon's own PID> /F /T` as its remedy
# for a stuck lane -- there is no separate per-mission subprocess to kill, missions run
# in-process, so the "fix" is to kill the whole daemon. Nothing was restarting it
# afterward -- it died twice in ~35 minutes and stayed dead until a human/conductor beat
# noticed. This wraps the daemon in a restart loop so a self-kill is a few-second blip,
# not an unattended outage. Root design gap (STUCK-TASK killing the wrong scope) is
# still real and separately worth fixing in conduct-cycle.mjs -- this is the safety net,
# not the fix to the healer itself.
#
# Rate-limited: if the daemon dies more than 5 times in 10 minutes, stop restarting and
# write a clear halt marker -- a crash-looping daemon burning cycles unattended is worse
# than a dead one.

$ErrorActionPreference = 'Continue'
$logDir = "C:\Users\marka\.claude\muezzin-plugin\missions\_logs"
$haltMarker = Join-Path $logDir "supervisor-halted.txt"
if (Test-Path $haltMarker) { Remove-Item $haltMarker -Force }

$deaths = @()

while ($true) {
    $env:MUEZZIN_ARCHITECT_ROUTE = 'panel'
    $env:MUEZZIN_MAX_LANES = '1'
    $ts = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'
    Add-Content -Path (Join-Path $logDir "supervisor.log") -Value "$ts SUPERVISOR starting daemon"

    $p = Start-Process -FilePath "node" -ArgumentList "muezzin-daemon.mjs" `
        -WorkingDirectory "C:\Users\marka\.claude\muezzin-plugin" `
        -RedirectStandardOutput (Join-Path $logDir "daemon-stdout.log") `
        -RedirectStandardError (Join-Path $logDir "daemon-stderr.log") `
        -PassThru -NoNewWindow -Wait

    $ts = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'
    Add-Content -Path (Join-Path $logDir "supervisor.log") -Value "$ts SUPERVISOR daemon exited (code $($p.ExitCode)) -- restarting"

    $deaths += (Get-Date)
    $deaths = $deaths | Where-Object { $_ -gt (Get-Date).AddMinutes(-10) }
    if ($deaths.Count -gt 5) {
        Add-Content -Path (Join-Path $logDir "supervisor.log") -Value "$ts SUPERVISOR HALTED -- 5+ deaths in 10 minutes, crash-loop suspected, not restarting further"
        Set-Content -Path $haltMarker -Value "Halted $ts -- daemon died $($deaths.Count) times in 10 minutes. Diagnose before restarting manually."
        break
    }
    Start-Sleep -Seconds 3
}
