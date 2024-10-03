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
        #   myproj1.proj
        #   myproj2.proj
        #   myproj3.proj
        New-Item -Path $tempDirectory\myproj1.proj -ItemType File
        New-Item -Path $tempDirectory\myproj2.proj -ItemType File
        New-Item -Path $tempDirectory\myproj3.proj -ItemType File
        $patterns = @(
            "$tempDirectory\*1.proj"
            "$tempDirectory\*2.proj"
        )

        # Act.
        $actual = Find-VstsMatch -Pattern $patterns

        # Assert.
        $expected = @(
            "$tempDirectory\myproj1.proj"
            "$tempDirectory\myproj2.proj"
        )
        Assert-AreEqual $expected $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}