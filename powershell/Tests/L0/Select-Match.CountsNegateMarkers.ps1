[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        '\hello\world.txt'
        '\hello\two-negate-markers.txt'
        '\hello\four-negate-markers.txt'
        '\initial-includes\hello.txt'
        '\initial-includes\one-negate-markers.txt'
        '\initial-includes\three-negate-markers.txt'
    )
    $patterns = @(
        '\initial-includes\*.txt'
        '!!\hello\two-negate-markers.txt'
        '!!!!\hello\four-negate-markers.txt'
        '!\initial-includes\one-negate-markers.txt'
        '!!!\initial-includes\three-negate-markers.txt'
    )

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $patterns

    # Assert.
    $expected = @(
        '\hello\two-negate-markers.txt'
        '\hello\four-negate-markers.txt'
        '\initial-includes\hello.txt'
    )
    Assert-AreEqual $expected $actual
}