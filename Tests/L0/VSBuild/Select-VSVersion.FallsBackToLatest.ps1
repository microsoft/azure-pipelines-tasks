[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Select-VSVersion.ps1
Register-Mock Write-Warning
Register-Mock Get-VSPath { "Some location" } -- -Version '15.0' -SearchCom:$false

# Act.
$actual = Select-VSVersion -PreferredVersion '16.0' -SearchCom:$false

# Assert.
Assert-AreEqual '15.0' $actual
Assert-WasCalled Write-Warning -Times 1
