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
Register-Mock Initialize-Azure
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext

# Act.
$actual = @( & $PSScriptRoot\..\AzurePowerShell.ps1 )
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert.
Assert-AreEqual 4 $actual.Length
Assert-AreEqual 'Some output 1' $actual[0]
Assert-AreEqual 'Some error 1' $actual[1].Exception.Message
Assert-AreEqual 'Some output 2' $actual[2]
Assert-AreEqual 'Some error 2' $actual[3].Exception.Message