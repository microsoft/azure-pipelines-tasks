[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/PerformsBasicFlow_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { 'arg1 arg2' } -- -Name ScriptArguments
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Initialize-Azure
Register-Mock Get-VstsEndpoint { @{auth = @{ scheme = "ServicePrincipal" }} }
Register-Mock Disconnect-AzureAndClearContext

# Act.
$actual = & $PSScriptRoot\..\AzurePowerShell.ps1

# Assert the error action preference was set to Continue.
Assert-AreEqual "Continue" $global:ErrorActionPreference
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert the Azure helpers module was imported and invoked.
Assert-WasCalled Import-Module -- ([System.IO.Path]::GetFullPath("$PSScriptRoot\..\ps_modules\VstsAzureHelpers_"))
Assert-WasCalled Initialize-Azure

# Assert the target script was invoked with the specified args.
Assert-AreEqual @('arg1', 'arg2') $actual.Args
