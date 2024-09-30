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
            New-Item -Path $tempDirectory\Match.txt -ItemType File
            New-Item -Path $tempDirectory\NotAMatch.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir1\Match.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir1\Level2Dir1\Match.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir2\Match.txt -ItemType File
            New-Item -Path $tempDirectory\Level1Dir2\Level2Dir2\Match.txt -ItemType File
        ) |
            ForEach-Object { $_.FullName }

        # Act.
        $actual = Find-VstsFiles -LegacyPattern "$tempDirectory\**\match.TXT"

        # Assert.
        Assert-AreEqual @(
                "$tempDirectory\Level1Dir1\Level2Dir1\Match.txt"
                "$tempDirectory\Level1Dir1\Match.txt"
                "$tempDirectory\Level1Dir2\Level2Dir2\Match.txt"
                "$tempDirectory\Level1Dir2\Match.txt"
                "$tempDirectory\Match.txt"
            ) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}