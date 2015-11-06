[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
Register-Stub -Command 'Set-Location'

# Act.
$actual = Get-WorkingDirectoryParameter -Cwd 'Some working directory'

# Assert.
Assert-WasCalled -Command 'Set-Location' -Arguments @( 'Some working directory' )
Assert-AreEqual -Expected 'Some working directory' -Actual $actual
