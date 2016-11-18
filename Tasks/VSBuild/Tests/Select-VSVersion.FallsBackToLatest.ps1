[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-VSVersion.ps1
Register-Mock Write-Warning
Register-Mock Get-VSPath { "Some location" } -- -Version '15.0'

# Act.
$actual = Select-VSVersion -PreferredVersion '16.0'

# Assert.
Assert-AreEqual '15.0' $actual
Assert-WasCalled Write-Warning -Times 1
