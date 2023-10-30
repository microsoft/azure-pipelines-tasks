[CmdletBinding()]
param()

Set-Item -Path env:AZP_75787_ENABLE_NEW_LOGIC -Value 'true'

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

$testSuites = @(
    @{
        Name      = 'If dangerous symbols are present, and FF is on'
        Input     = 'test; whoami'
        Variables = @()
    },
    @{
        Name      = 'Test with &'
        Input     = 'test && whoami'
        Variables = @()
    },
    @{
        Name = 'Test with $(...)'
        Input = 'echo "$(rm ./somedir)"'
        Variables = @()
    },
    @{
        Name      = 'Test with |'
        Input     = 'test | whoami'
        Variables = @()
    },
    @{
        Name      = 'If inside args line is env variable with dangerous symbols'
        Input     = 'test $env:VAR1 test'
        Variables = @('VAR1=12;3')
    },
    @{
        Name      = 'If inside args line not correct env syntax'
        Input     = 'test $venv:VAR1 test'
        Variables = @('VAR1=123')
    }
)

$expectedMsg = Get-VstsLocString -Key 'PS_ScriptArgsSanitized'

foreach ($test in $testSuites) {
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
        Assert-Throws {
            Protect-ScriptArguments $test.Input
        } -MessagePattern $expectedMsg
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
