[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ZipPath,

    [Parameter(Mandatory = $true)]
    [string]$TargetPath)

$ErrorActionPreference = 'Stop'
Add-Type -Assembly 'System.IO.Compression.FileSystem'

# Create the target directory.
if (!(Test-Path -LiteralPath $TargetPath -PathType Container)) {
    $null = New-Item -Path $TargetPath -ItemType Directory
}

# Create the zip.
[System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $TargetPath)
