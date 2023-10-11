[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\helpers.ps1

$throwTestSuites = @(
    @{
        Name      = 'If dangerous symbols are present, and FF is on'
        Input     = 'test; whoami'
        Variables = @('AZP_75787_ENABLE_NEW_LOGIC=true')
    },
    @{
        Name      = 'If inside args line is env variable with dangerous symbols'
        Input     = 'test $env:VAR1 test'
        Variables = @('VAR1=12;3', 'AZP_75787_ENABLE_NEW_LOGIC=true')
    },
    @{
        Name      = 'If inside args line not correct env syntax'
        Input     = 'test $venv:VAR1 test'
        Variables = @('VAR1=123', 'AZP_75787_ENABLE_NEW_LOGIC=true')
    }
)
foreach ($test in $throwTestSuites) {
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
        $msg = Get-VstsLocString -Key 'ScriptArgsSanitized'
        Assert-Throws {
            Test-FileArgs $test.Input
        } -MessagePattern $msg
    }
    catch {
        throw "Error occured in '$($test.Name)' suite: $($_.Exception.Message)"
    }
    finally {
        $test.Variables | ForEach-Object {
            $name, $value = $_.Split('=')
            Remove-Item env:$name -ErrorAction SilentlyContinue
        }
    }
}
