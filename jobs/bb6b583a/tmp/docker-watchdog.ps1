$logFile = 'C:\Scripts\docker-watchdog.log'
function Log($msg) { "$(Get-Date -Format o) $msg" | Out-File -Append -FilePath $logFile -Encoding utf8 }

if ((Get-Item $logFile -ErrorAction SilentlyContinue).Length -gt 2MB) {
    Remove-Item $logFile -Force -ErrorAction SilentlyContinue
}

$healthy = $false
try {
    $null = & docker info 2>$null
    if ($LASTEXITCODE -eq 0) { $healthy = $true }
} catch {
    $healthy = $false
}

if ($healthy) {
    exit 0
}

Log "UNHEALTHY: docker info failed"

$proc = Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue
if ($proc) {
    Log "Docker Desktop.exe process present but engine unresponsive -- leaving it (may still be starting), not relaunching"
    exit 0
}

Log "Docker Desktop.exe not running -- relaunching"
Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
Log "Launch issued"
