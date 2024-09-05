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
            New-Item -Path $tempDirectory\IsOneMatch\IsNot -ItemType Directory
            New-Item -Path $tempDirectory\IsTwoMatch\IsNot -ItemType Directory
            New-Item -Path $tempDirectory\IsNot -ItemType Directory
            # Files.
            New-Item -Path $tempDirectory\IsOneMatch\File.txt -ItemType File
            New-Item -Path $tempDirectory\IsOneMatch\IsNot\File.txt -ItemType File
            New-Item -Path $tempDirectory\IsTwoMatch\File.txt -ItemType File
            New-Item -Path $tempDirectory\IsTwoMatch\IsNot\File.txt -ItemType File
            New-Item -Path $tempDirectory\IsNot\File.txt -ItemType File
        ) |
            ForEach-Object { $_.FullName }

        # Act.
        $actual = Find-VstsFiles -LegacyPattern "$tempDirectory\Is*Match\File.txt"

        # Assert.
        Assert-AreEqual @(
                "$tempDirectory\IsOneMatch\File.txt"
                "$tempDirectory\IsTwoMatch\File.txt"
            ) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}