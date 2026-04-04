Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$iosDir = Join-Path $projectRoot 'ios'
$handoffDir = Join-Path $projectRoot 'build-artifacts'
$zipPath = Join-Path $handoffDir 'break-cash-ios-handoff.zip'

if (-not (Test-Path $iosDir)) {
    throw 'iOS project is missing. Run npm run ios:add first.'
}

Push-Location $projectRoot
try {
    npm run build
    npm run cap:sync:ios

    New-Item -ItemType Directory -Force -Path $handoffDir | Out-Null
    if (Test-Path $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }

    Compress-Archive -Path `
        (Join-Path $projectRoot 'ios'), `
        (Join-Path $projectRoot 'capacitor.config.ts'), `
        (Join-Path $projectRoot 'package.json'), `
        (Join-Path $projectRoot 'MOBILE_BUILD.md') `
        -DestinationPath $zipPath
} finally {
    Pop-Location
}

Write-Host "iOS handoff package created at $zipPath"
