$ErrorActionPreference='Continue'
$src='E:\ollama\models'; $dst='D:\ollama\models'
if (-not (Test-Path $src)) { Write-Output 'SRC-MISSING'; exit 1 }
$free=(Get-PSDrive D).Free/1GB
$need=((Get-ChildItem $src -Recurse -File -EA SilentlyContinue | Measure-Object -Sum Length).Sum)/1GB
Write-Output ("NEED_GB=" + [math]::Round($need,1) + " FREE_D_GB=" + [math]::Round($free,1))
if ($need -gt ($free - 100)) { Write-Output 'ABORT-INSUFFICIENT-HEADROOM'; exit 1 }
New-Item -ItemType Directory -Force -Path $dst | Out-Null
# /Z restartable, /J unbuffered (large files), NON-destructive: source untouched
Start-Process robocopy -ArgumentList @($src,$dst,'/E','/Z','/J','/R:2','/W:5','/NP','/LOG:D:\ollama-migrate.log') -WindowStyle Hidden
Start-Sleep -Seconds 5
$p=Get-Process robocopy -EA SilentlyContinue
if ($p) { Write-Output ('COPY-STARTED pid=' + $p[0].Id) } else { Write-Output 'COPY-NOT-RUNNING' }
