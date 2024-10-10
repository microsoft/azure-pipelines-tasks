[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        '#hello.txt'
        'hello.txt'
        'world.txt'
    )
    $patterns = @(
        '*'
        '!#hello.txt'
    )

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $patterns

    # Assert.
    $expected = @(
        'hello.txt'
        'world.txt'
    )
    Assert-AreEqual $expected $actual
}