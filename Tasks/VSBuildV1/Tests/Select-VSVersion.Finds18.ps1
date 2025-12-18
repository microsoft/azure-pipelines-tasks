[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-VSVersion.ps1
Register-Mock Get-VSPath { "Some resolved location" } -- -Version '18.0'

# Act.
$actual = Select-VSVersion -PreferredVersion '18.0'

# Assert.
Assert-WasCalled Get-VSPath -Times 1
Assert-AreEqual -Expected '18.0' -Actual $actual
