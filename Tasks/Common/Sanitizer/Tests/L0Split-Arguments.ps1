[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$argumentsFormats = @(
    "",                                      # Empty string
    " ",                                     # Single space
    "/parameter",                            # Single word
    "/parameter1 /parameter2",               # Multiple words separated by space
    "/parameter1 '/path/my file.txt'",       # Argument with spaces in quotes
    "/parameter1 '/path/my file.txt' /parameter2 'value with spaces'" # Complex example
)

$expectedOutputs = @(
    @(),
    @(),
    @("/parameter"),
    @("/parameter1", "/parameter2"),
    @("/parameter1", "/path/my file.txt"),
    @("/parameter1", "/path/my file.txt", "/parameter2", "value with spaces")
)

for ($i = 0; $i -lt $argumentsFormats.Length; $i++) {
    # Act
    [string[]]$splitArguments = Split-Arguments -arguments $argumentsFormats[$i]

    # Assert
    Assert-AreEqual $splitArguments $expectedOutputs[$i]
}