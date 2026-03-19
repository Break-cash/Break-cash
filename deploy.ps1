# Railway deployment script
# Run in PowerShell: .\deploy.ps1

Set-Location $PSScriptRoot

# Option A: If you have RAILWAY_TOKEN (from Railway Project Settings > Tokens)
if ($env:RAILWAY_TOKEN) {
    Write-Host "Deploying with RAILWAY_TOKEN..." -ForegroundColor Cyan
    railway up --ci
    exit
}

# Option B: Interactive login
Write-Host "1. Login to Railway (opens browser)..." -ForegroundColor Cyan
railway login
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n2. Link or create project (choose existing or create new)..." -ForegroundColor Cyan
railway link
if ($LASTEXITCODE -ne 0) { railway init }

Write-Host "`n3. Deploying..." -ForegroundColor Cyan
railway up --ci

Write-Host "`nDone! Check Railway dashboard for your URL." -ForegroundColor Green
