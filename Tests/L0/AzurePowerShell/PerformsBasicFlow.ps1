[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-VstsInput { "$PSScriptRoot/PerformsBasicFlow_TargetScript.ps1" } -- -Name ScriptPath -Require
Register-Mock Get-VstsInput { 'arg1 arg2' } -- -Name ScriptArguments
Register-Mock Initialize-Azure

# Act.
$actual = & $PSScriptRoot/../../../Tasks/AzurePowerShell/AzurePowerShell.ps1

# Assert the error action preference was set to Continue.
Assert-AreEqual "Continue" $global:ErrorActionPreference
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert the Azure helpers module was imported and invoked.
Assert-WasCalled Import-Module -- ([System.IO.Path]::GetFullPath("$PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_"))
Assert-WasCalled Initialize-Azure

# Assert the target script was invoked with the specified args.
Assert-AreEqual @('arg1', 'arg2') $actual.Args
