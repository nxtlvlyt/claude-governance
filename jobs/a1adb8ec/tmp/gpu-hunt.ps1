$ErrorActionPreference='Continue'
Write-Output ("VRAM_NOW=" + (nvidia-smi --query-gpu=memory.used --format=csv,noheader))
Write-Output "--- shutting down WSL (BFCL/torch may hold a CUDA context) ---"
wsl --shutdown
Start-Sleep -Seconds 10
Write-Output ("VRAM_AFTER_WSL_SHUTDOWN=" + (nvidia-smi --query-gpu=memory.used --format=csv,noheader))
Write-Output "--- stopping ollama + any llama-server ---"
Get-Process ollama,llama-server -EA SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force }
Start-Sleep -Seconds 8
Write-Output ("VRAM_AFTER_OLLAMA_KILL=" + (nvidia-smi --query-gpu=memory.used --format=csv,noheader))
