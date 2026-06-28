param(
  [switch] $RerunTasks
)

$ErrorActionPreference = "Stop"

$appRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidRoot = Join-Path $appRoot "android"
$defaultJavaHome = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$defaultAndroidHome = "C:\Users\woung\AppData\Local\Android\Sdk"
$defaultApiBaseUrl = "https://englishproject-c42b2.web.app"
$resumeFolderName = ([string][char]0xC774) + ([string][char]0xB825) + ([string][char]0xC11C)
$publishedBundleDirectory = Join-Path (Join-Path $env:USERPROFILE "Desktop") $resumeFolderName
$publishedBundlePath = Join-Path $publishedBundleDirectory "app-release.aab"
$uploadKeystorePath = Join-Path $publishedBundleDirectory "level-fit-upload.jks"
$uploadKeystorePropertiesPath = Join-Path $publishedBundleDirectory "level-fit-upload-keystore.properties"
$uploadKeyAlias = "levelfit-upload"

function Get-DotEnvValue {
  param([string] $Name)

  $envFile = Join-Path $appRoot ".env"
  if (-not (Test-Path -LiteralPath $envFile)) {
    return $null
  }

  $line = Get-Content -LiteralPath $envFile |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Name))=" } |
    Select-Object -First 1

  if ($line -match "^\s*$([regex]::Escape($Name))=(.+)\s*$") {
    return $Matches[1].Trim().Trim("'").Trim('"')
  }

  return $null
}

function Resolve-PublicEnvValue {
  param(
    [string] $Name,
    [string] $Fallback
  )

  $value = [Environment]::GetEnvironmentVariable($Name)
  if (-not $value) {
    $value = Get-DotEnvValue -Name $Name
  }

  if (-not $value) {
    $value = $Fallback
  }

  if ($value) {
    return $value.Trim()
  }

  return $null
}

function New-KeystorePassword {
  $bytes = New-Object byte[] 24
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return ([Convert]::ToBase64String($bytes).TrimEnd("=") -replace "[+/]", "A")
}

function Write-TextFileWithoutBom {
  param(
    [string] $Path,
    [string] $Value
  )

  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Value, $utf8WithoutBom)
}

function Read-KeystoreProperties {
  if (-not (Test-Path -LiteralPath $uploadKeystorePropertiesPath)) {
    return $null
  }

  $properties = @{}
  [System.IO.File]::ReadAllLines($uploadKeystorePropertiesPath, [System.Text.Encoding]::UTF8) | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
      $properties[$Matches[1].Trim()] = $Matches[2].Trim()
    }
  }

  return $properties
}

function Write-KeystoreProperties {
  param([hashtable] $Properties)

  $propertiesText = @(
    "storeFile=$($Properties["storeFile"])",
    "storePassword=$($Properties["storePassword"])",
    "keyAlias=$($Properties["keyAlias"])",
    "keyPassword=$($Properties["keyPassword"])"
  ) -join "`r`n"

  Write-TextFileWithoutBom -Path $uploadKeystorePropertiesPath -Value ($propertiesText + "`r`n")
}

function Ensure-UploadKeystore {
  param([string] $KeytoolPath)

  if (-not (Test-Path -LiteralPath $publishedBundleDirectory)) {
    throw "Publish directory was not found: $publishedBundleDirectory"
  }

  $properties = Read-KeystoreProperties
  if ($properties) {
    foreach ($requiredKey in @("storeFile", "storePassword", "keyAlias", "keyPassword")) {
      if (-not $properties[$requiredKey]) {
        throw "Upload keystore properties file is missing '$requiredKey': $uploadKeystorePropertiesPath"
      }
    }

    if (-not (Test-Path -LiteralPath $properties["storeFile"])) {
      if (Test-Path -LiteralPath $uploadKeystorePath) {
        $properties["storeFile"] = $uploadKeystorePath
        Write-KeystoreProperties -Properties $properties
        Write-Host "Upload keystore properties storeFile repaired: $uploadKeystorePath"
        return $properties
      }

      throw "Upload keystore file is missing. Do not regenerate silently after Play upload: $($properties["storeFile"])"
    }

    if ($properties["keyPassword"] -ne $properties["storePassword"]) {
      $properties["keyPassword"] = $properties["storePassword"]
      Write-KeystoreProperties -Properties $properties
      Write-Host "Upload keystore keyPassword aligned with storePassword for PKCS12 signing."
    }

    return $properties
  }

  $storePassword = New-KeystorePassword
  $keyPassword = $storePassword
  $distinguishedName = "CN=LevelFit, OU=EnglishProject, O=HeewoungLee, L=Seoul, ST=Seoul, C=KR"

  & $KeytoolPath @(
    "-genkeypair",
    "-v",
    "-storetype", "PKCS12",
    "-keystore", $uploadKeystorePath,
    "-alias", $uploadKeyAlias,
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-storepass", $storePassword,
    "-keypass", $keyPassword,
    "-dname", $distinguishedName,
    "-noprompt"
  )
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $properties = @{
    storeFile = $uploadKeystorePath
    storePassword = $storePassword
    keyAlias = $uploadKeyAlias
    keyPassword = $keyPassword
  }

  Write-KeystoreProperties -Properties $properties
  Write-Host "Upload keystore created: $uploadKeystorePath"
  Write-Host "Upload keystore properties created: $uploadKeystorePropertiesPath"

  return Read-KeystoreProperties
}

function Escape-GradleString {
  param([string] $Value)
  return ($Value -replace "\\", "/" -replace "'", "\'")
}

