$ErrorActionPreference='Continue'
$exe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
if (-not (Test-Path $exe)) { Write-Output "NO-DOCKER-DESKTOP-EXE"; exit 1 }
if (Get-Process 'Docker Desktop' -EA SilentlyContinue) { Write-Output "ALREADY-RUNNING" } else {
  Start-Process -FilePath $exe -WindowStyle Hidden
  Write-Output "LAUNCHED"
}
for ($i=0; $i -lt 24; $i++) {
  Start-Sleep -Seconds 10
  $out = & docker version --format "{{.Server.Version}}" 2>$null
  if ($LASTEXITCODE -eq 0 -and $out) { Write-Output ("ENGINE-UP server=" + $out + " after " + (($i+1)*10) + "s"); break }
}
& docker ps --format "{{.Names}} {{.Status}}" 2>$null | Select-Object -First 5
