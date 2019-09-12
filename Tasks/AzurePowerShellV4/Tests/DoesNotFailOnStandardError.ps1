[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/RedirectsErrors_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $false } -- -Name FailOnStandardError
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Initialize-AzModule
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext
Register-Mock Get-VstsEndpoint
Register-Mock Assert-VstsPath
Register-Mock Invoke-VstsTool { }

# Act.
$actual = @( & $PSScriptRoot\..\AzurePowerShell.ps1 )
$global:ErrorActionPreference = 'Stop' # Reset to stop.