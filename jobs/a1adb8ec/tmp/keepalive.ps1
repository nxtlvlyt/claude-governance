$ErrorActionPreference='Continue'
[Environment]::SetEnvironmentVariable('OLLAMA_KEEP_ALIVE','4h','Machine')
[Environment]::SetEnvironmentVariable('OLLAMA_MAX_LOADED_MODELS','1','Machine')
$p = Get-Process ollama -EA SilentlyContinue | Select-Object -First 1
$exe = $null; if ($p) { try { $exe = $p.Path } catch {} }
if (-not $exe) { $c = Get-Command ollama -EA SilentlyContinue; if ($c) { $exe = $c.Source } }
if ($p) { Stop-Process -Id $p.Id -Force; Start-Sleep -Seconds 5 }
$env:OLLAMA_KEEP_ALIVE='4h'; $env:OLLAMA_MAX_LOADED_MODELS='1'
Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden
Start-Sleep -Seconds 12
Write-Output ("KEEP_ALIVE=" + [Environment]::GetEnvironmentVariable('OLLAMA_KEEP_ALIVE','Machine'))
Write-Output ("OLLAMA_PID=" + (Get-Process ollama -EA SilentlyContinue | Select-Object -First 1).Id)
