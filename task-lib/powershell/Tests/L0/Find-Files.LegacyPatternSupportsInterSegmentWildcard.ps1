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
            New-Item -Path $tempDirectory\Level1Dir1\Level2Dir1 -ItemType Directory
            New-Item -Path $tempDirectory\Level1Dir2\Level2Dir2 -ItemType Directory
            # Files.
            New-Item -Path $tempDirectory\IsNotAMatch.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir1\IsAMatch.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir1\IsNot.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir1\Level2Dir1\IsAMatch.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir1\Level2Dir1\IsNot.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir2\IsAMatch.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir2\IsNot.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir2\Level2Dir2\IsAMatch.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir2\Level2Dir2\IsNot.txt -ItemType File
        ) |
            ForEach-Object { $_.FullName }

        # Act.
        $actual = Find-VstsFiles -LegacyPattern "$tempDirectory\level**match.TXT"

        # Assert.
        Assert-AreEqual @(
                "$tempDirectory\Level1Dir1\IsAMatch.txt"
                "$tempDirectory\Level1Dir1\Level2Dir1\IsAMatch.txt"
                "$tempDirectory\Level1Dir2\IsAMatch.txt"
                "$tempDirectory\Level1Dir2\Level2Dir2\IsAMatch.txt"
            ) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}