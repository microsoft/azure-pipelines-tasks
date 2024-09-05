[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        '\projects\myproj1\myproj1.proj'
        '\projects\myproj2\myproj2.proj'
        '\projects\myproj3\myproj3.proj'
        '\projects\myproj4\myproj4.proj'
        '\projects\myproj5\myproj5.proj'
    )
    $patterns = @(
        '\projects\**\myproj2.proj' # mix up the order
        '\projects\**\myproj5.proj'
        '\projects\**\myproj3.proj'
        '\projects\**\myproj1.proj'
        '\projects\**\myproj4.proj'
    )

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $patterns

    # Assert.
    $expected = @(
        '\projects\myproj1\myproj1.proj' # should follow original list order
        '\projects\myproj2\myproj2.proj'
        '\projects\myproj3\myproj3.proj'
        '\projects\myproj4\myproj4.proj'
        '\projects\myproj5\myproj5.proj'
    )
    Assert-AreEqual $expected $actual
}