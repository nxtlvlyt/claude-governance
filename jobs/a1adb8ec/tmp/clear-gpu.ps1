$ErrorActionPreference='Continue'
Write-Output "--- before ---"
nvidia-smi --query-gpu=memory.used --format=csv,noheader
$p = Get-Process ollama -EA SilentlyContinue | Select-Object -First 1
$exe = $null; if ($p) { try { $exe = $p.Path } catch {} }
if (-not $exe) { $c = Get-Command ollama -EA SilentlyContinue; if ($c) { $exe = $c.Source } }
if ($p) { Stop-Process -Id $p.Id -Force }
Start-Sleep -Seconds 3
Get-Process llama-server -EA SilentlyContinue | ForEach-Object {
  Write-Output ("killing llama-server pid=" + $_.Id)
  Stop-Process -Id $_.Id -Force
}
Start-Sleep -Seconds 8
Write-Output "--- after kill ---"
nvidia-smi --query-gpu=memory.used --format=csv,noheader
$env:OLLAMA_KEEP_ALIVE='4h'
Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden
Start-Sleep -Seconds 14
Write-Output ("OLLAMA_PID=" + (Get-Process ollama -EA SilentlyContinue | Select-Object -First 1).Id)
