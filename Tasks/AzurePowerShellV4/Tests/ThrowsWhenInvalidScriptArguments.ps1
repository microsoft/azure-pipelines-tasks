[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Invoke-ScriptArgumentSanitization
foreach ($arguments in @( "script`rarguments", "script`narguments" )) {
    Unregister-Mock Get-VstsInput
    Register-Mock Get-VstsInput { $arguments } -- -Name ScriptArguments

    # Act/Assert.
    Assert-Throws {
        & $PSScriptRoot\..\AzurePowerShell.ps1
    } -MessagePattern "InvalidScriptArguments0*$arguments"
}
