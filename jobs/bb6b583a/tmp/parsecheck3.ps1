$tokens = $null; $errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile('C:\Users\marka\agy-muezzin\sites\androidtv-tips\design\stitch-bind-v3.ps1', [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { $errors | ForEach-Object { $_.Message }; exit 1 } else { 'BIND-PARSE-CLEAN' }
