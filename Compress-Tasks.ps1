[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$IndividualZipStagingPath,

    [Parameter(Mandatory = $true)]
    [string]$WrapperZipStagingPath,

    [Parameter(Mandatory = $true)]
    [string]$ZipPath)

$ErrorActionPreference = 'Stop'
Add-Type -Assembly 'System.IO.Compression.FileSystem'
Get-ChildItem -LiteralPath $IndividualZipStagingPath |
    ForEach-Object {
        $sourceDir = $_.FullName
        $targetDir = [System.IO.Path]::Combine($WrapperZipStagingPath, $_.Name)
        Write-Host "Compressing $($_.Name)"
        [System.IO.Compression.ZipFile]::CreateFromDirectory($sourceDir, "$targetDir\task.zip")
    }

Write-Host "Creating $([System.IO.Path]::GetFileName($ZipPath))"
$null = New-Item -Path ([System.IO.Path]::GetDirectoryName($ZipPath)) -ItemType Directory
[System.IO.Compression.ZipFile]::CreateFromDirectory($WrapperZipStagingPath, $ZipPath)