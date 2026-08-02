$ErrorActionPreference = 'Continue'
$p = Get-Process ollama -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $p) { Write-Output "NO-OLLAMA-RUNNING"; }
$exe = $null
if ($p) { try { $exe = $p.Path } catch {} }
if (-not $exe) { $c = Get-Command ollama -ErrorAction SilentlyContinue; if ($c) { $exe = $c.Source } }
Write-Output ("EXE=" + $exe)
if (-not $exe) { Write-Output "ABORT-NO-EXE-PATH"; exit 1 }
if ($p) { Stop-Process -Id $p.Id -Force; Start-Sleep -Seconds 4; Write-Output "STOPPED" }
Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden
Start-Sleep -Seconds 8
$now = Get-Process ollama -ErrorAction SilentlyContinue | Select-Object -First 1
if ($now) { Write-Output ("RESTARTED-PID=" + $now.Id) } else { Write-Output "FAILED-TO-START" }
