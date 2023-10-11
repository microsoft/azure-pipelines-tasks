[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\helpers.ps1

$passTestSuites = @(
    @{
        Name      = 'Handles empty line'
        Input     = ''
        Variables = @()
    },
    @{
        Name      = 'If no dangerous symbol in present, and FF is on'
        Input     = 'test 1'
        Variables = @('AZP_75787_ENABLE_NEW_LOGIC=true')
    },
    @{
        Name      = 'If dangerous symbols are present, and FF is off'
        Input     = 'test; test'
        Variables = @('AZP_75787_ENABLE_NEW_LOGIC=false')
    },
    @{
        Name      = 'If inside the args line is env variable with no dangerous symbols'
        Input     = 'test $env:VAR1 test'
        Variables = @('VAR1=1', 'AZP_75787_ENABLE_NEW_LOGIC=true')
    },
    @{
        Name      = 'Accepts allowed symbols'
        Input     = "a A 1 \ ` _ ' `" - = / : . * , + ~ ? % `n"
        Variables = @('AZP_75787_ENABLE_NEW_LOGIC=true')
    },
    @{
        Name      = 'Paths check'
        Input     = 'my/path 0'
        Variables = @('AZP_75787_ENABLE_NEW_LOGIC=true')
    },
    @{
        Name      = 'Accepts $true and $false'
        Input     = '$TrUe $true $fAlsE $false'
        Variables = @('AZP_75787_ENABLE_NEW_LOGIC=true')
    }
)
foreach ($test in $passTestSuites) {
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
        Test-FileArgs $test.Input
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

