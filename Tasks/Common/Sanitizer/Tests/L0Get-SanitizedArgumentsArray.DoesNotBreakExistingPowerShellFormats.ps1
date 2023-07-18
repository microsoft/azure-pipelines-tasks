[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$powershellArgumentsFormats = @(
    "-Parameter Value",               # Most common form
    "-Parameter:Value",               # Colon connects the parameter and its value
    "/p:Parameter=Value",             # Specific syntax for tools like MSBuild or NuGet
    "--Parameter Value",              # Used by cmdlets or scripts for cross-platform compatibility
    "--Parameter=Value"               # Used by cross-platform tools
)

foreach ($argument in $powershellArgumentsFormats) {

    # Act
    $sanitizedArguments = Get-SanitizedArgumentsArray -InputArgs $argument
    $sanitizedArguments = $sanitizedArguments -join ' '

    # Assert
    Assert-AreEqual $sanitizedArguments $argument
}