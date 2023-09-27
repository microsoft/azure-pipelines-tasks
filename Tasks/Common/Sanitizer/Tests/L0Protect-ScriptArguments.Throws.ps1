[CmdletBinding()]
param()

Set-Item -Path env:AZP_75787_ENABLE_NEW_LOGIC -Value 'true'

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

$inputArgsSuites = @(
    'test; whoami',
    'test && whoami',
    'echo "$(rm ./somedir)"'
)

$expectedMsg = Get-VstsLocString -Key 'PS_ScriptArgsSanitized'

foreach ($inputArgs in $inputArgsSuites) {
    Assert-Throws {
        Protect-ScriptArguments $inputArgs
    } -MessagePattern $expectedMsg
}
