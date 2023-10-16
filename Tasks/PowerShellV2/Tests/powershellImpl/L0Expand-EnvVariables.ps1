[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\helpers.ps1

$testSuites = @(
    @{
        Name      = 'Handles empty line'
        Input     = ''
        Variables = @()
        Expected  = ''
    },
    @{
        Name      = 'Expanding known env variables'
        Input     = '$env:VAR1 2'
        Variables = @('VAR1=1')
        Expected  = '1 2'
    },
    @{
        Name      = 'Expanding env variables with brace syntax'
        Input     = '${env:VAR1} 2'
        Variables = @('VAR1=1')
        Expected  = '1 2'
    },
    @{
        Name      = 'Expanding multiple env variables'
        Input     = '1 $env:VAR1 $env:VAR2'
        Variables = @('VAR1=2', 'VAR2=3')
        Expected  = '1 2 3'
    },
    @{
        Name      = 'Expanding multiple env variables 2'
        Input     = '$env:VAR1 $env:VAR2'
        Variables = @('VAR1=1', 'VAR2=2')
        Expected  = '1 2'
    },
    @{
        Name      = 'Expanding multiple close env variables'
        Input     = '$env:VAR1 $env:VAR2$env:VAR3'
        Variables = @('VAR1=1', 'VAR2=2', 'VAR3=3')
        Expected  = '1 23'
    },
    @{
        Name      = 'Expanding multiple close env variables 2'
        Input     = '$env:VAR1${env:VAR2}_$env:VAR3'
        Variables = @('VAR1=1', 'VAR2=2', 'VAR3=3')
        Expected  = '12_3'
    },
    @{
        Name      = 'Expanding multiple close env variables 3'
        Input     = '${env:VAR1}$env:VAR2'
        Variables = @('VAR1=1', 'VAR2=2')
        Expected  = '12'
    },
    @{
        Name      = 'Not expanding nested env variables'
        Input     = '$env:VAR1 $env:VAR2'
        Variables = @('VAR1=$env:NESTED', 'VAR2=2', 'NESTED=nested')
        Expected  = '$env:NESTED 2'
    },
    @{
        Name      = 'Not expanding if backtick before env var'
        Input     = '`$env:VAR1'
        Variables = @('VAR1=val1')
        Expected  = '$env:VAR1'
    },
    @{
        Name      = 'Not expanding if backtick at start of env var'
        Input     = '$`env:VAR1'
        Variables = @('VAR1=val1')
        Expected  = '$`env:VAR1'
    },
    @{
        Name      = 'Not expanding if backtick inside env var'
        Input     = '$env:VA`R1'
        Variables = @('VAR1=val1')
        Expected  = '$env:VA`R1'
    },
    @{
        Name      = 'If variable inside single quotes, it should be ignored'
        Input     = '$env:VAR1 ''$env:VAR2'''
        Variables = @('VAR1=val1', 'VAR2=val2')
        Expected  = 'val1 ''$env:VAR2'''
    },
    @{
        Name      = 'If variable inside single quotes, it should be ignored 2'
        Input     = '$env:VAR1 '' _ ${env:VAR2} _ '''
        Variables = @('VAR1=val1', 'VAR2=val2')
        Expected  = 'val1 '' _ ${env:VAR2} _ '''
    },
    @{
        Name      = 'If variable inside single quotes, it should be ignored 3'
        Input     = '$env:VAR1 '' _ $env:VAR2 _ $env:VAR3'''
        Variables = @('VAR1=val1', 'VAR2=val2', 'VAR3=val3')
        Expected  = 'val1 '' _ $env:VAR2 _ $env:VAR3'''
    },
    @{
        Name      = 'If variable inside double quotes, it should be expanded'
        Input     = '$env:VAR1 "$env:VAR2"'
        Variables = @('VAR1=val1', 'VAR2=val2')
        Expected  = 'val1 "val2"'
    },
    @{
        Name      = 'If quotes closed, variable should be expanded'
        Input     = '''''$env:VAR1'
        Variables = @('VAR1=val1')
        Expected  = '''''val1'
    },
    @{
        Name      = 'If quotes closed, variable should be expanded 2'
        Input     = '''''$env:VAR1'''''
        Variables = @('VAR1=val1')
        Expected  = '''''val1'''''
    },
    @{
        Name      = 'If variable does not exists, it should not expand'
        Input     = '$env:VAR1 2'
        Variables = @('VAR1=')
        Expected  = '$env:VAR1 2'
    },
    @{
        Name = 'If variable syntax is incorrect, it should leave it as is'
        Input = '$venv:VAR1 ${_env:VAR2}'
        Variables = @('VAR1=val1', 'VAR2=val2')
        Expected = '$venv:VAR1 ${_env:VAR2}'
    },
    @{
        Name = 'If closing brace is not present, it should leave it as is'
        Input = '$env:VAR1 ${env:VAR2'
        Variables = @('VAR1=val1', 'VAR2=val2')
        Expected = 'val1 ${env:VAR2'
    },
    @{
        Name = 'If closing brace is not present, it should leave it as is 2'
        Input = '${env:VAR1 ${env:VAR2}'
        Variables = @('VAR1=val1', 'VAR2=val2')
        Expected = '${env:VAR1 ${env:VAR2}'
    }
)

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

    Write-Host "Input = $($test.Input)"

    $actual, $telemetry = Expand-EnvVariables $test.Input

    try {
        Assert-AreEqual -Expected $test.Expected -Actual $actual -Message "Error occured in '$($test.Name)' suite."
    }
    finally {
        $test.Variables | ForEach-Object {
            $name, $value = $_.Split('=')
            Remove-Item env:$name -ErrorAction SilentlyContinue
        }
    }
}
