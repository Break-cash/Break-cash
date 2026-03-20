# Stable deployment script for the linked production project.
# Run in PowerShell: .\deploy.ps1
#
# Why this script uses Git push instead of `railway up`:
# The current Railway service is linked to GitHub and auto-deploys from `main`.
# Direct CLI snapshot uploads have been timing out during "Initialization > Snapshot code".

param(
    [string]$Message = "chore: production deploy"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "1. Verifying linked Railway project..." -ForegroundColor Cyan
railway status

Write-Host "`n2. Building locally..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    throw "Local build failed. Deployment aborted."
}

Write-Host "`n3. Checking git changes..." -ForegroundColor Cyan
$status = git status --short
if (-not $status) {
    Write-Host "No local changes to deploy. Railway is already waiting on GitHub main." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n4. Committing current changes..." -ForegroundColor Cyan
git add -A
git commit -m $Message

Write-Host "`n5. Pushing to GitHub main..." -ForegroundColor Cyan
git push origin main

Write-Host "`nDone. Railway will auto-deploy from GitHub main." -ForegroundColor Green
