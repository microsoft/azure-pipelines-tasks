[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/PerformsBasicFlow_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { 'arg1 arg2' } -- -Name ScriptArguments
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $true } -- -Name FailOnStandardError
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Get-Module
Register-Mock Initialize-AzModule
Register-Mock Get-VstsEndpoint { @{auth = @{ scheme = "ServicePrincipal" }} }
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext
Register-Mock Assert-VstsPath
Register-Mock Invoke-VstsTool { }
Register-Mock Write-VstsTaskError
Register-Mock Write-VstsSetResult
Register-Mock Expand-ModuleZip
Register-Mock Invoke-RestMethod
Register-Mock Save-Module

# Act.
$actual = & $PSScriptRoot\..\AzurePowerShell.ps1

# Assert the error action preference was set to Continue.
Assert-AreEqual "Continue" $global:ErrorActionPreference
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert the Azure helpers module was imported and invoked.
Assert-WasCalled Import-Module -- ([System.IO.Path]::GetFullPath("$PSScriptRoot\..\ps_modules\VstsAzureHelpers_"))
