[CmdletBinding()]
param()

Set-Item -Path env:AZP_75787_ENABLE_NEW_LOGIC -Value 'true'

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

$inputArgsSuites = @(
    "/parameter",                               # Traditional way to pass parameters in CMD
    "-parameter",                               # Modern applications accept parameters with a hyphen
    "--parameter",                              # Many modern applications accept parameters with double hyphen
    "parameter=value",                          # Format for passing values to parameters
    "parameter value.txt",                      # Argument with dot in the middle
    "-parameter value",                         # When the parameter needs a value
    "--parameter=value",                        # Value directly attached to the parameter with an equals sign
    "-Parameter Value",                         # Most common form
    "-Parameter:Value",                         # Colon connects the parameter and its value
    "/p:Parameter=Value",                       # Specific syntax for tools like MSBuild or NuGet
    "--Parameter Value",                        # Used by cmdlets or scripts for cross-platform compatibility
    "--Parameter=Value",                        # Used by cross-platform tools
    'a A z Z 1 9 \ ` _ '' " - = / : . * , + ~ ? % #',      # Just each allowed symbol
    '',
    'test 1',
    'test `; whoami `&`& echo test',
    "line 1 `n line 2",
    '$TrUe $true $fAlsE $false'
)

foreach ($inputArgs in $inputArgsSuites) {
    try {
        Protect-ScriptArguments $inputArgs
    }
    catch {
        throw "Error occured with '$inputArgs' input args: $($_.Exception.Message)"
    }
}
