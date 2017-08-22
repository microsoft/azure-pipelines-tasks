Param(
    [string]$zipName,
    [string]$script,
    [string]$scriptArgs
)

$ErrorActionPreference = 'Stop'
try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { }
[System.IO.Compression.ZipFile]::ExtractToDirectory($($zipName), '.')

$escapedScript = $script.Replace('`', '``').Replace('$', '`$')
$quotedScript = ".\" + "`"$escapedScript`""
$escapedArgs = $scriptArgs.Replace('`', '``').Replace('$', '`$')

Write-Host "Invoking command: $quotedScript $escapedArgs"
Invoke-Expression "$quotedScript $escapedArgs"