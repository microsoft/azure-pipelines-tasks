[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot,

    [Parameter(Mandatory = $true)]
    [string]$TargetPath,

    [switch]$Individually)

$ErrorActionPreference = 'Stop'
Add-Type -Assembly 'System.IO.Compression.FileSystem'
if ($Individually) {
    # Create the target root directory.
    if (!(Test-Path -LiteralPath $TargetPath -PathType Container)) {
        $null = New-Item -Path $TargetPath -ItemType Directory
    }

    # Create each task zip.
    Get-ChildItem -LiteralPath $SourceRoot |
        ForEach-Object {
            $sourceDir = $_.FullName
            $targetDir = [System.IO.Path]::Combine($TargetPath, $_.Name)
            Write-Host "Compressing $($_.Name)"
            $null = New-Item -Path $targetDir -ItemType Directory
            [System.IO.Compression.ZipFile]::CreateFromDirectory($sourceDir, "$targetDir\task.zip")
        }
} else {
    # Create the target directory.
    $targetDir = [System.IO.Path]::GetDirectoryName($TargetPath)
    if (!(Test-Path -LiteralPath $targetDir -PathType Container)) {
        $null = New-Item -Path $targetDir -ItemType Directory
    }

    # Create the zip.
    [System.IO.Compression.ZipFile]::CreateFromDirectory($SourceRoot, $TargetPath)
}