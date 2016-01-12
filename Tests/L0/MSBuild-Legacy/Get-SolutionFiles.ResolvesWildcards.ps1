[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Helpers.ps1
$expected = 'Some solution 1', 'Some solution 2'
$solutions = 'Some * solution', 'Some ? solution'
foreach ($solution in $solutions) {
    Register-Mock Find-Files { $expected } -- -SearchPattern $solution

    # Act.
    $actual = Get-SolutionFiles -Solution $solution

    # Assert.
    Assert-AreEqual $expected $actual
}