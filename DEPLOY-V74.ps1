$ErrorActionPreference = "Stop"
$Repo = "$env:USERPROFILE\Downloads\Outcom"
$Zip = "$env:USERPROFILE\Downloads\Outcom-V74.zip"
$Tmp = Join-Path $env:TEMP "outcom-v74-safe"

if (-not (Test-Path $Repo)) { throw "Repo not found: $Repo" }
if (-not (Test-Path $Zip)) { throw "ZIP not found: $Zip" }

Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $Tmp | Out-Null
Expand-Archive -Path $Zip -DestinationPath $Tmp -Force
$Source = Join-Path $Tmp "Outcom-V74"

Write-Host "== V74: applying files ==" -ForegroundColor Cyan
robocopy $Source $Repo /E /XD .git node_modules .next | Out-Host
if ($LASTEXITCODE -gt 7) { throw "robocopy failed with exit code $LASTEXITCODE" }
Set-Location $Repo

Write-Host "== V74: structural checks ==" -ForegroundColor Cyan
node scripts\v74-check.mjs
if ($LASTEXITCODE -ne 0) { throw "V74 structural checks failed." }

Write-Host "== V74: git diff check ==" -ForegroundColor Cyan
git diff --check
if ($LASTEXITCODE -ne 0) { throw "git diff --check failed." }

git status --short
Write-Host "`nV74 files are applied. Review the diff, then commit/push with:" -ForegroundColor Green
Write-Host 'git add -A' -ForegroundColor Yellow
Write-Host 'git commit -m "V74: add outcome contracts and business system foundation"' -ForegroundColor Yellow
Write-Host 'git push origin main' -ForegroundColor Yellow
Read-Host "Tekan ENTER untuk menutup"
