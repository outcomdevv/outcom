# Run from the root of the existing Outcom repository. This is an overlay patch, not a full repo.
$ErrorActionPreference = "Stop"
$patch = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Get-Location).Path
if (!(Test-Path (Join-Path $repo "package.json"))) { throw "Run this script from the full Outcom repository root (package.json not found)." }
if (!(Test-Path (Join-Path $repo ".git"))) { throw "Git repository not found. No files copied." }
$branch = git branch --show-current
if ($LASTEXITCODE -ne 0) { throw "Could not read Git branch." }
Write-Host "Repository: $repo" -ForegroundColor Cyan
Write-Host "Branch: $branch" -ForegroundColor Cyan
$confirm = Read-Host "Type APPLY to back up changed files and apply V97 to this repository"
if ($confirm -cne "APPLY") { throw "Cancelled. No files changed." }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $repo ".outcom-v97-backup-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Get-ChildItem -LiteralPath $patch -Recurse -File | Where-Object { $_.Name -notin @("DEPLOY-V97.ps1", "README-V97.md") } | ForEach-Object {
  $rel = $_.FullName.Substring($patch.Length + 1)
  $dest = Join-Path $repo $rel
  if (Test-Path $dest) {
    $backupDest = Join-Path $backup $rel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupDest) | Out-Null
    Copy-Item -LiteralPath $dest -Destination $backupDest -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
  Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
}
Write-Host "V97 overlay applied. Backup: $backup" -ForegroundColor Green
Write-Host "NEXT: Apply supabase/migrations/006_v97_remediation_bi.sql in Supabase before testing the new endpoints." -ForegroundColor Yellow
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "typecheck failed. Restore from $backup before proceeding if needed." }
npm run test:unit
if ($LASTEXITCODE -ne 0) { throw "unit tests failed. Restore from $backup before proceeding if needed." }
Write-Host "Checks passed. Review git diff before committing. No commit or push was performed." -ForegroundColor Green
git status --short
