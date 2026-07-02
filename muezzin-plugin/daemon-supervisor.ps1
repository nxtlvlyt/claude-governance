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

    # APPEND, never overwrite (2026-07-02): Start-Process -RedirectStandardOutput TRUNCATES on
    # every respawn — the dying daemon's final output (the death evidence) was destroyed by the
    # restart that followed it (live receipt: 18:09 exit-1 death, stderr empty, cause unrecoverable).
    # cmd /c with >> preserves every generation's output in one continuous log.
    $p = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "node muezzin-daemon.mjs >> `"$(Join-Path $logDir 'daemon-stdout.log')`" 2>> `"$(Join-Path $logDir 'daemon-stderr.log')`"" `
        -WorkingDirectory "C:\Users\marka\.claude\muezzin-plugin" `
        -PassThru -NoNewWindow -Wait

    $ts = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'

    # EXIT 3 = SINGLETON-BLOCKED (2026-07-02): another daemon already owns the substrate — this
    # supervisor is redundant. Restarting would loop forever (live receipt: 3s exit-0 spawn loop,
    # ~45 iterations, 10:09-10:12 local). Exit quietly; do NOT write the halt marker (the real
    # daemon is healthy — a halt marker would scare the next conductor into a false diagnosis).
    if ($p.ExitCode -eq 3) {
        Add-Content -Path (Join-Path $logDir "supervisor.log") -Value "$ts SUPERVISOR singleton held by another daemon (exit 3) -- this supervisor is redundant, exiting without restart"
        break
    }

    Add-Content -Path (Join-Path $logDir "supervisor.log") -Value "$ts SUPERVISOR daemon exited (code $($p.ExitCode)) -- restarting"

    # @(...) both sides: a 1-element pipeline result unrolls to a scalar DateTime, after which
    # `+=` silently errors (DateTime arithmetic) under ErrorActionPreference=Continue and .Count
    # froze at 1 forever -- the 5-in-10min halt NEVER fired (live receipt: ~45 deaths, 0 halts).
    $deaths = @($deaths) + (Get-Date)
    $deaths = @($deaths | Where-Object { $_ -gt (Get-Date).AddMinutes(-10) })
    if ($deaths.Count -gt 5) {
        Add-Content -Path (Join-Path $logDir "supervisor.log") -Value "$ts SUPERVISOR HALTED -- 5+ deaths in 10 minutes, crash-loop suspected, not restarting further"
        Set-Content -Path $haltMarker -Value "Halted $ts -- daemon died $($deaths.Count) times in 10 minutes. Diagnose before restarting manually."
        break
    }
    Start-Sleep -Seconds 3
}
