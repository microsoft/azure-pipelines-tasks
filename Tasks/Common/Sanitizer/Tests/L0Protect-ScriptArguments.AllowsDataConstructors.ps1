[CmdletBinding()]
param()

Set-Item -Path env:AZP_75787_ENABLE_NEW_LOGIC -Value 'true'

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# PowerShell data constructors (@ { } [ ]) are not execution primitives and
# must pass so customers can pass `-Tag @{...}`, splatting `@params`, type
# accelerators `[string]`, and literal indices `[0]` in scriptArguments
# (PR #22171 regression follow-up; mirrors AzureCLI fix in PR #22249).
$testSuites = @(
    @{
        Name  = 'Accepts hashtable literal @{ K = "v" }'
        Input = '-Tag @{ Owner = "team" }'
    },
    @{
        Name  = 'Accepts hashtable with newline separators (YAML folded scalar)'
        Input = "-Tag @{ Solution = ""RunnerImagesGeneration""`n      ManagedBy = ""Platform-Team"" }"
    },
    @{
        Name  = 'Accepts splatting @params'
        Input = 'Invoke-Build @params'
    },
    @{
        Name  = 'Accepts type accelerator [string]'
        Input = '-Cast [string]'
    },
    @{
        Name  = 'Accepts literal index [0]'
        Input = '-Index [0]'
    },
    @{
        Name  = 'Accepts hashtable value containing @ (email)'
        Input = '-Tag @{ Owner = "team@contoso.com" }'
    },
    @{
        Name      = 'Accepts hashtable with $env: substitution in value (no dangerous chars)'
        Input     = '-Tag @{ RequestedFor = $env:requestedFor }'
        Variables = @('requestedFor=someone@contoso.com')
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
        Protect-ScriptArguments $test.Input
    }
    catch {
        throw "Error occured in '$($test.Name)' suite with input '$($test.Input)': $($_.Exception.Message)"
    }
    finally {
        $test.Variables | ForEach-Object {
            $name, $value = $_.Split('=')
            Remove-Item env:$name -ErrorAction SilentlyContinue
        }
    }
}
