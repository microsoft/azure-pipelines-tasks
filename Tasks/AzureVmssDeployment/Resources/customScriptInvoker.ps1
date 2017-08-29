Param(
    [string]$zipName,
    [string]$script,
    [string]$scriptArgs
)

$ErrorActionPreference = 'Stop'

if($zipName) {
    Write-Host "Unzipping $zipName"
    try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($($zipName), '.\a')
    Push-Location ".\\a"
}

Write-Host "Invoking command: $script $scriptArgs"
Invoke-Expression "$script $scriptArgs"

if($zipName) {
    Pop-Location
}