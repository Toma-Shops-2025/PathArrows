# Path Arrows - signed AAB for Google Play
# 1) Create a Unity Ads Game ID for this app
# 2) Put it in android/app/src/main/java/fun/patharrows/unity/UnityAdsPlugin.java
# 3) Create keystore C:\Keys\path-arrows.jks (alias patharrows1) then run this script

$ProjectPath  = "$env:USERPROFILE\Desktop\PathArrows"
$KeystorePath = "C:\Keys\path-arrows.jks"
$KeyAlias     = "patharrows1"
$AabPath      = "$ProjectPath\android\app\build\outputs\bundle\release\app-release.aab"
$Password     = "Custom.247"

$ErrorActionPreference = "Continue"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

Step "Switching to project: $ProjectPath"
Set-Location $ProjectPath

Step "npm install"
npm install

Step "Building web app"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Web build failed!" -ForegroundColor Red; exit 1 }

Step "Capacitor sync"
npx cap sync android

Step "Bumping versionCode..."
$gradle = "android/app/build.gradle"
$content = Get-Content $gradle -Raw
if ($content -match 'versionCode\s+(\d+)') {
    $old = [int]$Matches[1]
    $new = $old + 1
    $content = $content -replace "versionCode\s+$old", "versionCode $new"
    Set-Content $gradle $content -NoNewline
    Write-Host "    versionCode: $old -> $new" -ForegroundColor Green
}

Step "Building signed release AAB"
Set-Location "$ProjectPath\android"
& .\gradlew.bat bundleRelease `
    "-Pandroid.injected.signing.store.file=$KeystorePath" `
    "-Pandroid.injected.signing.store.password=$Password" `
    "-Pandroid.injected.signing.key.alias=$KeyAlias" `
    "-Pandroid.injected.signing.key.password=$Password"
$gradleExit = $LASTEXITCODE
Set-Location $ProjectPath

if ($gradleExit -eq 0 -and (Test-Path $AabPath)) {
    Write-Host "`n  SUCCESS`n  Signed AAB: $AabPath" -ForegroundColor Green
    Start-Process explorer.exe "/select,`"$AabPath`""
} else {
    Write-Host "`n  Build FAILED (need keystore + Unity Game ID)." -ForegroundColor Red
    exit 1
}
