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
        #   solution1\proj1\proj1.txt
        #   solution1\proj2\proj2.txt
        #   solution2\proj1\proj1.txt
        #   solution2\proj2\proj2.txt
        #   default-root\zzz.txt
        New-Item -Path "$tempDirectory\solution1\proj1" -ItemType Directory
        New-Item -Path "$tempDirectory\solution1\proj2" -ItemType Directory
        New-Item -Path "$tempDirectory\solution2\proj1" -ItemType Directory
        New-Item -Path "$tempDirectory\solution2\proj2" -ItemType Directory
        New-Item -Path "$tempDirectory\default-root" -ItemType Directory
        New-Item -Path "$tempDirectory\solution1\proj1\proj1.txt" -ItemType File
        New-Item -Path "$tempDirectory\solution1\proj2\proj2.txt" -ItemType File
        New-Item -Path "$tempDirectory\solution2\proj1\proj1.txt" -ItemType File
        New-Item -Path "$tempDirectory\solution2\proj2\proj2.txt" -ItemType File
        New-Item -Path "$tempDirectory\default-root\zzz.txt" -ItemType File
        $patterns = @(
            "$tempDirectory\solution1\**"
            "$tempDirectory\solution2\**"
            '!proj1?(.txt)'
        )
        $matchOptions = New-VstsMatchOptions -MatchBase

        # Act.
        $actual = Find-VstsMatch -DefaultRoot $tempDirectory -Pattern $patterns -MatchOptions $matchOptions

        # Assert.
        $expected = @(
            "$tempDirectory\solution1\proj2"
            "$tempDirectory\solution1\proj2\proj2.txt"
            "$tempDirectory\solution2\proj2"
            "$tempDirectory\solution2\proj2\proj2.txt"
        )
        Assert-AreEqual $expected $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}