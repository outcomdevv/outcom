$ErrorActionPreference = "Stop"
$Repo = "C:\Users\Asus\Downloads\Outcom"
$Zip = "$env:USERPROFILE\Downloads\Outcom-V76-Evidence-Graph.zip"
$Tmp = Join-Path $env:TEMP "outcom-v76"

Set-Location $Repo
if (Test-Path $Tmp) { Remove-Item $Tmp -Recurse -Force }
New-Item -ItemType Directory -Path $Tmp | Out-Null
Expand-Archive -Path $Zip -DestinationPath $Tmp -Force
$Source = $Tmp

robocopy $Source $Repo /E /XD .git node_modules .next /XF package-lock.json | Out-Host
if ($LASTEXITCODE -gt 7) { throw "robocopy failed with exit code $LASTEXITCODE" }

node scripts\v73-check.mjs
node scripts\v751-check.mjs
node scripts\v752-check.mjs
node scripts\v76-check.mjs
git add -A
git diff --cached --check
git commit -m "V76: add evidence graph"
git push origin main
Write-Host "V76 pushed to origin/main." -ForegroundColor Green
