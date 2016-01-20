[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Helpers.ps1

# Act.
$actual = Get-SolutionFiles -Solution 'Some solution'

# Assert.
Assert-AreEqual 'Some solution' $actual
