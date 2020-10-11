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

                # Add a nuspec file to the folder
                $nuspecFile = [System.IO.Path]::Combine($sourceDir, "task.nuspec")
                Write-Host "Creating nuspec file: $nuspecFile"
                $null = New-Item $nuspecFile -ItemType File -Value "<?xml version=""1.0"" encoding=""utf-8""?><package xmlns=""http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd""><metadata><id>$($_.Name)</id><version>0.0.0</version><authors>Microsoft</authors><copyright>© Microsoft Corporation. All rights reserved.</copyright></metadata></package>"
                
                # Create the zip
                Write-Host "Compressing $($_.Name) to $($targetDir)/task.zip"
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
