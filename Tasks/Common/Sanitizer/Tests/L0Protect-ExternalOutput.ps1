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
    $actual = Protect-ExternalOutput -InputObject $test.Input -Source 'remote'
    Assert-AreEqual -Expected $test.Expected -Actual $actual -Message "Error occured in '$($test.Name)' suite."
}

# Also verify pipeline usage (how task code calls it: `... | Protect-ExternalOutput -Source 'remote'`).
$piped = 'row1', '##vso[task.setvariable variable=BASH_ENV]/tmp/payload' | Protect-ExternalOutput -Source 'remote'
Assert-AreEqual -Expected 'row1' -Actual $piped[0] -Message 'Pipeline input: first line should be unaffected.'
Assert-AreEqual -Expected '##_vso[task.setvariable variable=BASH_ENV]/tmp/payload' -Actual $piped[1] -Message 'Pipeline input: second line should be neutralized.'

# $null must pass through without throwing, mirroring how a missing/empty
# Invoke-Sqlcmd result could reach this function.
$nullResult = Protect-ExternalOutput -InputObject $null -Source 'remote'
Assert-AreEqual -Expected $null -Actual $nullResult -Message '$null input should pass through unchanged.'

# -Source is mandatory, mirroring azure-pipelines-task-lib's required
# ExternalOutputOptions.source field.
$sourceParam = (Get-Command Protect-ExternalOutput).Parameters['Source']
Assert-AreEqual -Expected $true -Actual $sourceParam.Attributes.Mandatory -Message '-Source should be a mandatory parameter.'

$invalidSourceThrew = $false
try {
    'text' | Protect-ExternalOutput -Source 'bogus' | Out-Null
}
catch {
    $invalidSourceThrew = $true
}
Assert-AreEqual -Expected $true -Actual $invalidSourceThrew -Message 'An invalid -Source value should be rejected.'

# --- -EnableVsoCommands / -AllowedVsoCommands allowlist behavior ---
# Mirrors azure-pipelines-task-lib's MarkerFilter: when enabled, only an
# allowlisted "area.event" command name passes through unmodified; everything
# else - unknown commands, malformed names, or an unterminated header - still
# fails closed.

$allowlistSuites = @(
    @{
        Name     = 'Allowlisted command passes through unchanged (default allowlist)'
        Input    = '##vso[task.debug]diagnostic detail'
        Expected = '##vso[task.debug]diagnostic detail'
        Args     = @{ EnableVsoCommands = $true }
    },
    @{
        Name     = 'Allowlisted command matches case-insensitively'
        Input    = '##VSO[Task.Debug]diagnostic detail'
        Expected = '##vso[Task.Debug]diagnostic detail'
        Args     = @{ EnableVsoCommands = $true }
    },
    @{
        Name     = 'Non-allowlisted command still neutralized when enabled'
        Input    = '##vso[task.setvariable variable=BASH_ENV]/tmp/payload'
        Expected = '##_vso[task.setvariable variable=BASH_ENV]/tmp/payload'
        Args     = @{ EnableVsoCommands = $true }
    },
    @{
        Name     = 'Malformed command name (not exactly area.event) is neutralized'
        Input    = '##vso[a.b.c]x'
        Expected = '##_vso[a.b.c]x'
        Args     = @{ EnableVsoCommands = $true }
    },
    @{
        Name     = 'Header with no terminator is neutralized (fails closed)'
        Input    = '##vso[task.debug'
        Expected = '##_vso[task.debug'
        Args     = @{ EnableVsoCommands = $true }
    },
    @{
        Name     = 'Custom allowlist replaces (not extends) the default one'
        Input    = '##vso[task.debug]a ##vso[custom.event]b'
        Expected = '##_vso[task.debug]a ##vso[custom.event]b'
        Args     = @{ EnableVsoCommands = $true; AllowedVsoCommands = @('custom.event') }
    },
    @{
        Name     = 'Explicit empty allowlist allows nothing even when enabled'
        Input    = '##vso[task.debug]a'
        Expected = '##_vso[task.debug]a'
        Args     = @{ EnableVsoCommands = $true; AllowedVsoCommands = @() }
    },
    @{
        Name     = 'AllowedVsoCommands has no effect when EnableVsoCommands is not set'
        Input    = '##vso[task.debug]a'
        Expected = '##_vso[task.debug]a'
        Args     = @{ AllowedVsoCommands = @('task.debug') }
    }
)

foreach ($test in $allowlistSuites) {
    $extraArgs = $test.Args
    $actual = Protect-ExternalOutput -InputObject $test.Input -Source 'remote' @extraArgs
    Assert-AreEqual -Expected $test.Expected -Actual $actual -Message "Error occured in '$($test.Name)' suite."
}
