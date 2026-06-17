[CmdletBinding()]
param()

Set-Item -Path env:AZP_75787_ENABLE_NEW_LOGIC -Value 'true'

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# With -AllowDataConstructors (the path the dispatcher uses for AzurePowerShell
# and ServiceFabricPowerShell) legitimate hashtable arguments, splatting, bare
# type / index literals, quoted values and environment variables must pass
# without being rejected, even though the strict allow-list mangles @ { } [ ].
$benignInputs = @(
    @{ Name = 'Plain hashtable';            Input = '@{ Port = 8080 }' },
    @{ Name = 'Hashtable string value';     Input = '@{ Owner = "user@contoso.com" }' },
    @{ Name = 'Named hashtable parameter';  Input = '-Tags @{ env = "prod" }' },
    @{ Name = 'Bare type literal';          Input = '[string]' },
    @{ Name = 'Index literal';              Input = '[0]' },
    @{ Name = 'Splatting variable';         Input = '@params' },
    @{ Name = 'Boolean';                    Input = '-Enabled $true' },
    @{ Name = 'Ordinary parameters';        Input = '-Param1 value1 -Param2 value2' },
    @{ Name = 'Env variable expansion';     Input = 'test $env:VAR1 done'; Variables = @('VAR1=hello') }
)

foreach ($test in $benignInputs) {
    if ($null -eq $test.Variables) { $test.Variables = @() }
    $test.Variables | ForEach-Object {
        $name, $value = $_.Split('=')
        if ($value) { Set-Item -Path env:$name -Value $value } else { Remove-Item env:$name -ErrorAction SilentlyContinue }
    }

    try {
        Protect-ScriptArguments -InputArgs $test.Input -AllowDataConstructors
    }
    catch {
        throw "Expected '$($test.Name)' input [$($test.Input)] to pass the relaxed sanitizer, but it threw: $($_.Exception.Message)"
    }
    finally {
        $test.Variables | ForEach-Object {
            $name, $value = $_.Split('=')
            Remove-Item env:$name -ErrorAction SilentlyContinue
        }
    }
}
