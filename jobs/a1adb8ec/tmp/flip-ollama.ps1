$ErrorActionPreference='Continue'
# re-verify at flip time: new pulls may have landed on E: during the copy
$s=(Get-ChildItem 'E:\ollama\models' -Recurse -File -EA SilentlyContinue | Measure-Object -Sum Length)
$d=(Get-ChildItem 'D:\ollama\models' -Recurse -File -EA SilentlyContinue | Measure-Object -Sum Length)
Write-Output ("PREFLIGHT src=" + $s.Count + "/" + $s.Sum + "  dst=" + $d.Count + "/" + $d.Sum)
if ($s.Count -ne $d.Count -or $s.Sum -ne $d.Sum) { Write-Output "ABORT-DRIFT-SINCE-COPY"; exit 1 }
$p = Get-Process ollama -EA SilentlyContinue | Select-Object -First 1
$exe = $null; if ($p) { try { $exe = $p.Path } catch {} }
if (-not $exe) { $c = Get-Command ollama -EA SilentlyContinue; if ($c) { $exe = $c.Source } }
if (-not $exe) { Write-Output "ABORT-NO-EXE"; exit 1 }
if ($p) { Stop-Process -Id $p.Id -Force; Start-Sleep -Seconds 5; Write-Output "OLLAMA-STOPPED" }
[Environment]::SetEnvironmentVariable('OLLAMA_MODELS','D:\ollama\models','Machine')
$env:OLLAMA_MODELS='D:\ollama\models'
Write-Output ("ENV-SET Machine=" + [Environment]::GetEnvironmentVariable('OLLAMA_MODELS','Machine'))
Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden
Start-Sleep -Seconds 12
$now = Get-Process ollama -EA SilentlyContinue | Select-Object -First 1
if ($now) { Write-Output ("RESTARTED pid=" + $now.Id) } else { Write-Output "FAILED-TO-START" }
