[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\SetupMocks.ps1
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/RedirectsErrors_TargetScript.ps1" } -- -Name ScriptPath

# Act.
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricPowerShell\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
$actual = @( & $PSScriptRoot\..\ServiceFabricPowerShell.ps1 )
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert.
Assert-AreEqual 6 $actual.Length
Assert-AreEqual 'Some output 1' $actual[0]
Assert-AreEqual 'Some error 1' $actual[1].Exception.Message
Assert-AreEqual '##vso[task.complete result=Failed]' $actual[2]
Assert-AreEqual 'Some output 2' $actual[3]
Assert-AreEqual 'Some error 2' $actual[4].Exception.Message
Assert-AreEqual '##vso[task.complete result=Failed]' $actual[5]
