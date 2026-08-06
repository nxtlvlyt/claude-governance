# cgs-docker-guard.ps1 -- keeps the cgsports pipeline's Docker layer alive.
# Every 30 min (schtask cgs-docker-guard): probe the engine with a hard timeout;
# dead engine -> clear any wedged backend and relaunch Docker Desktop in the
# interactive session; engine up but DB container down -> docker start it.
# NEVER touches WSL distros -- model training runs in the Ubuntu distro on this box.
#
# Why this exists (2026-08-06): the July 29 reboot left Docker down. Every live
# loader run hung forever on `docker exec` reaching a dead engine, six schtasks
# piled up invisible zombie docker.exe processes for 8 days, and the Discord brief
# re-posted a frozen scoreboard the whole time. A wedged half-up backend (processes
# alive, npipe dead) also hangs plain `docker version`, so every probe here runs
# under a Start-Job timeout.

$log = "C:\Users\marka\cgsports-pipeline\logs\docker-guard.log"

function Log($m) {
    Add-Content -Path $log -Value "$(Get-Date -Format s) $m"
}

function Test-Engine {
    $probe = Start-Job { docker version --format "{{.Server.Version}}" 2>$null }
    $up = $false
    if (Wait-Job $probe -Timeout 20) {
        $v = Receive-Job $probe
        if ($v) { $up = $true }
    }
    Remove-Job $probe -Force -ErrorAction SilentlyContinue
    return $up
}

$engine = Test-Engine
if (-not $engine) {
    # Half-up backend? Kill it first -- but never one younger than 6 min (it may
    # still be starting up legitimately).
    $backend = Get-Process "com.docker.backend" -ErrorAction SilentlyContinue |
        Sort-Object StartTime | Select-Object -First 1
    if ($backend -and ((Get-Date) - $backend.StartTime).TotalMinutes -lt 6) {
        Log "engine down but backend only $([int]((Get-Date)-$backend.StartTime).TotalMinutes)m old -- startup in progress, waiting for next pass"
        exit 0
    }
    if ($backend) {
        Log "engine DOWN with stale backend (pid $($backend.Id)) -- clearing wedged processes"
        foreach ($n in "Docker Desktop", "com.docker.backend", "com.docker.build", "docker-sandbox") {
            Get-Process $n -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep 5
    } else {
        Log "engine DOWN, no backend running -- launching Docker Desktop"
    }
    # docker-desktop-interactive is a registered on-demand schtask that starts
    # Docker Desktop in the logged-on console session (session-0 launches wedge).
    schtasks /run /tn docker-desktop-interactive | Out-Null
    $deadline = (Get-Date).AddMinutes(4)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep 15
        if (Test-Engine) { $engine = $true; break }
    }
    Log "engine after relaunch: $engine"
}

if ($engine) {
    $state = docker inspect cgsports-v2-db --format "{{.State.Status}}" 2>$null
    if ($state -ne "running") {
        Log "cgsports-v2-db state='$state' -> docker start"
        docker start cgsports-v2-db 2>&1 | Out-Null
        $state2 = docker inspect cgsports-v2-db --format "{{.State.Status}}" 2>$null
        Log "cgsports-v2-db now: $state2"
    }
} else {
    Log "engine still down after relaunch window -- next pass retries"
}
