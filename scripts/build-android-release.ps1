Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectRoot 'android'
$keystoreFile = Join-Path $androidDir 'keystore.properties'
$defaultJdk = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot'
$defaultSdk = 'C:\Users\bffh1\AppData\Local\Android\Sdk'

if (-not $env:JAVA_HOME -and (Test-Path $defaultJdk)) {
    $env:JAVA_HOME = $defaultJdk
}

if ($env:JAVA_HOME) {
    $javaBin = Join-Path $env:JAVA_HOME 'bin'
    if ($env:Path -notlike "*$javaBin*") {
        $env:Path += ";$javaBin"
    }
}

if (-not $env:ANDROID_HOME -and (Test-Path $defaultSdk)) {
    $env:ANDROID_HOME = $defaultSdk
}

if (-not $env:ANDROID_SDK_ROOT -and (Test-Path $defaultSdk)) {
    $env:ANDROID_SDK_ROOT = $defaultSdk
}

if (-not $env:JAVA_HOME -and -not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw 'JAVA_HOME is not set and java is not available in PATH.'
}

if (-not (Test-Path $keystoreFile)) {
    throw 'android\keystore.properties is missing. Copy android\keystore.properties.template and fill in your signing values.'
}

Push-Location $projectRoot
try {
    npm run build
    npm run cap:sync
    $gradleWorkDir = $androidDir
    $safeRoot = $null
    if ($projectRoot.ToCharArray() | Where-Object { [int][char]$_ -gt 127 }) {
        $safeRoot = 'C:\Temp\breakcash-project'
        if (Test-Path $safeRoot) {
            cmd /c rmdir "$safeRoot" | Out-Null
        }
        New-Item -ItemType Junction -Path $safeRoot -Target $projectRoot | Out-Null
        $gradleWorkDir = Join-Path $safeRoot 'android'
    }

    Push-Location $gradleWorkDir
    try {
        & .\gradlew.bat assembleRelease
    } finally {
        Pop-Location
        if ($safeRoot -and (Test-Path $safeRoot)) {
            cmd /c rmdir "$safeRoot" | Out-Null
        }
    }
} finally {
    Pop-Location
}

Write-Host 'Release APK/AAB build completed. Check android\app\build\outputs\ for artifacts.'
