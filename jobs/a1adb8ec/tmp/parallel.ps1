$ErrorActionPreference='Continue'
foreach ($n in 'OLLAMA_NUM_PARALLEL','OLLAMA_MAX_QUEUE') {
  Write-Output ("BEFORE " + $n + " U=" + [Environment]::GetEnvironmentVariable($n,'User'))
}
[Environment]::SetEnvironmentVariable('OLLAMA_NUM_PARALLEL','4','User')
[Environment]::SetEnvironmentVariable('OLLAMA_MAX_QUEUE','256','User')
$p = Get-Process ollama -EA SilentlyContinue | Select-Object -First 1
$exe = (Get-Command ollama -EA SilentlyContinue).Source
if ($p) { try { $exe = $p.Path } catch {}; Stop-Process -Id $p.Id -Force; Start-Sleep -Seconds 5 }
Get-Process llama-server -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force }
Start-Sleep -Seconds 4
$env:OLLAMA_NUM_PARALLEL='4'; $env:OLLAMA_MAX_QUEUE='256'; $env:OLLAMA_KEEP_ALIVE='4h'
Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden
Start-Sleep -Seconds 14
Write-Output ("AFTER NUM_PARALLEL U=" + [Environment]::GetEnvironmentVariable('OLLAMA_NUM_PARALLEL','User'))
Write-Output ("OLLAMA_PID=" + (Get-Process ollama -EA SilentlyContinue | Select-Object -First 1).Id)
