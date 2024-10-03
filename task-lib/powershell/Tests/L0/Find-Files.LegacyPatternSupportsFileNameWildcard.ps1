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
            New-Item -Path $tempDirectory\IsNot -ItemType Directory
            # Files.
            New-Item -Path $tempDirectory\IsOneMatch.txt -ItemType File
            New-Item -Path $tempDirectory\IsTwoMatch.txt -ItemType File
            New-Item -Path $tempDirectory\NonMatch.txt -ItemType File
            New-Item -Path $tempDirectory\IsNot\AMatch.txt -ItemType File
        ) |
            ForEach-Object { $_.FullName }

        # Act.
        $actual = Find-VstsFiles -LegacyPattern "$tempDirectory\Is*Match.txt"

        # Assert.
        Assert-AreEqual @(
                "$tempDirectory\IsOneMatch.txt"
                "$tempDirectory\IsTwoMatch.txt"
            ) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}