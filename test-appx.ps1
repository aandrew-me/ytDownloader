param (
    [switch]$Clean,
    [switch]$Build
)

$ErrorActionPreference = "Stop"

# Helper to locate makeappx.exe
function Get-MakeAppxPath {
    $searchPaths = @(
        "C:\Program Files (x86)\Windows Kits\10\App Certification Kit\makeappx.exe",
        "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\makeappx.exe",
        "C:\Program Files\Windows Kits\10\bin\*\x64\makeappx.exe"
    )
    foreach ($path in $searchPaths) {
        $found = Get-Item $path -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    throw "makeappx.exe not found. Please ensure the Windows 10/11 SDK or App Certification Kit is installed."
}

$projectRoot = $PSScriptRoot
$releaseDir = Join-Path $projectRoot "release"
$appxFile = Join-Path $releaseDir "YTDownloader_Win.appx"
$testDir = Join-Path $releaseDir "appx-test"

# If -Clean is passed, remove the installed test package and cleanup test dir
if ($Clean) {
    Write-Host "Cleaning up test AppX installation..." -ForegroundColor Cyan
    Get-AppxPackage *YTDownloaderPlus* -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue
    if (Test-Path $testDir) {
        Remove-Item -Recurse -Force $testDir -ErrorAction SilentlyContinue
    }
    Write-Host "Cleanup completed." -ForegroundColor Green
    exit 0
}

# Optionally build if -Build switch is provided or if .appx doesn't exist
if ($Build -or (-not (Test-Path $appxFile))) {
    Write-Host "Building AppX package..." -ForegroundColor Cyan
    Push-Location $projectRoot
    try {
        npx electron-builder -w appx
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $appxFile)) {
    throw "AppX package not found at: $appxFile"
}

# 1. Remove previous installed package to avoid conflict
Write-Host "Removing any existing installed versions..." -ForegroundColor Cyan
Get-AppxPackage *YTDownloaderPlus* -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue

# 2. Cleanup old test directory
if (Test-Path $testDir) {
    Remove-Item -Recurse -Force $testDir -ErrorAction SilentlyContinue
}

# 3. Unpack the AppX
$makeappx = Get-MakeAppxPath
Write-Host "Unpacking $appxFile using $makeappx..." -ForegroundColor Cyan
& $makeappx unpack /p $appxFile /d $testDir /o | Out-Null

# 4. Register package
$manifestPath = Join-Path $testDir "AppxManifest.xml"
Write-Host "Registering package from $manifestPath..." -ForegroundColor Cyan
Add-AppxPackage -Register $manifestPath

Write-Host "`nSuccessfully installed YTDownloader Plus for testing!" -ForegroundColor Green
Write-Host "Launch it from the Start Menu."
Write-Host "To remove after testing, run: .\test-appx.ps1 -Clean" -ForegroundColor Gray
