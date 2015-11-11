[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
Register-Mock Get-Location { @{ Path = 'Some location' } } -Arguments @()

# Act.
$actual = Get-WorkingDirectoryParameter -Cwd ''

# Assert.
Assert-AreEqual -Expected 'Some location' -Actual $actual
