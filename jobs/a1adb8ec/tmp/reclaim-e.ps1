$ErrorActionPreference='Continue'
$env_now = [Environment]::GetEnvironmentVariable('OLLAMA_MODELS','Machine')
Write-Output ("ENV=" + $env_now)
if ($env_now -ne 'D:\ollama\models') { Write-Output 'ABORT-ENV-NOT-D'; exit 1 }
$d=(Get-ChildItem 'D:\ollama\models' -Recurse -File -EA SilentlyContinue | Measure-Object -Sum Length)
Write-Output ("D_HAS files=" + $d.Count + " bytes=" + $d.Sum)
if ($d.Count -ne 245 -or $d.Sum -ne 1248084680041) { Write-Output 'ABORT-D-INCOMPLETE'; exit 1 }
$before=[math]::Round((Get-PSDrive E).Free/1GB,1)
Remove-Item 'E:\ollama\models' -Recurse -Force -EA Continue
Start-Sleep -Seconds 3
$after=[math]::Round((Get-PSDrive E).Free/1GB,1)
Write-Output ("E_FREE_BEFORE=" + $before + "  E_FREE_AFTER=" + $after + "  RECLAIMED_GB=" + [math]::Round($after-$before,1))
if (Test-Path 'E:\ollama\models') { Write-Output 'RESIDUAL-REMAINS' } else { Write-Output 'E-RECLAIMED' }
