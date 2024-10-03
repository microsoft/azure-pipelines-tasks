[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        '\projects\myproj1\myproj1.proj'
        '\projects\myproj2\myproj2.proj'
        '\projects\myproj3\myproj3.proj'
    )
    $patterns = @(
        '\projects\**\myproj1.proj'
        '\projects\**\myproj2.proj'
    )

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $patterns

    # Assert.
    $expected = @(
        '\projects\myproj1\myproj1.proj'
        '\projects\myproj2\myproj2.proj'
    )
    Assert-AreEqual $expected $actual
}