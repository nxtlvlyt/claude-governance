# PoC: qwen-image-edit de-glares the operator's real thumbnail via ComfyUI API
$ErrorActionPreference = 'Stop'
$wf = Get-Content 'E:\AI_Storage\_repo_read\nxtlvl-portal\api\workflows\qwen-edit-2511.json' -Raw | ConvertFrom-Json
$srcPath = 'N:\web\vanlife\map\post\queue\20260612034222-iot1l2\out\thumb-youtube-01.jpg'
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($srcPath))
$wf.'4'.inputs.base64_string = $b64
$wf.'6'.inputs.prompt = 'Remove the glare and reflections from the monitor screen. Make the on-screen text crisp, sharp and readable. Increase contrast and color vibrancy. Add dramatic moody lighting around the monitor, like a high-end tech YouTube thumbnail. Keep the screen content and composition exactly the same.'
$wf.'13'.inputs.seed = 42
$body = @{ prompt = $wf } | ConvertTo-Json -Depth 10 -Compress
$resp = Invoke-RestMethod 'http://localhost:8188/prompt' -Method POST -Body $body -ContentType 'application/json'
$pid2 = $resp.prompt_id
Write-Host "queued: $pid2"
$deadline = (Get-Date).AddMinutes(8)
while ((Get-Date) -lt $deadline) {
  Start-Sleep 5
  try {
    $h = Invoke-RestMethod "http://localhost:8188/history/$pid2" -TimeoutSec 10
    $entry = $h.$pid2
    if ($entry -and $entry.status.completed) {
      $img = $entry.outputs.'15'.images[0]
      $url = "http://localhost:8188/view?filename=$($img.filename)&subfolder=$($img.subfolder)&type=$($img.type)"
      Invoke-WebRequest $url -OutFile 'C:\Users\marka\.claude\tmp\thumb-deglare-poc.png' -TimeoutSec 30
      Write-Host "DONE: C:\Users\marka\.claude\tmp\thumb-deglare-poc.png ($([math]::Round((Get-Item 'C:\Users\marka\.claude\tmp\thumb-deglare-poc.png').Length/1KB))KB)"
      exit 0
    }
    if ($entry -and $entry.status.status_str -eq 'error') { Write-Host "COMFY ERROR: $($entry.status.messages | ConvertTo-Json -Depth 5 -Compress)"; exit 1 }
  } catch { Write-Host "poll: $($_.Exception.Message)" }
}
Write-Host 'TIMEOUT after 8 min'
exit 1
