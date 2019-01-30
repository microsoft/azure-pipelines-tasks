[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/NativeCommandError_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { "stop" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $false } -- -Name FailOnStandardError
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Initialize-AzModule
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext
Register-Mock Get-VstsEndpoint

# Act.
$actual = @( & $PSScriptRoot\..\AzurePowerShell.ps1 )
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert.
Assert-AreEqual 4 $actual.Length
Assert-AreEqual 'output 1' $actual[0]
Assert-AreEqual 'NativeCommandError' $actual[1].FullyQualifiedErrorId
Assert-AreEqual 'NativeCommandErrorMessage' $actual[2].FullyQualifiedErrorId
Assert-AreEqual 'output 2' $actual[3]