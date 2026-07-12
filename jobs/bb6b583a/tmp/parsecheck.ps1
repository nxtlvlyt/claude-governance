$tokens = $null; $errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile('C:\Users\marka\.claude\jobs\bb6b583a\tmp\step2-cmd.ps1', [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { $errors | ForEach-Object { $_.Message }; exit 1 } else { 'PS-PARSE-CLEAN' }
