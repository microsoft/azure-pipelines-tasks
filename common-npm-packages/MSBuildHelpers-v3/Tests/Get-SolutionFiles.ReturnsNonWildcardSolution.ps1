[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Find-VstsFiles { $expected } -- -LegacyPattern $solution
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1

# Act.
$actual = Get-SolutionFiles -Solution 'Some solution'

# Assert.
Assert-AreEqual 'Some solution' $actual
