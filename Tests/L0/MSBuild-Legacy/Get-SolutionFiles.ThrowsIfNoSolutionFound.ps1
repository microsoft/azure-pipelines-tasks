[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Helpers.ps1
Register-Mock Find-Files { } -- -SearchPattern 'Some * solution'

# Act/Assert.
Assert-Throws { Get-SolutionFiles -Solution 'Some * solution' }
