param(
  [ValidateSet("debug", "release")]
  [string] $Variant = "release",
  [switch] $RerunTasks,
  [switch] $MasterTest
)

$ErrorActionPreference = "Stop"

$appRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidRoot = Join-Path $appRoot "android"
$defaultJavaHome = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$defaultAndroidHome = "C:\Users\woung\AppData\Local\Android\Sdk"
$defaultApiBaseUrl = "https://englishproject-c42b2.web.app"
$masterTestClientId = "ep-master-hiwoong-test"
$masterTestApplicationId = "com.heewounglee.englishproject.master"
$masterTestAppName = "EnglishProject Master"
$resumeFolderName = ([string][char]0xC774) + ([string][char]0xB825) + ([string][char]0xC11C)
$publishedApkDirectory = Join-Path (Join-Path $env:USERPROFILE "Desktop") $resumeFolderName

function Set-AndroidBuildIdentity {
  param(
    [string] $AndroidRoot,
    [string] $ApplicationId,
    [string] $AppName
  )

  $buildGradlePath = Join-Path $AndroidRoot "app\build.gradle"
  $stringsPath = Join-Path $AndroidRoot "app\src\main\res\values\strings.xml"

  if (-not (Test-Path -LiteralPath $buildGradlePath)) {
    throw "Android build.gradle was not found at $buildGradlePath."
  }

  if (-not (Test-Path -LiteralPath $stringsPath)) {
    throw "Android strings.xml was not found at $stringsPath."
  }

  $originalBuildGradle = Get-Content -LiteralPath $buildGradlePath -Raw
  $originalStrings = Get-Content -LiteralPath $stringsPath -Raw

  $updatedBuildGradle = $originalBuildGradle -replace "applicationId\s+'[^']+'", "applicationId '$ApplicationId'"
  $updatedStrings = [regex]::Replace(
    $originalStrings,
    '<string name="app_name">.*?</string>',
    "<string name=`"app_name`">$AppName</string>"
  )

  if ($updatedBuildGradle -eq $originalBuildGradle) {
    throw "Could not replace Android applicationId in $buildGradlePath."
  }

  if ($updatedStrings -eq $originalStrings) {
    throw "Could not replace Android app_name in $stringsPath."
  }

  Write-TextFileWithoutBom -Path $buildGradlePath -Value $updatedBuildGradle
  Write-TextFileWithoutBom -Path $stringsPath -Value $updatedStrings

  return @{
    BuildGradlePath = $buildGradlePath
    BuildGradle = $originalBuildGradle
    StringsPath = $stringsPath
    Strings = $originalStrings
  }
}

function Restore-AndroidBuildIdentity {
  param($Backup)

  if (-not $Backup) {
    return
  }

  Write-TextFileWithoutBom -Path $Backup.BuildGradlePath -Value $Backup.BuildGradle
  Write-TextFileWithoutBom -Path $Backup.StringsPath -Value $Backup.Strings
}

function Write-TextFileWithoutBom {
  param(
    [string] $Path,
    [string] $Value
  )

  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Value, $utf8WithoutBom)
}

$javaHome = $null
if (Test-Path -LiteralPath $defaultJavaHome) {
  $javaHome = $defaultJavaHome
}

if (-not $javaHome) {
  $javaHome = $env:JAVA_HOME
}

if (-not $javaHome -or -not (Test-Path -LiteralPath (Join-Path $javaHome "bin\java.exe"))) {
  throw "Java was not found. Set JAVA_HOME or install JDK at $defaultJavaHome."
}

$androidHome = $env:ANDROID_HOME
if (-not $androidHome -and (Test-Path -LiteralPath $defaultAndroidHome)) {
  $androidHome = $defaultAndroidHome
}

if (-not $androidHome -or -not (Test-Path -LiteralPath (Join-Path $androidHome "platform-tools\adb.exe"))) {
  throw "Android SDK was not found. Set ANDROID_HOME or install it at $defaultAndroidHome."
}

$envFile = Join-Path $appRoot ".env"
$resolvedApiBaseUrl = $env:EXPO_PUBLIC_API_BASE_URL
if (Test-Path -LiteralPath $envFile) {
  $envLine = Get-Content -LiteralPath $envFile |
    Where-Object { $_ -match "^\s*EXPO_PUBLIC_API_BASE_URL=" } |
    Select-Object -First 1

  if (-not $resolvedApiBaseUrl -and $envLine -match "^\s*EXPO_PUBLIC_API_BASE_URL=(.+)\s*$") {
    $resolvedApiBaseUrl = $Matches[1].Trim().Trim("'").Trim('"')
  }
}

$resolvedApiBaseUrl = if ($resolvedApiBaseUrl) { $resolvedApiBaseUrl.TrimEnd("/") } else { $defaultApiBaseUrl }

if ($Variant -eq "release") {
  $privateApiPattern = "localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\."

  if ($resolvedApiBaseUrl -match $privateApiPattern -or $resolvedApiBaseUrl -notmatch "^https://") {
    throw "Release APK API URL must be a public HTTPS URL. Current EXPO_PUBLIC_API_BASE_URL: $resolvedApiBaseUrl"
  }
}

$env:EXPO_PUBLIC_API_BASE_URL = $resolvedApiBaseUrl

if ($MasterTest) {
  $env:EXPO_PUBLIC_API_CLIENT_ID_OVERRIDE = $masterTestClientId

  if (-not $env:EXPO_PUBLIC_MASTER_TEST_TOKEN) {
    $env:EXPO_PUBLIC_MASTER_TEST_TOKEN = $env:AI_QUOTA_MASTER_TEST_TOKEN
  }

  if (-not $env:EXPO_PUBLIC_MASTER_TEST_TOKEN) {
    throw "Master test APK requires EXPO_PUBLIC_MASTER_TEST_TOKEN or AI_QUOTA_MASTER_TEST_TOKEN."
  }
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidHome
$env:ANDROID_SDK_ROOT = $androidHome
$env:Path = "$javaHome\bin;$androidHome\platform-tools;$androidHome\emulator;$env:Path"

if (-not $env:NODE_ENV) {
  $env:NODE_ENV = "production"
}

if (-not (Test-Path -LiteralPath $androidRoot)) {
  Push-Location $appRoot
  try {
    & npx.cmd expo prebuild --platform android
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } finally {
    Pop-Location
  }
}

$androidBuildIdentityBackup = $null
if ($MasterTest) {
  $androidBuildIdentityBackup = Set-AndroidBuildIdentity `
    -AndroidRoot $androidRoot `
    -ApplicationId $masterTestApplicationId `
    -AppName $masterTestAppName
}

$gradleTask = if ($Variant -eq "release") { "assembleRelease" } else { "assembleDebug" }
$apkPath = Join-Path $androidRoot "app\build\outputs\apk\$Variant\app-$Variant.apk"
$gradleArgs = @($gradleTask)

if ($RerunTasks -or $MasterTest) {
  $gradleArgs += "--rerun-tasks"
}

Push-Location $androidRoot
try {
  & .\gradlew.bat @gradleArgs
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Restore-AndroidBuildIdentity -Backup $androidBuildIdentityBackup
  Pop-Location
}

if (-not (Test-Path -LiteralPath $apkPath)) {
  throw "Gradle finished, but APK was not found at $apkPath."
}

$publishedApkName = if ($MasterTest) { "app-master-$Variant.apk" } else { Split-Path -Leaf $apkPath }
$publishedApkPath = Join-Path $publishedApkDirectory $publishedApkName
if (Test-Path -LiteralPath $publishedApkDirectory) {
  Copy-Item -LiteralPath $apkPath -Destination $publishedApkPath -Force
  Write-Host "APK copied: $publishedApkPath"
} else {
  Write-Warning "Publish directory was not found, so the APK was not copied: $publishedApkDirectory"
}

Write-Host "APK generated: $apkPath"
