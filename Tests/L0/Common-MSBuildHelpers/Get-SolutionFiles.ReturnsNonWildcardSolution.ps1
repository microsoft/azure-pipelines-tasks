[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Find-VstsFiles { $expected } -- -LegacyPattern $solution
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers

# Act.
$actual = Get-SolutionFiles -Solution 'Some solution'

# Assert.
Assert-AreEqual 'Some solution' $actual
