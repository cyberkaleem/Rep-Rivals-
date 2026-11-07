param(
    [string]$Apk,
    [ValidateSet('Emulator','Hosted')][string]$Flavor = 'Emulator',
    [string]$ExpectedOrigin = 'https://127.0.0.1:4443'
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$frontend = Join-Path $repo 'UI design/REP RIVALS Fitness Arena'
if (!$Apk) { $Apk = Join-Path $frontend 'android/app/build/outputs/apk/debug/app-debug.apk' }
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$aapt = Join-Path $sdk 'build-tools/35.0.0/aapt.exe'
$dist = Join-Path $frontend 'dist'
$fileCount = @(Get-ChildItem -LiteralPath $dist -File -Recurse).Count
$secrets = @(Get-Content -LiteralPath (Join-Path $repo '.env') | ForEach-Object {
    if ($_ -match '^(DATABASE_URL|DIRECT_URL)\s*=\s*(.+)$') {
        $value = $Matches[2].Trim().Trim('"').Trim("'")
        $value
        [Uri]::UnescapeDataString((([Uri]$value).UserInfo -split ':',2)[1])
    }
})
if ($secrets.Count -lt 4) { throw 'Expected database settings unavailable for local secret comparison.' }
$zip = [IO.Compression.ZipFile]::OpenRead($Apk)
$matched = 0
try {
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -match '(^|/)\.env($|\.)|\.(key|p12|keystore|jks)$') { throw 'Private configuration in APK.' }
        if (!$entry.Length) { continue }
        $stream = $entry.Open()
        $buffer = [IO.MemoryStream]::new()
        try { $stream.CopyTo($buffer); $bytes = $buffer.ToArray() } finally { $stream.Dispose(); $buffer.Dispose() }
        $text = [Text.Encoding]::UTF8.GetString($bytes)
        foreach ($secret in $secrets) {
            if ($secret -and $text.Contains($secret)) { throw 'Database credential in APK. Value suppressed.' }
        }
        if ($text -match '-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----\s+[A-Za-z0-9+/=]{32}') {
            throw 'Private key material in APK.'
        }
        if ($entry.FullName.StartsWith('assets/')) {
            if ($text -match 'postgres(?:ql)?://|\.neon\.tech|\b(?:VITE_)?DATABASE_URL\b|\bDIRECT_URL\b') {
                throw 'Database configuration in packaged assets.'
            }
        }
        if ($entry.FullName.StartsWith('assets/public/')) {
            $local = Join-Path $dist $entry.FullName.Substring('assets/public/'.Length)
            if (Test-Path -LiteralPath $local -PathType Leaf) {
                if ([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)) -ne (Get-FileHash -LiteralPath $local).Hash) {
                    throw 'APK differs from the verified web build.'
                }
                $matched++
            }
        }
    }
} finally { $zip.Dispose() }
if ($matched -ne $fileCount) { throw 'Build files missing from APK.' }
$resources = (& $aapt dump --values resources $Apk) -join "`n"
$origin = [regex]::Match($resources, '(?m)^\s*resource [^\r\n]+com\.reprivals\.app:string/account_api_origin:[^\r\n]*\r?\n\s*\(string(?:8|16)\) "([^"]*)"')
if ($LASTEXITCODE -ne 0 -or !$origin.Success -or $origin.Groups[1].Value -cne $ExpectedOrigin) { throw 'Packaged API origin mismatch.' }
$hasDevTrust = $resources.Contains('raw/rep_rivals_dev_ca')
if ($hasDevTrust -ne ($Flavor -eq 'Emulator')) { throw 'Unexpected development trust configuration.' }
if ($Flavor -eq 'Hosted' -and $resources.Contains('https://127.0.0.1:4443')) { throw 'Loopback API origin in hosted build.' }
$manifest = (& $aapt dump xmltree $Apk AndroidManifest.xml) -join "`n"
if ($LASTEXITCODE -ne 0 -or $manifest -notmatch '(?m)usesCleartextTraffic[^\r\n]*0x0\s*$' -or
    $manifest -notmatch '(?m)allowBackup[^\r\n]*0x0\s*$') { throw 'Cleartext or backup policy mismatch.' }
if ($manifest.Contains('android:networkSecurityConfig') -ne ($Flavor -eq 'Emulator')) { throw 'Unexpected network trust override.' }
$badging = (& $aapt dump badging $Apk) -join "`n"
if ($LASTEXITCODE -ne 0 -or $badging -notmatch "(?m)^package: name='com\.reprivals\.app'") { throw 'Wrong package ID.' }
$permissions = (& $aapt dump permissions $Apk) -join "`n"
if ($LASTEXITCODE -ne 0 -or !$permissions.Contains("uses-permission: name='android.permission.CAMERA'") -or
    !$permissions.Contains("uses-permission: name='android.permission.INTERNET'")) { throw 'Required permissions missing.' }
foreach ($m in [regex]::Matches($permissions,"uses-permission: name='([^']+)'")) {
    if ($m.Groups[1].Value -notin @('android.permission.CAMERA','android.permission.INTERNET','com.reprivals.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION')) {
        throw 'Unexpected Android permission.'
    }
}
Write-Output "$Flavor APK verified. $matched web files match, API origin and trust configuration match, and credential scans passed."
Write-Output (Get-FileHash -LiteralPath $Apk -Algorithm SHA256).Hash
