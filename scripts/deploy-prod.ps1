param(
    [string]$RailwayProject = "break-cash-api",
    [string]$RailwayEnvironment = "production",
    [string]$ApiBaseUrl = "https://break-cash.up.railway.app",
    [switch]$SkipRailway,
    [switch]$SkipVercel,
    [switch]$AllowDirty
)

Set-StrictMode -Version Latest

Write-Host "1) Building the project..."
npm run build

Write-Host "`n2) Ensuring working tree is clean..."
$gitStatus = git status -sb
Write-Host $gitStatus
if ((-not $AllowDirty) -and $gitStatus.Trim()) {
    throw "Please commit or stash local changes before deploying."
}

if ($AllowDirty -and $gitStatus.Trim()) {
    Write-Host "Continuing with local changes because -AllowDirty was provided."
}

if (-not $SkipRailway) {
    Write-Host "`n3) Deploying backend to Railway ($RailwayProject/$RailwayEnvironment)..."
    railway up --project $RailwayProject --environment $RailwayEnvironment

    Write-Host "`n4) Verifying Railway API health..."
    $healthUrl = "$ApiBaseUrl/api/health"
    $readyUrl = "$ApiBaseUrl/api/health/ready"

    try {
        $healthResponse = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 30
        Write-Host "Health: $($healthResponse | ConvertTo-Json -Compress)"
    }
    catch {
        throw "Health check failed at $healthUrl. $($_.Exception.Message)"
    }

    try {
        $readyResponse = Invoke-RestMethod -Uri $readyUrl -Method Get -TimeoutSec 30
        Write-Host "Ready: $($readyResponse | ConvertTo-Json -Compress)"
    }
    catch {
        throw "Readiness check failed at $readyUrl. $($_.Exception.Message)"
    }
}

if (-not $SkipVercel) {
    Write-Host "`n5) Deploying frontend to Vercel (production)..."
    npx vercel --prod
}

Write-Host "`nDone. Railway health checks passed after deploy."
