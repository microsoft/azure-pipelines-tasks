[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Isolation lock. Legacy direct callers (AzureFileCopy, PowerShellV2,
# PowerShellOnTargetMachines, WindowsMachineFileCopy, Sql*Deployment) call
# Get-SanitizedArguments / Protect-ScriptArguments WITHOUT -AllowDataConstructors.
# That strict path must stay byte-for-byte unchanged: the data-constructor
# characters @ { } [ ] are still treated as forbidden and the AST backstop never
# runs. Only the new opt-in dispatcher path relaxes them.
$dataConstructorInput = '@{ Port = 8080 }'

$strict, $null  = Get-SanitizedArguments -InputArgs $dataConstructorInput
$relaxed, $null = Get-SanitizedArguments -InputArgs $dataConstructorInput -AllowDataConstructors

# Strict (default) path still strips @ { } - legacy behavior preserved.
Assert-AreNotEqual -NotExpected $dataConstructorInput -Actual $strict `
    -Message "Strict path must continue to sanitize data-constructor characters for legacy callers"

# Relaxed path leaves the legitimate data constructor intact.
Assert-AreEqual -Expected $dataConstructorInput -Actual $relaxed `
    -Message "Relaxed path must preserve legitimate data constructors"

# A bracket-only input behaves the same way: stripped by default, preserved with the switch.
$bracketInput = 'value[0]'
$strictBracket, $null  = Get-SanitizedArguments -InputArgs $bracketInput
$relaxedBracket, $null = Get-SanitizedArguments -InputArgs $bracketInput -AllowDataConstructors

Assert-AreNotEqual -NotExpected $bracketInput -Actual $strictBracket `
    -Message "Strict path must continue to sanitize bracket characters for legacy callers"
Assert-AreEqual -Expected $bracketInput -Actual $relaxedBracket `
    -Message "Relaxed path must preserve bracket characters"
