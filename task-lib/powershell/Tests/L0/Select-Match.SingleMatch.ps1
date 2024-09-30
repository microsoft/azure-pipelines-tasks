[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        '\projects\myproj1\myproj1.proj'
        '\projects\myproj2\myproj2.proj'
        '\projects\myproj2\readme.txt'
    )
    $pattern = '\projects\**\*.proj'

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $pattern

    # Assert.
    $expected = @(
        '\projects\myproj1\myproj1.proj'
        '\projects\myproj2\myproj2.proj'
    )
    Assert-AreEqual $expected $actual
}