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
    },
    @{
        Name     = 'Neutralizes a ##vso[ marker nested inside another marker'
        Input    = '##vso[##vso[task.debug]hello'
        Expected = '##_vso[##_vso[task.debug]hello'
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

# The host encodes redirected console output with the console output encoding and best-fit maps look-alike characters to
# ASCII in single-byte code pages (437 is the usual OEM code page of an English-language Windows), so a marker can appear
# after sanitizing. The input is therefore normalized through the encoding the host writes with before it is checked.
$cp437 = [System.Text.Encoding]::GetEncoding(437)
$utf8 = New-Object System.Text.UTF8Encoding($false)
$fullwidthHashes = ([string][char]0xFF03) * 2
$fullwidthVso = '' + [char]0xFF56 + [char]0xFF53 + [char]0xFF4F
$fullwidthOpen = [string][char]0xFF3B
$fullwidthClose = [string][char]0xFF3D
$nonAscii = 'caf' + [char]0xE9 + ' ' + [char]0x65E5 + [char]0x672C

$encodingSuites = @(
    @{
        Name     = 'Neutralizes a fullwidth look-alike ##vso[ marker that the code page maps to ASCII'
        Input    = $fullwidthHashes + $fullwidthVso + $fullwidthOpen + 'task.setvariable variable=BASH_ENV' + $fullwidthClose + '/tmp/payload'
        Encoding = $cp437
        Expected = '##_vso[task.setvariable variable=BASH_ENV]/tmp/payload'
    },
    @{
        Name     = 'Neutralizes a fullwidth look-alike ##[ marker that the code page maps to ASCII'
        Input    = $fullwidthHashes + $fullwidthOpen + 'section' + $fullwidthClose + 'Fake section header'
        Encoding = $cp437
        Expected = '##_[section]Fake section header'
    },
    @{
        Name     = 'Neutralizes a marker that mixes ASCII and look-alike characters'
        Input    = '#' + [char]0xFF03 + 'vs' + [char]0xFF4F + '[task.debug]hello'
        Encoding = $cp437
        Expected = '##_vso[task.debug]hello'
    },
    @{
        Name     = 'Leaves look-alike characters alone when the host writes UTF-8, they are not a marker there'
        Input    = $fullwidthHashes + $fullwidthVso + $fullwidthOpen + 'task.debug' + $fullwidthClose + 'hello'
        Encoding = $utf8
        Expected = $fullwidthHashes + $fullwidthVso + $fullwidthOpen + 'task.debug' + $fullwidthClose + 'hello'
    },
    @{
        Name     = 'Produces the same text the host writes for ordinary non-ASCII characters'
        Input    = $nonAscii
        Encoding = $cp437
        Expected = $cp437.GetString($cp437.GetBytes($nonAscii))
    }
)

foreach ($test in $encodingSuites) {
    $actual = Protect-ExternalOutput -InputObject $test.Input -Source 'repository' -Encoding $test.Encoding
    Assert-AreEqual -Expected $test.Expected -Actual $actual -Message "Error occured in '$($test.Name)' suite."
}

# Without -Encoding the console output encoding is used, so a plain ASCII marker is neutralized either way.
$defaultEncodingResult = Protect-ExternalOutput -InputObject '##vso[task.debug]x' -Source 'repository'
Assert-AreEqual -Expected '##_vso[task.debug]x' -Actual $defaultEncodingResult -Message 'The default encoding must still neutralize an ASCII marker.'

# The production call sites never pass -Encoding; they rely on the default ([Console]::OutputEncoding). Every encoding
# test above pins -Encoding explicitly, so none of them would catch a regression that broke the default path specifically
# (for example, a typo resolving the wrong property). Pin the real console to a single-byte code page for this one test
# so the default path is exercised exactly as production uses it, without relying on whatever encoding this test happens
# to run under.
$originalOutputEncoding = $null
try {
    $originalOutputEncoding = [Console]::OutputEncoding
    [Console]::OutputEncoding = $cp437
    $hostileFullwidth = $fullwidthHashes + $fullwidthVso + $fullwidthOpen + 'task.setvariable variable=BASH_ENV' + $fullwidthClose + '/tmp/payload'
    $defaultPathResult = Protect-ExternalOutput -InputObject $hostileFullwidth -Source 'repository'
    Assert-AreEqual -Expected '##_vso[task.setvariable variable=BASH_ENV]/tmp/payload' -Actual $defaultPathResult -Message 'The default encoding path (no -Encoding passed) must neutralize a fullwidth look-alike marker under a single-byte console code page, exactly as production calls this function.'
}
finally {
    if ($null -ne $originalOutputEncoding) {
        [Console]::OutputEncoding = $originalOutputEncoding
    }
}
