[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory |
        ForEach-Object { $_.FullName }
    try {
        @(
            # Directories.
            New-Item -Path $tempDirectory\Is1Match\IsNot -ItemType Directory
            New-Item -Path $tempDirectory\Is2Match\IsNot -ItemType Directory
            New-Item -Path $tempDirectory\IsNotMatch -ItemType Directory
            # Files.
            New-Item -Path $tempDirectory\Is1Match\File.txt -ItemType File
            New-Item -Path $tempDirectory\Is1Match\IsNot\File.txt -ItemType File
            New-Item -Path $tempDirectory\Is2Match\File.txt -ItemType File
            New-Item -Path $tempDirectory\Is2Match\IsNot\File.txt -ItemType File
            New-Item -Path $tempDirectory\IsNotMatch\File.txt -ItemType File
        ) |
            ForEach-Object { $_.FullName }

        # Act.
        $actual = Find-VstsFiles -LegacyPattern "$tempDirectory\Is?Match\File.txt"

        # Assert.
        Assert-AreEqual @(
                "$tempDirectory\Is1Match\File.txt"
                "$tempDirectory\Is2Match\File.txt"
            ) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}