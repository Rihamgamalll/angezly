# Run from D:\دورك\project with PowerShell. Fixes only the known unsupported override.
$ErrorActionPreference = 'Stop'
$localProperties = Join-Path (Join-Path $PSScriptRoot '..\android') 'gradle.properties'
$globalProperties = Join-Path $HOME '.gradle\gradle.properties'
$bad = '^\s*systemProp\.javax\.net\.ssl\.trustStoreType\s*=\s*Windows-ROOT\s*$'
if (Test-Path $localProperties) {
    $contents = Get-Content -Path $localProperties -Raw
    if ($contents -match '(?im)^\s*systemProp\.javax\.net\.ssl\.trustStoreType\s*=\s*Windows-ROOT\s*$') {
        Copy-Item $localProperties ($localProperties + '.v12-backup') -Force
        $lines = Get-Content $localProperties | Where-Object { $_ -notmatch $bad }
        $lines | Set-Content -Path $localProperties -Encoding UTF8
        Write-Host 'Removed unsupported Windows-ROOT override from project Gradle properties. Backup created.'
    } else { Write-Host 'No Windows-ROOT override found in project Gradle properties.' }
} else { Write-Host 'Local android/gradle.properties not present. Kept your Android Studio project unchanged.' }
if (Test-Path $globalProperties) {
    if ((Get-Content $globalProperties -Raw) -match '(?im)^\s*systemProp\.javax\.net\.ssl\.trustStoreType\s*=\s*Windows-ROOT\s*$') {
        Write-Warning "Check $globalProperties: it also contains Windows-ROOT. Remove that line manually if you added it."
    }
}
Write-Host 'Next: Android Studio > Settings > Build Tools > Gradle > Gradle JDK. If PKIX remains, use a trusted JDK/CA. Do not disable TLS verification.'
