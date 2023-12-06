[CmdletBinding()]
param()

Set-Item -Path env:AZP_75787_ENABLE_NEW_LOGIC -Value 'true'

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

$testSuites = @(
    @{
        Name  = 'Handles empty line'
        Input = ''
    },
    @{
        Name  = 'Accepts basic input'
        Input = 'test 1'
    },
    @{
        Name  = 'Accepts /<something> pattern' # Traditional way to pass parameters in CMD
        Input = '/parameter'
    },
    @{
        Name  = 'Accepts -<something> pattern' # Modern applications accept parameters with a hyphen
        Input = '-parameter'
    },
    @{
        Name  = 'Accepts --<something> pattern' #Many modern applications accept parameters with double hyphen
        Input = '--parameter'
    },
    @{
        Name  = 'Accepts <key>=<value> pattern' #Format for passing values to parameters
        Input = 'parameter=value'
    },
    @{
        Name  = 'Accepts args with dot' # Argument with dot in the middle
        Input = 'parameter value.txt'
    },
    @{
        Name  = 'Accepts -<parameter> <value> pattern' # When the parameter needs a value
        Input = '-parameter value'
    },
    @{
        Name  = 'Accepts --<parameter>=<value> pattern' # Value directly attached to the parameter with an equals sign
        Input = '--parameter=value'
    },
    @{
        Name  = 'Accepts -<Parameter> <Value> pattern' # Most common form
        Input = '-Parameter Value'
    },
    @{
        Name  = 'Accepts -<Parameter>:<Value> pattern' # Colon connects the parameter and its value
        Input = '-Parameter:Value'
    },
    @{
        Name  = 'Accepts /p:<Parameter>=<Value> pattern' # Specific syntax for tools like MSBuild or NuGet
        Input = '/p:Parameter=Value'
    },
    @{
        Name  = 'Accepts --<Parameter> <Value> pattern' # Used by cmdlets or scripts for cross-platform compatibility
        Input = '--Parameter Value'
    },
    @{
        Name  = 'Accepts --<Parameter>=<Value> pattern' # Used by cross-platform tools
        Input = '--Parameter=Value'
    },
    @{
        Name  = 'Accepts allowed symbols'
        Input = 'a A z Z 1 9 \ ` _ '' " - = / : . * , + ~ ? % #'
    },
    @{
        Name  = 'Accept paths'
        Input = 'D:\my\path d/my/path'
    },
    @{
        Name  = 'Accepts $true and $false'
        Input = '$TrUe $true $fAlsE $false'
    },
    @{
        Name  = 'Accepts escaped symbols'
        Input = 'test `; whoami `&`& echo test'
    },
    @{
        Name  = 'Accepts newline'
        Input = "line 1 `n line 2"
    }
    @{
        Name      = 'Accepts env variables with safe content'
        Value     = 'test $env:VAR1 world'
        Variables = @('VAR1=hello')
    }
)

foreach ($test in $testSuites) {
    if ($null -eq $test.Variables) {
        $test.Variables = @()
    }
    $test.Variables | ForEach-Object {
        $name, $value = $_.Split('=')
        if ($value) {
            Set-Item -Path env:$name -Value $value
        }
        else {
            Remove-Item env:$name -ErrorAction SilentlyContinue
        }
    }

    try {
        Protect-ScriptArguments $inputArgs
    }
    catch {
        throw "Error occured with '$inputArgs' input args: $($_.Exception.Message)"
    }
    finally {
        $test.Variables | ForEach-Object {
            $name, $value = $_.Split('=')
            Remove-Item env:$name -ErrorAction SilentlyContinue
        }
    }
}
