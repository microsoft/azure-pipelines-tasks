[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        ' hello-world.txt '
        'hello-world.txt'
    )
    $patterns = @(
        ' hello-world.txt '
    )

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $patterns

    # Assert.
    $expected = 'hello-world.txt'
    Assert-AreEqual $expected $actual
}