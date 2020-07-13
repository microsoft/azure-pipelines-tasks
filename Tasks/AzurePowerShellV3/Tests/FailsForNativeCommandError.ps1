[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/NativeCommandError_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { "silentlyContinue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $true } -- -Name FailOnStandardError
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Initialize-Azure
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext

# Act.
$actual = @( & $PSScriptRoot\..\AzurePowerShell.ps1 )
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert.
Assert-AreEqual 6 $actual.Length
Assert-AreEqual 'output 1' $actual[0]
Assert-AreEqual 'NativeCommandError' $actual[1].FullyQualifiedErrorId
Assert-AreEqual '##vso[task.complete result=Failed]' $actual[2]
Assert-AreEqual 'NativeCommandErrorMessage' $actual[3].FullyQualifiedErrorId
Assert-AreEqual '##vso[task.complete result=Failed]' $actual[4]
Assert-AreEqual 'output 2' $actual[5]