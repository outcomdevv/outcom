$ErrorActionPreference = "Stop"
$Repo = "$env:USERPROFILE\Downloads\Outcom"
$Zip = "$env:USERPROFILE\Downloads\Outcom-V73-Silent-Failure-Demo.zip"
$Tmp = "$env:TEMP\outcom-v73-deploy"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "       OUTCOM V73 DEPLOY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if (!(Test-Path $Zip)) {
    throw "V73 ZIP tidak ditemukan: $Zip"
}
if (!(Test-Path (Join-Path $Repo ".git"))) {
    throw "Repo tidak ditemukan: $Repo"
}

Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $Tmp -Force | Out-Null

Write-Host "[1/6] Extract V73..." -ForegroundColor Yellow
Expand-Archive -Path $Zip -DestinationPath $Tmp -Force

Write-Host "[2/6] Copy V73 ke repo..." -ForegroundColor Yellow
robocopy $Tmp $Repo /E /XD ".git" "node_modules" ".next" /XF ".env" ".env.local" | Out-Null

Set-Location $Repo

Write-Host "[3/6] Structural checks..." -ForegroundColor Yellow
node scripts/v72-check.mjs
node scripts/v73-check.mjs

Write-Host "[4/6] Git whitespace check..." -ForegroundColor Yellow
git add -A
git diff --cached --check

Write-Host "[5/6] Commit..." -ForegroundColor Yellow
git commit -m "V73: add silent failure demo mode"

Write-Host "[6/6] Push main..." -ForegroundColor Yellow
git push origin main

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "      V73 PUSHED SUCCESSFULLY" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
git log -1 --oneline

Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
