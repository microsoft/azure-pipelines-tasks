[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Unit tests for the structural AST backstop used by the relaxed
# (-AllowDataConstructors) sanitizer path. Returns $true for pure data literals
# and $false for anything that evaluates / executes at the dot-source sink.

# SAFE: data literals, variables (incl. $env:), quoted strings, bare type/index
# literals and ordinary parameters - none of these execute code.
$safe = @(
    '',
    '   ',
    '-Param1 value1 -Param2 value2',
    '@{ Port = 8080 }',
    '@{ Owner = "user@contoso.com" }',
    "-Tags @{ env = 'prod' }",
    '@params',
    '[string]',
    '[0]',
    '$env:BUILD_REQUESTEDFOR',
    'value.txt',
    '-Path D:\my\path',
    '-Flag $true'
)

# UNSAFE: every item is an expression that evaluates at the sink when it appears
# inside a data constructor (hashtable value, array element) or as a chained
# statement. Verified against the real '. <script> <args>' / '& <script> <args>'
# sinks: these run code; the AST is the only reliable way to tell them apart from
# the data literals above, because they use only allow-listed characters.
$unsafe = @(
    '@{ k = New-Item -Path C:\evil.txt -ItemType File -Force }', # nested command
    '@{ Tag = Get-Content C:\secret.txt }',                      # nested command
    '@{ k = $(whoami) }',                                        # sub-expression
    "@{ k = [adsi]'LDAP://x' }",                                 # type cast
    '@{ k = [System.Net.Dns]::MachineName }',                    # property getter
    '@{ k = [System.IO.File]::WriteAllText("a","b") }',          # method call
    '@( New-Item C:\evil.txt )',                                 # command in array
    '{ whoami }',                                                # script block
    '@{ k = { whoami } }',                                       # script block value
    'value; whoami',                                             # chained statement
    'a | whoami'                                                 # pipeline
)

foreach ($s in $safe) {
    Assert-AreEqual -Expected $true -Actual (Test-SanitizerArgumentAst $s) -Message "Expected SAFE: [$s]"
}

foreach ($u in $unsafe) {
    Assert-AreEqual -Expected $false -Actual (Test-SanitizerArgumentAst $u) -Message "Expected UNSAFE: [$u]"
}
