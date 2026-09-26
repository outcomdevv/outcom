$ErrorActionPreference = "Stop"

$Zip = "C:\Users\Asus\Downloads\Outcom-Public-V60-Production-Webhook-Loading-UX.zip"
$Repo = "C:\Users\Asus\Downloads\Outcom"
$Temp = Join-Path $env:TEMP "Outcom-V60-Deploy"
$Backup = Join-Path $env:TEMP "Outcom-V60-Preserve"

if (-not (Test-Path $Zip)) { throw "ZIP not found: $Zip" }
if (-not (Test-Path (Join-Path $Repo ".git"))) { throw "Not a git repo: $Repo" }

Remove-Item $Temp -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $Backup -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $Temp,$Backup | Out-Null
Expand-Archive -Path $Zip -DestinationPath $Temp -Force

# Preserve the production auth fix already present in the user's local repo,
# plus local environment files that must never be overwritten by a public ZIP.
$preserve = @(
  ".env",
  ".env.local",
  "app\api\auth\signup\route.ts",
  "app\api\auth\login\route.ts"
)
foreach ($relative in $preserve) {
  $source = Join-Path $Repo $relative
  if (Test-Path $source) {
    $dest = Join-Path $Backup $relative
    New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
    Copy-Item $source $dest -Force
  }
}

Get-ChildItem $Repo -Force |
  Where-Object { $_.Name -ne ".git" } |
  Remove-Item -Recurse -Force

Get-ChildItem $Temp -Force |
  Copy-Item -Destination $Repo -Recurse -Force

foreach ($relative in $preserve) {
  $source = Join-Path $Backup $relative
  if (Test-Path $source) {
    $dest = Join-Path $Repo $relative
    New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
    Copy-Item $source $dest -Force
  }
}

Remove-Item $Temp -Recurse -Force
Remove-Item $Backup -Recurse -Force
Set-Location $Repo

git add -A
git commit -m "Outcom V60 production webhook and loading UX"
git push origin main

git status
Write-Host ""
Write-Host "V60 pushed to GitHub main. Vercel should now build production automatically." -ForegroundColor Green
Write-Host "Existing local auth fix and local .env files were preserved." -ForegroundColor Green
