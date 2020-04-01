[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot,

    [Parameter(Mandatory = $true)]
    [string]$TargetPath,

    [switch]$Individually)

$ErrorActionPreference = 'Stop'
Add-Type -Assembly 'System.IO.Compression.FileSystem'
Add-Type -AssemblyName 'System.Text.Encoding'

class PathSeparatorEncoder : System.Text.UTF8Encoding {
    PathSeparatorEncoder() : base($true) { }

    [byte[]] GetBytes([string] $s)
    {
        $s = $s.Replace("\", "/");
        return ([System.Text.UTF8Encoding]$this).GetBytes($s);
    }
}

# Wrap in a try/catch so exceptions will bubble from calls to .Net methods
try {
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
                [System.IO.Compression.ZipFile]::CreateFromDirectory($sourceDir, "$targetDir/task.zip", [System.IO.Compression.CompressionLevel]::Optimal, $false, [PathSeparatorEncoder]::new())
            }
    } else {
        # Create the target directory.
        $targetDir = [System.IO.Path]::GetDirectoryName($TargetPath)
        if (!(Test-Path -LiteralPath $targetDir -PathType Container)) {
            $null = New-Item -Path $targetDir -ItemType Directory
        }

        # Create the zip.
        [System.IO.Compression.ZipFile]::CreateFromDirectory($SourceRoot, $TargetPath, [System.IO.Compression.CompressionLevel]::Optimal, $false, [PathSeparatorEncoder]::new())
    }
} catch {
    throw $_
}
