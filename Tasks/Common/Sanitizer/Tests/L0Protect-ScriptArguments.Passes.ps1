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
    "-parameter",                               # Single hyphen followed by a single letter or digit (POSIX style)
    "-parameter value",                         # When the parameter needs a value
    "--parameter",                              # Double hyphen followed by a word (GNU style)
    "--parameter=value",                        # Value directly attached to the parameter with an equals sign
    "parameter=value",                          # Used to pass environment variables to a command
    "parameter value.txt",                      # Argument with dot in the middle
    "-Parameter Value",                         # Most common form
    "-Parameter:Value",                         # Colon connects the parameter and its value
    "/p:Parameter=Value",                       # Specific syntax for tools like MSBuild or NuGet
    "--Parameter Value",                        # Used by cmdlets or scripts for cross-platform compatibility
    "--Parameter=Value",                        # Used by cross-platform tools
    "parameter value.txt"                       # Argument with dot in the middle
    'a A 1 \ ` _ '' " - = / : . * , + ~ ? %',    # Just each allowed symbol
    '',
    'test 1',
    'test `; whoami `&`& echo test',
    "line 1 `n line 2"
)

foreach ($inputArgs in $inputArgsSuites) {
    try {
        Protect-ScriptArguments $inputArgs
    }
    catch {
        throw "Error occured with '$inputArgs' input args: $($_.Exception.Message)"
    }
}
