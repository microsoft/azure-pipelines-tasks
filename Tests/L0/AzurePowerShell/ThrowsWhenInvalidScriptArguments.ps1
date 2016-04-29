[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
foreach ($arguments in @( "script`rarguments", "script`narguments" )) {
    Unregister-Mock Get-VstsInput
    Register-Mock Get-VstsInput { $arguments } -- -Name ScriptArguments

    # Act/Assert.
    Assert-Throws {
        & $PSScriptRoot/../../../Tasks/AzurePowerShell/AzurePowerShell.ps1
    } -MessagePattern "InvalidScriptArguments0*$arguments"
}
