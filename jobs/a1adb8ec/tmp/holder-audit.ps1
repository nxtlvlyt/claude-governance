# Who could hold the VRAM squat? Windows-side candidates with start times and RAM.
$ErrorActionPreference = 'SilentlyContinue'
"=== ollama/llama/python/node processes ==="
Get-Process ollama*, llama*, python*, node* | ForEach-Object {
  "{0,8} {1,-22} start={2} ws={3}MB" -f $_.Id, $_.ProcessName, $_.StartTime, [int]($_.WorkingSet64/1MB)
}
"=== nvidia-smi compute apps (fresh read) ==="
nvidia-smi --query-compute-apps=pid,process_name --format=csv,noheader
"=== GPU used now ==="
nvidia-smi --query-gpu=memory.used --format=csv,noheader
