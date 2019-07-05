Param(
    [string]$zipName,
    [string]$script,
    [string]$scriptArgs,
    [string]$prefixPath,
    [string]$blobUrl,
    [string]$sasToken
)

$ErrorActionPreference = 'Stop'

$cwd = (Get-Location).Path
$filesPath = Join-Path $cwd $prefixPath

if ($zipName)
{
    $zipPath = Join-Path $filesPath $zipName
    $filesPath = Join-Path $filesPath 'a'
    Write-Host "Unzipping $zipPath"
    try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $filesPath)
}

Push-Location $filesPath

Write-Host "Invoking command: $script $scriptArgs"
Invoke-Expression "$script $scriptArgs" > ./out.txt


Invoke-RestMethod -Method Put -Uri "${blobUrl}${ENV:COMPUTERNAME}.log${sasToken}" -InFile "./out.txt" -Headers @{"x-ms-blob-type" = "BlockBlob" }