function Set-ReleaseUploadSigning {
  param(
    [string] $BuildGradlePath,
    [hashtable] $KeystoreProperties
  )

  $originalBuildGradle = Get-Content -LiteralPath $BuildGradlePath -Raw
  $storeFile = Escape-GradleString -Value $KeystoreProperties["storeFile"]
  $storePassword = Escape-GradleString -Value $KeystoreProperties["storePassword"]
  $keyAlias = Escape-GradleString -Value $KeystoreProperties["keyAlias"]
  $keyPassword = Escape-GradleString -Value $KeystoreProperties["keyPassword"]

  $releaseUploadBlock = @"
        releaseUpload {
            storeFile file('$storeFile')
            storePassword '$storePassword'
            keyAlias '$keyAlias'
            keyPassword '$keyPassword'
        }
"@

  $patchedBuildGradle = [regex]::Replace(
    $originalBuildGradle,
    "(?s)(signingConfigs\s*\{\s*debug\s*\{.*?\n\s*\})",
    "`$1`r`n$releaseUploadBlock",
    1
  )

  if ($patchedBuildGradle -eq $originalBuildGradle) {
    throw "Could not insert releaseUpload signing config into $BuildGradlePath."
  }

  $patchedBuildGradle = [regex]::Replace(
    $patchedBuildGradle,
    "signingConfig\s+signingConfigs\.debug",
    "signingConfig signingConfigs.releaseUpload",
    1
  )

  if ($patchedBuildGradle -notmatch "signingConfigs\.releaseUpload") {
    throw "Could not switch release build type to signingConfigs.releaseUpload."
  }

  Write-TextFileWithoutBom -Path $BuildGradlePath -Value $patchedBuildGradle
  return $originalBuildGradle
}

$javaHome = if (Test-Path -LiteralPath $defaultJavaHome) { $defaultJavaHome } else { $env:JAVA_HOME }
if (-not $javaHome -or -not (Test-Path -LiteralPath (Join-Path $javaHome "bin\java.exe"))) {
  throw "Java was not found. Set JAVA_HOME or install JDK at $defaultJavaHome."
}

$keytoolPath = Join-Path $javaHome "bin\keytool.exe"
if (-not (Test-Path -LiteralPath $keytoolPath)) {
  throw "keytool was not found at $keytoolPath."
}

$androidHome = $env:ANDROID_HOME
if (-not $androidHome -and (Test-Path -LiteralPath $defaultAndroidHome)) {
  $androidHome = $defaultAndroidHome
}

if (-not $androidHome -or -not (Test-Path -LiteralPath (Join-Path $androidHome "platform-tools\adb.exe"))) {
  throw "Android SDK was not found. Set ANDROID_HOME or install it at $defaultAndroidHome."
}

$apiBaseUrl = Resolve-PublicEnvValue -Name "EXPO_PUBLIC_API_BASE_URL" -Fallback $defaultApiBaseUrl
$androidAppId = Resolve-PublicEnvValue -Name "EXPO_PUBLIC_ADMOB_ANDROID_APP_ID"
$bannerUnitId = Resolve-PublicEnvValue -Name "EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID"
$adsEnabled = Resolve-PublicEnvValue -Name "EXPO_PUBLIC_ADS_ENABLED" -Fallback "true"

if ($apiBaseUrl -match "localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\." -or $apiBaseUrl -notmatch "^https://") {
  throw "Release AAB API URL must be a public HTTPS URL. Current EXPO_PUBLIC_API_BASE_URL: $apiBaseUrl"
}

if (-not $androidAppId -or $androidAppId -match "3940256099942544") {
  throw "Release AAB requires the real EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, not the Google test app id."
}

if (-not $bannerUnitId -or $bannerUnitId -match "3940256099942544") {
  throw "Release AAB requires the real EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID, not the Google test banner id."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidHome
$env:ANDROID_SDK_ROOT = $androidHome
$env:Path = "$javaHome\bin;$androidHome\platform-tools;$androidHome\emulator;$env:Path"
$env:NODE_ENV = "production"
$env:EXPO_PUBLIC_API_BASE_URL = $apiBaseUrl.TrimEnd("/")
$env:EXPO_PUBLIC_ADS_ENABLED = $adsEnabled
$env:EXPO_PUBLIC_ADMOB_ANDROID_APP_ID = $androidAppId
$env:EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID = $bannerUnitId

Push-Location $appRoot
try {
  & npx.cmd expo prebuild --platform android
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location
}

$buildGradlePath = Join-Path $androidRoot "app\build.gradle"
$bundlePath = Join-Path $androidRoot "app\build\outputs\bundle\release\app-release.aab"
$keystoreProperties = Ensure-UploadKeystore -KeytoolPath $keytoolPath
$buildGradleBackup = $null
$gradleArgs = @("bundleRelease")

if ($RerunTasks) {
  $gradleArgs += "--rerun-tasks"
}

$buildGradleBackup = Set-ReleaseUploadSigning `
  -BuildGradlePath $buildGradlePath `
  -KeystoreProperties $keystoreProperties

Push-Location $androidRoot
try {
  & .\gradlew.bat @gradleArgs
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  if ($buildGradleBackup) {
    Write-TextFileWithoutBom -Path $buildGradlePath -Value $buildGradleBackup
  }
  Pop-Location
}

if (-not (Test-Path -LiteralPath $bundlePath)) {
  throw "Gradle finished, but AAB was not found at $bundlePath."
}

Copy-Item -LiteralPath $bundlePath -Destination $publishedBundlePath -Force
Write-Host "AAB copied: $publishedBundlePath"
Write-Host "AAB generated: $bundlePath"
