[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\SetupMocks.ps1
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/PerformsBasicFlow_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { 'arg1 arg2' } -- -Name ScriptArguments

# Act.
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricPowerShellV1\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
$actual = & $PSScriptRoot\..\ServiceFabricPowerShell.ps1

# Assert the error action preference was set to Continue.
Assert-AreEqual "Continue" $global:ErrorActionPreference
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert that Connect-ServiceFabricCluster was called.
Assert-WasCalled Connect-ServiceFabricCluster

# Assert the target script was invoked with the specified args.
Assert-AreEqual @('arg1', 'arg2') $actual.Args
