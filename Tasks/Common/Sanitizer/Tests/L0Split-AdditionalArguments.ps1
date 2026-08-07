[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$argumentsFormats = @(
    "",                                             # Empty string
    " ",                                            # Single space
    "--flag",                                       # Single word
    "--flag1 --flag2",                              # Multiple words separated by space
    "--path='a b' --flag",                          # Single-quoted value with embedded space
    "--path=`"C:\my folder\file.txt`" --recursive=true", # Double-quoted value with embedded space
    "`"--recursive=true`" `"--overwrite=true`"",    # Two independently double-quoted tokens
    "--tag=foo`"bar baz`"qux",                      # Mid-token double-quoted span merges into one token
    "--empty='' --next=1"                           # Empty single-quoted token
)

$expectedOutputs = @(
    @(),
    @(),
    @("--flag"),
    @("--flag1", "--flag2"),
    @("--path=a b", "--flag"),
    @("--path=C:\my folder\file.txt", "--recursive=true"),
    @("--recursive=true", "--overwrite=true"),
    @("--tag=foobar bazqux"),
    @("--empty=", "--next=1")
)

for ($i = 0; $i -lt $argumentsFormats.Length; $i++) {
    # Act
    [string[]]$splitArguments = @(Split-AdditionalArguments -additionalArguments $argumentsFormats[$i])

    # Assert
    Assert-AreEqual -Expected $expectedOutputs[$i] -Actual $splitArguments
}
