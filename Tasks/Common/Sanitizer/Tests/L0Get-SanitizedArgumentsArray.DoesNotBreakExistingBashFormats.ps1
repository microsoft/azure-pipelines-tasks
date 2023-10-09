[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$bashArgumentsFormats = @(
    "-parameter",                     # Single hyphen followed by a single letter or digit (POSIX style)
    "-parameter value",               # When the parameter needs a value
    "--parameter",                    # Double hyphen followed by a word (GNU style)
    "--parameter=value",              # Value directly attached to the parameter with an equals sign
    "parameter=value",                 # Used to pass environment variables to a command
    "parameter value.txt"             # Argument with dot in the middle
)

foreach ($argument in $bashArgumentsFormats) {

    # Act
    $sanitizedArguments = Get-SanitizedArguments -InputArgs $argument

    # Assert
    Assert-AreEqual -Actual $sanitizedArguments -Expected $argument
}
