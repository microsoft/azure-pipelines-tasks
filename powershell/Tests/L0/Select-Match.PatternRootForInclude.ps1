[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        '\matching\pattern\root\hello.txt'
        '\matching\pattern\root\hello\world.txt'
        '\matching\pattern\root\other.zzz'
        '\non-matching\pattern\root\hello.txt'
        '\non-matching\pattern\root\hello\world.txt'
    )
    $patterns = @(
        'hello.txt'
        '**\world.txt'
    )
    $patternRoot = '\matching\pattern\root'

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $patterns -PatternRoot $patternRoot

    # Assert.
    $expected = @(
        '\matching\pattern\root\hello.txt'
        '\matching\pattern\root\hello\world.txt'
    )
    Assert-AreEqual $expected $actual
}