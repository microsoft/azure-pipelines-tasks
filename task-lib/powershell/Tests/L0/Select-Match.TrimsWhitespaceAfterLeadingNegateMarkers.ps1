[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        'hello.txt'
        'world.txt'
    )
    $patterns = @(
        '*'
        '! hello.txt'
    )

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $patterns

    # Assert.
    $expected = 'world.txt'
    Assert-AreEqual $expected $actual
}