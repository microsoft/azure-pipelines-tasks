[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
foreach ($arguments in @( "script`rarguments", "script`narguments" )) {
    Unregister-Mock Get-VstsInput
    Register-Mock Get-VstsInput { $arguments } -- -Name ScriptArguments

    # Act/Assert.
    Assert-Throws {
        & $PSScriptRoot\..\AzurePowerShell.ps1
    } -MessagePattern "InvalidScriptArguments0*$arguments"
}
