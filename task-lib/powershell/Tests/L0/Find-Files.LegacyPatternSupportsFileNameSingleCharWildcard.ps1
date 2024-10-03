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
            New-Item -Path $tempDirectory\Is1Match.txt -ItemType File
            New-Item -Path $tempDirectory\Is2Match.txt -ItemType File
            New-Item -Path $tempDirectory\IsNotMatch.txt -ItemType File
            New-Item -Path $tempDirectory\IsNot\Is1Match.txt -ItemType File
        ) |
            ForEach-Object { $_.FullName }

        # Act.
        $actual = Find-VstsFiles -LegacyPattern "$tempDirectory\Is?Match.txt"

        # Assert.
        Assert-AreEqual @(
                "$tempDirectory\Is1Match.txt"
                "$tempDirectory\Is2Match.txt"
            ) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}