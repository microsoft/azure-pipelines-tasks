[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ExternalOutputSanitizer.ps1

$testSuites = @(
    @{
        Name     = 'Handles empty line'
        Input    = ''
        Expected = ''
    },
    @{
        Name     = 'Leaves plain text untouched'
        Input    = 'row1 value'
        Expected = 'row1 value'
    },
    @{
        Name     = 'Neutralizes a ##vso[ logging command marker'
        Input    = '##vso[task.setvariable variable=BASH_ENV]/tmp/payload'
        Expected = '##_vso[task.setvariable variable=BASH_ENV]/tmp/payload'
    },
    @{
        Name     = 'Neutralizes ##vso[ regardless of position in the line'
        Input    = 'ConversionError: ##vso[task.setvariable variable=BASH_ENV]/tmp/payload'
        Expected = 'ConversionError: ##_vso[task.setvariable variable=BASH_ENV]/tmp/payload'
    },
    @{
        Name     = 'Neutralizes ##vso[ regardless of casing'
        Input    = '##VsO[task.setvariable variable=BASH_ENV]/tmp/payload'
        Expected = '##_vso[task.setvariable variable=BASH_ENV]/tmp/payload'
    },
    @{
        Name     = 'Neutralizes multiple markers on the same line'
        Input    = '##vso[task.setvariable variable=A]1 ##vso[task.setvariable variable=B]2'
        Expected = '##_vso[task.setvariable variable=A]1 ##_vso[task.setvariable variable=B]2'
    },
    @{
        Name     = 'Neutralizes the bare ##[ formatting marker'
        Input    = '##[section]Fake section header'
        Expected = '##_[section]Fake section header'
    },
    @{
        Name     = 'Does not double-escape an already-neutralized marker'
        Input    = '##_vso[task.setvariable variable=BASH_ENV]/tmp/payload'
        Expected = '##_vso[task.setvariable variable=BASH_ENV]/tmp/payload'
    },
    @{
        Name     = 'Neutralizes markers across multiple piped lines'
        Input    = "row one`n##vso[task.setvariable variable=BASH_ENV]/tmp/payload`nrow three"
        Expected = "row one`n##_vso[task.setvariable variable=BASH_ENV]/tmp/payload`nrow three"
    }
)

foreach ($test in $testSuites) {
    $actual = Protect-ExternalOutput -InputObject $test.Input
    Assert-AreEqual -Expected $test.Expected -Actual $actual -Message "Error occured in '$($test.Name)' suite."
}

# Also verify pipeline usage (how task code calls it: `... | Protect-ExternalOutput`).
$piped = 'row1', '##vso[task.setvariable variable=BASH_ENV]/tmp/payload' | Protect-ExternalOutput
Assert-AreEqual -Expected 'row1' -Actual $piped[0] -Message 'Pipeline input: first line should be unaffected.'
Assert-AreEqual -Expected '##_vso[task.setvariable variable=BASH_ENV]/tmp/payload' -Actual $piped[1] -Message 'Pipeline input: second line should be neutralized.'

# $null must pass through without throwing, mirroring how a missing/empty
# Invoke-Sqlcmd result could reach this function.
$nullResult = Protect-ExternalOutput -InputObject $null
Assert-AreEqual -Expected $null -Actual $nullResult -Message '$null input should pass through unchanged.'
