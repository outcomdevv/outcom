$ErrorActionPreference = "Stop"

$Repo = "$env:USERPROFILE\Downloads\Outcom"
$Source = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " OUTCOM V75 DEPLOY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (!(Test-Path $Repo)) { throw "Repo tidak ditemukan: $Repo" }
if (!(Test-Path (Join-Path $Source "app\reliability\page.tsx"))) { throw "V75 source tidak lengkap." }

Set-Location $Repo

Write-Host "[1/5] Copying V75 files..." -ForegroundColor Yellow
robocopy $Source $Repo /E /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -gt 7) { throw "Robocopy gagal dengan exit code $LASTEXITCODE" }

Write-Host "[2/5] Running V75 structural checks..." -ForegroundColor Yellow
node scripts-v75-check.mjs
if ($LASTEXITCODE -ne 0) { throw "V75 structural check FAILED. Push dibatalkan." }

Write-Host "[3/5] Checking git diff..." -ForegroundColor Yellow
git diff --check
if ($LASTEXITCODE -ne 0) { throw "git diff --check FAILED. Push dibatalkan." }

Write-Host "[4/5] Git status..." -ForegroundColor Yellow
git status --short

Write-Host "[5/5] Committing and pushing..." -ForegroundColor Yellow
git add -A
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Staged diff check FAILED. Push dibatalkan." }

git commit -m "V75: add outcome reliability engine"
if ($LASTEXITCODE -ne 0) { throw "Git commit gagal." }

git push origin main
if ($LASTEXITCODE -ne 0) { throw "Git push gagal." }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " V75 PUSH BERHASIL" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Open after Vercel deploy: /reliability" -ForegroundColor Cyan
Write-Host ""
Read-Host "Tekan ENTER untuk menutup"
