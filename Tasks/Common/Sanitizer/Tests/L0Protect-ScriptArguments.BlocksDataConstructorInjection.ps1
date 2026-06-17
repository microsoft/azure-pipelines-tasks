[CmdletBinding()]
param()

Set-Item -Path env:AZP_75787_ENABLE_NEW_LOGIC -Value 'true'

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

$expectedMsg = Get-VstsLocString -Key 'PS_ScriptArgsSanitized'

# MSRC regression lock. Each input below uses ONLY characters the relaxed
# allow-list permits (@ { } [ ] plus letters / paths), so the character regex
# leaves it unchanged - yet each is an expression that EXECUTES at the
# dot-source sink (a hashtable value, array element, cast or property getter).
# The AST backstop is what blocks them. If Test-SanitizerArgumentAst is removed
# or weakened these become remote code execution.
$astOnlyInjections = @(
    @{ Name = 'Command as hashtable value';     Input = '@{ k = New-Item -Path C:\evil.txt -ItemType File -Force }' },
    @{ Name = 'Get-Content as hashtable value'; Input = '@{ Tag = Get-Content C:\secret.txt }' },
    @{ Name = 'Cast (adsi) as value';           Input = "@{ k = [adsi]'LDAP://attacker' }" },
    @{ Name = 'Property getter as value';       Input = '@{ k = [System.Net.Dns]::MachineName }' }
)

foreach ($test in $astOnlyInjections) {
    # 1) Prove the AST is load-bearing: the relaxed CHARACTER allow-list alone
    #    does NOT alter these inputs, so the regex path would let them through.
    $sanitized, $null = Get-SanitizedArguments -InputArgs $test.Input -AllowDataConstructors
    Assert-AreEqual -Expected $test.Input -Actual $sanitized `
        -Message "'$($test.Name)' must be carried by the AST backstop, not the character regex (regex altered it unexpectedly)."

    # 2) The AST predicate rejects it.
    Assert-AreEqual -Expected $false -Actual (Test-SanitizerArgumentAst $test.Input) `
        -Message "Test-SanitizerArgumentAst should reject '$($test.Name)' [$($test.Input)]"

    # 3) The integrated relaxed path fails closed (throws) with activate on.
    try {
        Assert-Throws { Protect-ScriptArguments -InputArgs $test.Input -AllowDataConstructors } -MessagePattern $expectedMsg
    }
    catch {
        throw "Expected '$($test.Name)' [$($test.Input)] to be blocked by the relaxed sanitizer, but: $($_.Exception.Message)"
    }
}

# Defense in depth: the dangerous characters the relaxed list still forbids
# ( $ ( ) ; & | ) must remain blocked on the relaxed path as well.
$charInjections = @(
    'test; whoami',
    'test && whoami',
    'echo "$(rm ./x)"',
    'test | whoami',
    '@{ k = $(whoami) }'
)

foreach ($badInput in $charInjections) {
    try {
        Assert-Throws { Protect-ScriptArguments -InputArgs $badInput -AllowDataConstructors } -MessagePattern $expectedMsg
    }
    catch {
        throw "Expected dangerous characters in [$badInput] to be blocked on the relaxed path, but: $($_.Exception.Message)"
    }
}
