$ErrorActionPreference='Continue'
[Environment]::SetEnvironmentVariable('OLLAMA_NUM_PARALLEL','1','User')
$p = Get-Process ollama -EA SilentlyContinue | Select-Object -First 1
$exe = (Get-Command ollama -EA SilentlyContinue).Source
if ($p) { try { $exe = $p.Path } catch {}; Stop-Process -Id $p.Id -Force; Start-Sleep -Seconds 5 }
Get-Process llama-server -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force }
Start-Sleep -Seconds 4
$env:OLLAMA_NUM_PARALLEL='1'; $env:OLLAMA_KEEP_ALIVE='4h'
Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden
Start-Sleep -Seconds 20
Write-Output ("NUM_PARALLEL=" + [Environment]::GetEnvironmentVariable('OLLAMA_NUM_PARALLEL','User') + " PID=" + (Get-Process ollama -EA SilentlyContinue | Select-Object -First 1).Id)
