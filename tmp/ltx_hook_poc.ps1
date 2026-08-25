# PoC: LTX 2.3 animates the textless thumbnail art into a ~5s hook clip
$ErrorActionPreference = 'Stop'
$wf = Get-Content 'E:\AI_Storage\_repo_read\nxtlvl-portal\api\workflows\ltx23-i2v-v2.json' -Raw | ConvertFrom-Json
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\Users\marka\.claude\tmp\thumb-v2-raw.png'))
$wf.'269'.inputs.base64_string = $b64
$wf.'267:266'.inputs.value = 'Cinematic slow camera push-in on a cracked silver robot head with glowing green eyes. Green healing lightning crackles and arcs across the cracks in its head, energy sparks orbit slowly, the glowing green plus icon beside it pulses with light. Dark moody studio, dramatic teal accent lighting, subtle drifting smoke, photorealistic 3D render style, sharp focus.'
$wf.'267:257'.inputs.value = 768
$wf.'267:258'.inputs.value = 448
$wf.'267:216'.inputs.noise_seed = 11
$wf.'267:237'.inputs.noise_seed = 12
$body = @{ prompt = $wf } | ConvertTo-Json -Depth 12 -Compress
$resp = Invoke-RestMethod 'http://localhost:8188/prompt' -Method POST -Body $body -ContentType 'application/json'
$id = $resp.prompt_id
Write-Host "queued: $id"
$deadline = (Get-Date).AddMinutes(25)
while ((Get-Date) -lt $deadline) {
  Start-Sleep 10
  try {
    $h = Invoke-RestMethod "http://localhost:8188/history/$id" -TimeoutSec 10
    $entry = $h.$id
    if ($entry -and $entry.status.completed) {
      $vid = $entry.outputs.'75'.images + $entry.outputs.'75'.videos + $entry.outputs.'75'.gifs | Where-Object { $_ } | Select-Object -First 1
      if (-not $vid) { Write-Host "no output node payload: $($entry.outputs | ConvertTo-Json -Depth 4 -Compress)"; exit 1 }
      $url = "http://localhost:8188/view?filename=$($vid.filename)&subfolder=$($vid.subfolder)&type=$($vid.type)"
      Invoke-WebRequest $url -OutFile 'C:\Users\marka\.claude\tmp\ltx-hook-raw.mp4' -TimeoutSec 60
      Write-Host "GEN DONE: $([math]::Round((Get-Item 'C:\Users\marka\.claude\tmp\ltx-hook-raw.mp4').Length/1MB,1))MB"
      # compose: scale to 1280x720-ish canvas, overlay STABLE title, replace audio with the original video's first 5s
      $FONT = "fontfile='C\:/Windows/Fonts/impact.ttf':fontsize=80:fontcolor=white:borderw=7:bordercolor=black"
      $vf = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,drawtext=text='CLAUDE 20HR AUTONOMOUS RUN':${FONT}:x=(w-tw)/2:y=h-194,drawtext=text='SELF-HEALING AI AGENT':${FONT}:x=(w-tw)/2:y=h-102"
      ffmpeg -hide_banner -loglevel error -y -i 'C:\Users\marka\.claude\tmp\ltx-hook-raw.mp4' -i 'N:\web\vanlife\map\post\queue\20260612034222-iot1l2\out\joined-full.mp4' -filter_complex "[0:v]$vf[v]" -map '[v]' -map 1:a -t 4.8 -c:v h264_nvenc -preset p5 -b:v 10M -c:a aac 'C:\Users\marka\.claude\tmp\ltx-hook-final.mp4'
      Write-Host "COMPOSED: ltx-hook-final.mp4 ($([math]::Round((Get-Item 'C:\Users\marka\.claude\tmp\ltx-hook-final.mp4').Length/1MB,1))MB)"
      exit 0
    }
    if ($entry -and $entry.status.status_str -eq 'error') { Write-Host "COMFY ERROR: $($entry.status.messages | ConvertTo-Json -Depth 5 -Compress)"; exit 1 }
  } catch { Write-Host "poll: $($_.Exception.Message)" }
}
Write-Host 'TIMEOUT after 25 min'
exit 1
