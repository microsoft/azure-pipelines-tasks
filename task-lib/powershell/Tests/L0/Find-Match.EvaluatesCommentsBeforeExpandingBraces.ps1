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
        #   #comment
        #   #comment2
        #   #hello.txt
        #   world.txt
        New-Item -Path "$tempDirectory\#comment" -ItemType File
        New-Item -Path "$tempDirectory\#comment2" -ItemType File
        New-Item -Path "$tempDirectory\#hello.txt" -ItemType File
        New-Item -Path "$tempDirectory\world.txt" -ItemType File
        $patterns = @(
            '#comment'
            '{#hello.txt,world.txt}'
            '#comment2'
        )
        $matchOptions = New-VstsMatchOptions

        # Act.
        $actual = Find-VstsMatch -DefaultRoot $tempDirectory -Pattern $patterns -MatchOptions $matchOptions

        # Assert.
        $expected = @(
            "$tempDirectory\#hello.txt"
            "$tempDirectory\world.txt"
        )
        Assert-AreEqual $expected $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}