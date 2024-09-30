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
        #   hello\world.txt
        #   hello\two-negate-markers.txt
        #   hello\four-negate-markers.txt
        #   initial-includes\hello.txt
        #   initial-includes\one-negate-markers.txt
        #   initial-includes\three-negate-markers.txt
        New-Item -Path "$tempDirectory\hello" -ItemType Directory
        New-Item -Path "$tempDirectory\initial-includes" -ItemType Directory
        New-Item -Path "$tempDirectory\hello\world.txt" -ItemType File
        New-Item -Path "$tempDirectory\hello\two-negate-markers.txt" -ItemType File
        New-Item -Path "$tempDirectory\hello\four-negate-markers.txt" -ItemType File
        New-Item -Path "$tempDirectory\initial-includes\hello.txt" -ItemType File
        New-Item -Path "$tempDirectory\initial-includes\one-negate-markers.txt" -ItemType File
        New-Item -Path "$tempDirectory\initial-includes\three-negate-markers.txt" -ItemType File
        $patterns = @(
            'initial-includes\*.txt'
            '!!hello\two-negate-markers.txt'
            '!!!!hello\four-negate-markers.txt'
            '!initial-includes\one-negate-markers.txt'
            '!!!initial-includes\three-negate-markers.txt'
        )

        # Act.
        $actual = Find-VstsMatch -DefaultRoot $tempDirectory -Pattern $patterns

        # Assert.
        $expected = @(
            "$tempDirectory\hello\two-negate-markers.txt"
            "$tempDirectory\hello\four-negate-markers.txt"
            "$tempDirectory\initial-includes\hello.txt"
        )
        Assert-AreEqual ($expected | Sort-Object) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}