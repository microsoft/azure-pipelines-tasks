[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\Gulp\Helpers.ps1
Register-Stub Set-Location

# Act.
$actual = Get-WorkingDirectoryParameter -Cwd 'Some working directory'

# Assert.
Assert-WasCalled Set-Location -- 'Some working directory'
Assert-AreEqual -Expected 'Some working directory' -Actual $actual
