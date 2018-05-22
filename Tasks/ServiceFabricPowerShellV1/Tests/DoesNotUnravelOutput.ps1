[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\SetupMocks.ps1

# Setup input arguments
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/DoesNotUnravelOutput_TargetScript.ps1" } -- -Name ScriptPath

# Act.
. $PSScriptRoot\..\..\..\Tasks\ServiceFabricPowerShellV1\ps_modules\ServiceFabricHelpers\Connect-ServiceFabricClusterFromServiceEndpoint.ps1
$actual = @( & $PSScriptRoot\..\ServiceFabricPowerShell.ps1 )
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert the correct number of elements is returned.
Assert-AreEqual 2 $actual.Length

# Assert item 1 and 2 are in an array together.
Assert-AreEqual 2 @($actual[0]).Length
Assert-AreEqual 'item 1' $actual[0][0]
Assert-AreEqual 'item 2' $actual[0][1]

# Assert item 3 is separate.
Assert-AreEqual 'item 3' $actual[1]
