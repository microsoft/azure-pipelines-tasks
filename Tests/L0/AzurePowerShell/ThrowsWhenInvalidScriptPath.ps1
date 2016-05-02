[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
foreach ($path in @( "script`rpath", "script`npath" )) {
    Unregister-Mock Get-VstsInput
    Register-Mock Get-VstsInput { $path } -- -Name ScriptPath -Require

    # Act/Assert.
    Assert-Throws {
        & $PSScriptRoot/../../../Tasks/AzurePowerShell/AzurePowerShell.ps1
    } -MessagePattern "InvalidScriptPath0*$path"
}
