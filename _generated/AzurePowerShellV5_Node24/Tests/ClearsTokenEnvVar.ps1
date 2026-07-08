[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Invoke-ScriptArgumentSanitization
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "myArmConnection" } -- -Name ConnectedServiceNameARM -Require
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/PerformsBasicFlow_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { 'arg1 arg2' } -- -Name ScriptArguments
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $true } -- -Name FailOnStandardError
Register-Mock Get-VstsInput { $true } -- -Name pwsh -AsBool -Default $false
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Get-Module
Register-Mock Initialize-AzModule
Register-Mock Get-VstsEndpoint { @{auth = @{ scheme = "ServicePrincipal" }} } -- -Name myArmConnection -Require
Register-Mock Get-VstsEndpoint { @{auth = @{ scheme = "ServicePrincipal"; parameters = @{ AccessToken = "eyJfakeTokenForTesting123456789" } }} } -- -Name SystemVssConnection -Require
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

# Assert: the env var is cleared after execution.
Assert-AreEqual "" $env:__VSTS_ACCESS_TOKEN "Access token env var should be cleared after execution"
