# Run from the repo root. Copies the patch files, checks, commits and pushes.
$ErrorActionPreference = "Stop"
$patch = Split-Path -Parent $MyInvocation.MyCommand.Path
Get-ChildItem -LiteralPath $patch -Recurse -File | Where-Object { $_.Name -ne "DEPLOY-V96.3.ps1" } | ForEach-Object {
  $rel = $_.FullName.Substring($patch.Length + 1)
  $dest = Join-Path (Get-Location) $rel
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
  Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
}
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }
npm run test:unit
if ($LASTEXITCODE -ne 0) { throw "unit tests failed" }
git add -A
git commit -m "V96.3: real company logos for the tool and app cards (loaded from public icon libraries or official files in public/brands), no invented marks; includes V95 watches and checks, V96 platforms and cards" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_0126u7EC9rVsa1Q4ZUwfA3DE"
git push origin main
