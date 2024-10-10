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
        #   solution1\proj1.proj
        #   solution1\proj2.proj
        #   solution2\proj1.proj
        #   not-included\readme.txt
        New-Item -Path $tempDirectory\solution1 -ItemType Directory
        New-Item -Path $tempDirectory\solution2 -ItemType Directory
        New-Item -Path $tempDirectory\not-included -ItemType Directory
        New-Item -Path "$tempDirectory\solution1\proj1.proj" -ItemType File
        New-Item -Path "$tempDirectory\solution1\proj2.proj" -ItemType File
        New-Item -Path "$tempDirectory\solution2\proj1.proj" -ItemType File
        New-Item -Path "$tempDirectory\not-included\readme.txt" -ItemType File
        $patterns = @(
            "$tempDirectory\solution1\*.proj"
            "$tempDirectory\**\proj1.proj"
        )

        # Act.
        $actual = Find-VstsMatch -Pattern $patterns

        # Assert.
        $expected = @(
            "$tempDirectory\solution1\proj1.proj"
            "$tempDirectory\solution1\proj2.proj"
            "$tempDirectory\solution2\proj1.proj"
        )
        Assert-AreEqual $expected $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}