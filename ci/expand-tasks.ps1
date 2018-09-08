[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ZipPath,

    [Parameter(Mandatory = $true)]
    [string]$TargetPath)

$ErrorActionPreference = 'Stop'
Add-Type -Assembly 'System.IO.Compression.FileSystem'

# Wrap in a try/catch so exceptions will bubble from calls to .Net methods
try {
    # Create the target directory.
    if (!(Test-Path -LiteralPath $TargetPath -PathType Container)) {
        $null = New-Item -Path $TargetPath -ItemType Directory
    }

    # Extract the zip.
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $TargetPath)
} catch {
    throw $_
}