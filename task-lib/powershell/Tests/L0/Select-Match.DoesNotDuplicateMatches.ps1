[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        '\solution1\proj1.proj'
        '\solution1\proj2.proj'
        '\solution2\proj1.proj'
        '\not-included\readme.txt'
    )
    $patterns = @(
        '\solution1\proj*.proj'
        '\**\proj1.proj'
    )

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $patterns

    # Assert.
    $expected = @(
        '\solution1\proj1.proj'
        '\solution1\proj2.proj'
        '\solution2\proj1.proj'
    )
    Assert-AreEqual $expected $actual
}