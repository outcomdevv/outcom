$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\Asus\Downloads\Outcom'
$zip = Join-Path $env:USERPROFILE 'Downloads\Outcom-V72-Real-Verification.zip'
$tmp = Join-Path $env:TEMP ('outcom-v72-' + [guid]::NewGuid().ToString('N'))

if (-not (Test-Path $repo)) { throw "Repo not found: $repo" }
if (-not (Test-Path $zip)) { throw "ZIP not found: $zip" }

New-Item -ItemType Directory -Path $tmp | Out-Null
Expand-Archive -Path $zip -DestinationPath $tmp -Force
$root = Get-ChildItem $tmp -Directory | Select-Object -First 1
if (-not $root) { throw 'Could not find extracted project root.' }

Get-ChildItem $root.FullName -Force | Where-Object { $_.Name -ne '.git' } | ForEach-Object {
  Copy-Item $_.FullName -Destination $repo -Recurse -Force
}

Set-Location $repo
npm install
npm run typecheck
npm run build
git add -A
git diff --cached --check
git commit -m "V72 real verification foundation"
git push origin main

Remove-Item $tmp -Recurse -Force
Write-Host "V72 pushed to main. Vercel should deploy automatically."
