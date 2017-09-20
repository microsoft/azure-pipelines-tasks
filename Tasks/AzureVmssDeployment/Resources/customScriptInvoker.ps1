Param(
    [string]$zipName,
    [string]$script,
    [string]$scriptArgs,
    [string]$prefixPath
)

$ErrorActionPreference = 'Stop'

$cwd = (Get-Location).Path
$filesPath = Join-Path $cwd $prefixPath

if ($zipName) {
    $zipPath = Join-Path $filesPath $zipName
    $filesPath = Join-Path $filesPath 'a'
    Write-Host "Unzipping $zipPath"
    try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $filesPath)
}

Push-Location $filesPath

Write-Host "Invoking command: $script $scriptArgs"
Invoke-Expression "$script $scriptArgs"