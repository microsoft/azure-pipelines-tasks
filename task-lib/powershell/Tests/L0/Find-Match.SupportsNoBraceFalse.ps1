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
        #   {hello,world}.txt
        #   world.txt
        #   world.txt
        New-Item -Path "$tempDirectory\{hello,world}.txt" -ItemType File
        New-Item -Path "$tempDirectory\hello.txt" -ItemType File
        New-Item -Path "$tempDirectory\world.txt" -ItemType File
        $patterns = @(
            '{hello,world}.txt'
        )
        $matchOptions = New-VstsMatchOptions -NoBrace:$false

        # Act.
        $actual = Find-VstsMatch -DefaultRoot $tempDirectory -Pattern $patterns -MatchOptions $matchOptions

        # Assert.
        $expected = @(
            "$tempDirectory\hello.txt"
            "$tempDirectory\world.txt"
        )
        Assert-AreEqual $expected $actual
    } finally {
        Remove-Item $tempDirectory -Recurse -Force
    }
}