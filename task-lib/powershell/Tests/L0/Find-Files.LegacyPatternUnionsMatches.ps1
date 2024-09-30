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
            New-Item -Path $tempDirectory\File1.txt -ItemType File
            New-Item -Path $tempDirectory\File2.txt -ItemType File
            New-Item -Path $tempDirectory\File3.txt -ItemType File
        ) |
            ForEach-Object { $_.FullName }

        # Act.
        $actual = Find-VstsFiles -LegacyPattern "$tempDirectory\file1.txt;$tempDirectory\FILE2.txt"

        # Assert.
        Assert-AreEqual @(
                "$tempDirectory\File1.txt"
                "$tempDirectory\File2.txt"
            ) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}