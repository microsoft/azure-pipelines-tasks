Param(
    [string]$zipName,
    [string]$command
)

$ErrorActionPreference = 'Stop'
try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { }
[System.IO.Compression.ZipFile]::ExtractToDirectory($($zipName), '.')

#"& '$($command.Replace("'", "''"))'"
Write-Host $command
#"& $command"
Invoke-Expression $command