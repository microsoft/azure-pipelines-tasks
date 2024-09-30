[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory |
        ForEach-Object { $_.FullName }
    try {
        # Create the following layout:
        #   include\hello\world\include.txt
        #   include\hello\world\other.txt
        #   include\hello\include.txt
        #   include\hello\other.txt
        #   include\include.txt
        #   include\other.txt
        New-Item -Path "$tempDirectory\include\hello\world" -ItemType Directory
        New-Item -Path "$tempDirectory\include\hello\world\include.txt" -ItemType File
        New-Item -Path "$tempDirectory\include\hello\world\other.txt" -ItemType File
        New-Item -Path "$tempDirectory\include\hello\include.txt" -ItemType File
        New-Item -Path "$tempDirectory\include\hello\other.txt" -ItemType File
        New-Item -Path "$tempDirectory\include\include.txt" -ItemType File
        New-Item -Path "$tempDirectory\include\other.txt" -ItemType File
        $patterns = @(
            '?nclude?(.txt)'
        )
        $matchOptions = New-VstsMatchOptions -MatchBase

        # Act.
        $actual = Find-VstsMatch -DefaultRoot "$tempDirectory\include" -Pattern $patterns -MatchOptions $matchOptions

        # Assert.
        $expected = @(
            "$tempDirectory\include\hello\world\include.txt"
            "$tempDirectory\include\hello\include.txt"
            "$tempDirectory\include\include.txt"
            "$tempDirectory\include"
        )
        Assert-AreEqual ($expected | Sort-Object) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}