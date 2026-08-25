# End-to-end chunked-upload test through the LIVE Cloudflare URL (the operator's exact 413 path)
$base = 'https://muddytires.ca/post'
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
# login
Invoke-WebRequest "$base/index.php" -Method POST -Body @{passcode='muddy-goose-2026'} -WebSession $s -UseBasicParsing | Out-Null
$batch = "cftest-$(Get-Date -Format 'HHmmss')"
Invoke-WebRequest "$base/chunk.php?act=start&batch=$batch" -Method POST -WebSession $s -UseBasicParsing | Out-Null
$f = [System.IO.File]::OpenRead("$env:TEMP\big-test.mp4")
$CHUNK = 16MB; $buf = New-Object byte[] $CHUNK; $i = 0; $total = 0
while (($n = $f.Read($buf, 0, $CHUNK)) -gt 0) {
  $body = if ($n -eq $CHUNK) { $buf } else { $buf[0..($n-1)] }
  $r = Invoke-WebRequest "$base/chunk.php?act=chunk&batch=$batch&file=0&idx=$i&ext=mp4" -Method POST -Body $body -ContentType 'application/octet-stream' -WebSession $s -UseBasicParsing
  $total += $n; Write-Host "chunk $i ok ($([math]::Round($total/1MB))MB sent)"
  $i++
}
$f.Close()
Invoke-WebRequest "$base/chunk.php?act=filedone&batch=$batch&file=0&ext=mp4" -Method POST -WebSession $s -UseBasicParsing | Out-Null
$fin = Invoke-WebRequest "$base/chunk.php?act=finalize&batch=$batch" -Method POST -Body @{blurb='cloudflare 413 fix verification'; property='auto'} -WebSession $s -UseBasicParsing
Write-Host "finalize: $($fin.Content)"
$assembled = Get-Item "N:\web\vanlife\map\post\queue\$batch\00.mp4" -ErrorAction SilentlyContinue
Write-Host "assembled on NAS: $([math]::Round($assembled.Length/1MB,1))MB (matches source: $($assembled.Length -eq (Get-Item "$env:TEMP\big-test.mp4").Length))"
