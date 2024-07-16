[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$someString = "some string"

$argumentsFormats = @(
    "",                                      # Empty string
    " ",                                     # Single space
    "/parameter",                            # Single word
    "/parameter1 /parameter2",               # Multiple words separated by space
    "/parameter1 '/path/my file.txt'",       # Argument with spaces in quotes
    "/parameter1 '/path/my file.txt' /parameter2 'value with spaces'", # Complex example
    "/parameter1 `"$someString`""            # Argument with variable in quotes
)

$expectedOutputs = @(
    @(),
    @(),
    @("/parameter"),
    @("/parameter1", "/parameter2"),
    @("/parameter1", "/path/my file.txt"),
    @("/parameter1", "/path/my file.txt", "/parameter2", "value with spaces"),
    @("/parameter1", "some string")
)

for ($i = 0; $i -lt $argumentsFormats.Length; $i++) {
    # Act
    [string[]]$splitArguments = Split-Arguments -arguments $argumentsFormats[$i]

    # Assert
    Assert-AreEqual -Expected $splitArguments -Actual $expectedOutputs[$i]
}
