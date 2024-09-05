[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        '!hello-world.txt'
        'hello-world.txt'
    )
    $patterns = @(
        '!hello-world.txt'
    )
    $options = New-VstsMatchOptions -FlipNegate

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $patterns -Options $options

    # Assert.
    $expected = 'hello-world.txt'
    Assert-AreEqual $expected $actual
}