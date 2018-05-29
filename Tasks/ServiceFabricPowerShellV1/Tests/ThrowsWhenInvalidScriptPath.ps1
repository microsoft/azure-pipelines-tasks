[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\SetupMocks.ps1

foreach ($path in @( "script`rpath", "script`npath" )) {
    Unregister-Mock Get-VstsInput
    Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
    Register-Mock Get-VstsInput { $path } -- -Name ScriptPath

    # Act/Assert.
    Assert-Throws {
        . $PSScriptRoot\..\..\..\Tasks\ServiceFabricPowerShellV1\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
        & $PSScriptRoot\..\ServiceFabricPowerShell.ps1
    } -MessagePattern "InvalidScriptPath0*$path"
}
