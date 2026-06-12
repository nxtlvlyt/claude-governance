# PoC #2: Flux2-Klein composed thumbnail from the video's content (operator's Gemini-bar)
$ErrorActionPreference = 'Stop'
$wf = Get-Content 'E:\AI_Storage\_repo_read\nxtlvl-portal\api\workflows\flux-txt2img.json' -Raw | ConvertFrom-Json
$wf.'2'.inputs.text = 'YouTube thumbnail, dramatic cinematic shot: a glowing computer monitor in a dark moody studio displaying a clean futuristic AI terminal interface with streams of code, an ethereal glowing neural-network brain hologram floating above the keyboard, teal and green neon accent lighting, sparks of energy, ultra sharp, high contrast, professional tech-channel thumbnail composition with empty space at the bottom left for a headline'
$wf.'4'.inputs.width = 1280
$wf.'4'.inputs.height = 720
$wf.'5'.inputs.seed = 7
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
      $img = $entry.outputs.'7'.images[0]
      $url = "http://localhost:8188/view?filename=$($img.filename)&subfolder=$($img.subfolder)&type=$($img.type)"
      Invoke-WebRequest $url -OutFile 'C:\Users\marka\.claude\tmp\thumb-flux-poc.png' -TimeoutSec 30
      $FONT = "fontfile='C\:/Windows/Fonts/impact.ttf':fontsize=92:fontcolor=white:borderw=7:bordercolor=black"
      $draw = "drawtext=text='CLAUDE 20HR AUTONOMOUS RUN':${FONT}:x=44:y=h-220,drawtext=text='SELF-HEALING AI AGENT':${FONT}:x=44:y=h-118"
      ffmpeg -hide_banner -loglevel error -y -i 'C:\Users\marka\.claude\tmp\thumb-flux-poc.png' -vf $draw -q:v 2 'C:\Users\marka\.claude\tmp\thumb-flux-titled.jpg'
      Write-Host "DONE: thumb-flux-titled.jpg"
      exit 0
    }
    if ($entry -and $entry.status.status_str -eq 'error') { Write-Host "COMFY ERROR: $($entry.status.messages | ConvertTo-Json -Depth 5 -Compress)"; exit 1 }
  } catch { Write-Host "poll: $($_.Exception.Message)" }
}
Write-Host 'TIMEOUT after 8 min'
exit 1
