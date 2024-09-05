[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        '\brace-test\brace_{hello,world}.txt'
        '\brace-test\brace_hello.txt'
        '\brace-test\brace_world.txt'
        '\glob-star-test\hello\world\hello-world.txt'
        '\glob-star-test\hello\hello.txt'
        '\glob-star-test\glob-star-test.txt'
        '\dot-test\.hello\.world.txt'
        '\dot-test\.hello\other.zzz'
        '\ext-glob-test\@(hello|world).txt'
        '\ext-glob-test\hello.txt'
        '\ext-glob-test\world.txt'
        '\case-test\hello.txt'
        '\case-test\world.TXT'
        '\match-base-test\match-base-file.txt'
        'match-base-file.txt'
        '#comment-test'
        '!\negate-test\hello.txt'
        '\negate-test\hello.txt'
        '\negate-test\world.txt'
    )
    $patterns = @(
        '\brace-test\brace_{hello,world}.txt'
        '\glob-star-test\**'
        '\dot-test\*\*.txt'
        '\ext-glob-test\@(hello|world).txt'
        '\case-test\*.txt'
        'match-base-file.txt'
        '#comment-test'
        '\negate-test\*'
        '!\negate-test\hello.txt'
    )

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $patterns

    # Assert.
    $expected = @(
        '\brace-test\brace_{hello,world}.txt'
        '\glob-star-test\hello\world\hello-world.txt'
        '\glob-star-test\hello\hello.txt'
        '\glob-star-test\glob-star-test.txt'
        '\dot-test\.hello\.world.txt'
        '\ext-glob-test\hello.txt'
        '\ext-glob-test\world.txt'
        '\case-test\hello.txt'
        '\case-test\world.TXT'
        'match-base-file.txt'
        '\negate-test\world.txt'
    )
    Assert-AreEqual $expected $actual
}