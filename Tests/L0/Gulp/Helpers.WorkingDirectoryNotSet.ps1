[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
Register-Mock -Command 'Get-Location' -Arguments @() -Func { @{ Path = 'Some location' } }

# Act.
$actual = Get-WorkingDirectoryParameter -Cwd ''

# Assert.
Assert-AreEqual -Expected 'Some location' -Actual $actual
