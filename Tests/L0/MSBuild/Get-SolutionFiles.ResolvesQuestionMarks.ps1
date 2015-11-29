[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Helpers.ps1
$expected = 'Some solution 1', 'Some solution 2'
Register-Mock Find-Files { $expected } -- -SearchPattern 'Some ? solution'

# Act.
$actual = Get-SolutionFiles -Solution 'Some ? solution'

# Assert.
Assert-AreEqual $expected $actual
