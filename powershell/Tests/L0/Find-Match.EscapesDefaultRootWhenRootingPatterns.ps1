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
        #   bracket\hello.txt
        #   bracket\world.txt
        #   ext-plus\hello.txt
        #   ext-plus\world.txt
        #   ext-plus\zzz.txt
        #   brace\hello.txt
        #   brace\world.txt
        #   brace\zzz.txt
        #   initial-includes\bracket\hello.txt
        #   initial-includes\bracket\world.txt
        #   initial-includes\ext-plus\hello.txt
        #   initial-includes\ext-plus\world.txt
        #   initial-includes\ext-plus\zzz.txt
        #   initial-includes\brace\hello.txt
        #   initial-includes\brace\world.txt
        #   initial-includes\brace\zzz.txt
        $root = "$tempDirectory\find-and-match_esc-def-root\brackets[a-z]\+(p-1)\{b-1,b-2}"
        New-Item -Path "$root\bracket" -ItemType Directory
        New-Item -Path "$root\ext-plus" -ItemType Directory
        New-Item -Path "$root\brace" -ItemType Directory
        New-Item -Path "$root\initial-includes\bracket" -ItemType Directory
        New-Item -Path "$root\initial-includes\ext-plus" -ItemType Directory
        New-Item -Path "$root\initial-includes\brace" -ItemType Directory
        New-Item -Path "$root\bracket\hello.txt" -ItemType File
        New-Item -Path "$root\bracket\world.txt" -ItemType File
        New-Item -Path "$root\ext-plus\hello.txt" -ItemType File
        New-Item -Path "$root\ext-plus\world.txt" -ItemType File
        New-Item -Path "$root\ext-plus\zzz.txt" -ItemType File
        New-Item -Path "$root\brace\hello.txt" -ItemType File
        New-Item -Path "$root\brace\world.txt" -ItemType File
        New-Item -Path "$root\brace\zzz.txt" -ItemType File
        New-Item -Path "$root\initial-includes\bracket\hello.txt" -ItemType File
        New-Item -Path "$root\initial-includes\bracket\world.txt" -ItemType File
        New-Item -Path "$root\initial-includes\ext-plus\hello.txt" -ItemType File
        New-Item -Path "$root\initial-includes\ext-plus\world.txt" -ItemType File
        New-Item -Path "$root\initial-includes\ext-plus\zzz.txt" -ItemType File
        New-Item -Path "$root\initial-includes\brace\hello.txt" -ItemType File
        New-Item -Path "$root\initial-includes\brace\world.txt" -ItemType File
        New-Item -Path "$root\initial-includes\brace\zzz.txt" -ItemType File
        $patterns = @(
            'initial-includes\**\*.*'
            'bracket\[a-z]ello.txt'
            'ext-plus\+(hello|world).txt'
            'brace\{hello,world}.txt'
            '!initial-includes\bracket\[a-z]ello.txt'
            '!initial-includes\ext-plus\+(hello|world).txt'
            '!initial-includes\brace\{hello,world}.txt'
        )
        $matchOptions = New-VstsMatchOptions

        # Act.
        $actual = Find-VstsMatch -DefaultRoot $root -Pattern $patterns -MatchOptions $matchOptions

        # Assert.
        $expected = @(
            "$root\bracket\hello.txt"
            "$root\ext-plus\hello.txt"
            "$root\ext-plus\world.txt"
            "$root\brace\hello.txt"
            "$root\brace\world.txt"
            "$root\initial-includes\bracket\world.txt"
            "$root\initial-includes\ext-plus\zzz.txt"
            "$root\initial-includes\brace\zzz.txt"
        )
        Assert-AreEqual ($expected | Sort-Object) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}