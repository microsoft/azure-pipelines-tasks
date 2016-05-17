[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Get-VstsInput { "$PSScriptRoot/DoesNotUnravelOutput_TargetScript.ps1" } -- -Name ScriptPath -Require
Register-Mock Initialize-Azure

# Act.
$actual = @( & $PSScriptRoot/../../../Tasks/AzurePowerShell/AzurePowerShell.ps1 )
$global:ErrorActionPreference = 'Stop' # Reset to stop.

# Assert the correct number of elements is returned.
Assert-AreEqual 2 $actual.Length

# Assert item 1 and 2 are in an array together.
Assert-AreEqual 2 @($actual[0]).Length
Assert-AreEqual 'item 1' $actual[0][0]
Assert-AreEqual 'item 2' $actual[0][1]

# Assert item 3 is separate.
Assert-AreEqual 'item 3' $actual[1]
