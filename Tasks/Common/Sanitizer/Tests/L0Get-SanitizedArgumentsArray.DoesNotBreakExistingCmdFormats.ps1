[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$cmdArgumentsFormats = @(
    "/parameter",                     # Traditional way to pass parameters in CMD
    "-parameter",                     # Modern applications accept parameters with a hyphen
    "--parameter",                    # Many modern applications accept parameters with double hyphen
    "parameter=value",                 # Format for passing values to parameters
    "parameter value.txt"             # Argument with dot in the middle
)

foreach ($argument in $cmdArgumentsFormats) {

    # Act
    $sanitizedArguments, $null = Get-SanitizedArguments -InputArgs $argument

    # Assert
    Assert-AreEqual -Actual $sanitizedArguments -Expected $argument
}