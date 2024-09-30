[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory |
        ForEach-Object { $_.FullName }
    try {
        # Create the following layout:
        #   brace-test\brace_{hello,world}.txt
        #   brace-test\brace_hello.txt
        #   brace-test\brace_world.txt
        #   glob-star-test\hello\world\hello-world.txt
        #   glob-star-test\hello\hello.txt
        #   glob-star-test\glob-star-test.txt
        #   dot-test\.hello\.world.txt
        #   dot-test\.hello\other.zzz
        #   ext-glob-test\+(hello).txt
        #   ext-glob-test\hellohello.txt
        #   ext-glob-test\world.txt
        #   case-test\hello.txt
        #   case-test\world.TXT
        #   match-base-test\match-base-file.txt
        #   match-base-file.txt
        #   #comment-test
        #   !negate-test\hello.txt
        #   negate-test\hello.txt
        #   negate-test\world.txt
        New-Item -Path "$tempDirectory\brace-test" -ItemType Directory
        New-Item -Path "$tempDirectory\glob-star-test\hello\world" -ItemType Directory
        New-Item -Path "$tempDirectory\dot-test\.hello" -ItemType Directory
        New-Item -Path "$tempDirectory\ext-glob-test" -ItemType Directory
        New-Item -Path "$tempDirectory\case-test" -ItemType Directory
        New-Item -Path "$tempDirectory\match-base-test" -ItemType Directory
        New-Item -Path "$tempDirectory\!negate-test" -ItemType Directory
        New-Item -Path "$tempDirectory\negate-test" -ItemType Directory
        New-Item -Path "$tempDirectory\brace-test\brace_{hello,world}.txt" -ItemType File
        New-Item -Path "$tempDirectory\brace-test\brace_hello.txt" -ItemType File
        New-Item -Path "$tempDirectory\brace-test\brace_world.txt" -ItemType File
        New-Item -Path "$tempDirectory\glob-star-test\hello\world\hello-world.txt" -ItemType File
        New-Item -Path "$tempDirectory\glob-star-test\hello\hello.txt" -ItemType File
        New-Item -Path "$tempDirectory\glob-star-test\glob-star-test.txt" -ItemType File
        New-Item -Path "$tempDirectory\dot-test\.hello\.world.txt" -ItemType File
        New-Item -Path "$tempDirectory\dot-test\.hello\other.zzz" -ItemType File
        New-Item -Path "$tempDirectory\ext-glob-test\+(hello).txt" -ItemType File
        New-Item -Path "$tempDirectory\ext-glob-test\hellohello.txt" -ItemType File
        New-Item -Path "$tempDirectory\ext-glob-test\world.txt" -ItemType File
        New-Item -Path "$tempDirectory\case-test\hello.txt" -ItemType File
        New-Item -Path "$tempDirectory\case-test\world.TXT" -ItemType File
        New-Item -Path "$tempDirectory\match-base-test\match-base-file.txt" -ItemType File
        New-Item -Path "$tempDirectory\match-base-file.txt" -ItemType File
        New-Item -Path "$tempDirectory\#comment-test" -ItemType File
        New-Item -Path "$tempDirectory\!negate-test\hello.txt" -ItemType File
        New-Item -Path "$tempDirectory\negate-test\hello.txt" -ItemType File
        New-Item -Path "$tempDirectory\negate-test\world.txt" -ItemType File
        $patterns = @(
            'brace-test\brace_{hello,world}.txt'
            'glob-star-test\**'
            'dot-test\*\*.txt'
            'ext-glob-test\+(hello).txt'
            'case-test\*.txt'
            'match-base-file.txt'
            '#comment-test'
            'negate-test\*'
            '!negate-test\hello.txt'
        )

        # Act.
        $actual = Find-VstsMatch -DefaultRoot $tempDirectory -Pattern $patterns

        # Assert.
        $expected = @(
            "$tempDirectory\brace-test\brace_{hello,world}.txt"
            "$tempDirectory\glob-star-test\hello\world"
            "$tempDirectory\glob-star-test\hello\world\hello-world.txt"
            "$tempDirectory\glob-star-test\hello"
            "$tempDirectory\glob-star-test\hello\hello.txt"
            "$tempDirectory\glob-star-test\glob-star-test.txt"
            "$tempDirectory\dot-test\.hello\.world.txt"
            "$tempDirectory\ext-glob-test\hellohello.txt"
            "$tempDirectory\case-test\hello.txt"
            "$tempDirectory\case-test\world.TXT"
            "$tempDirectory\match-base-file.txt"
            "$tempDirectory\negate-test\world.txt"
        )
        Assert-AreEqual ($expected | Sort-Object) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}