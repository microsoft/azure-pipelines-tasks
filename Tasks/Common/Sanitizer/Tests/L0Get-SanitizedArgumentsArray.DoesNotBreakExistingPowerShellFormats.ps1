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
    "--Parameter=Value",              # Used by cross-platform tools
    "parameter value.txt",            # Argument with dot in the middle
    "-Tag @{ Owner = `"team`" }",     # Hashtable literal — PR #22249/this PR
    "Invoke-Build @params",           # Splatting
    "-Cast [string]",                 # Type accelerator
    "-Index [0]"                      # Literal index
)

foreach ($argument in $powershellArgumentsFormats) {

    # Act
    $sanitizedArguments, $null = Get-SanitizedArguments -InputArgs $argument

    # Assert
    Assert-AreEqual -Actual $sanitizedArguments -Expected $argument
}