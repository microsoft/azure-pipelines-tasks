[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Select-VSVersion.ps1
Register-Mock Write-Warning
Register-Mock Get-VSPath { } -- -Version 'Some unknown VS version'
Register-Mock Get-VSPath { 'Some location' } -- -Version '14.0'

# Act.
$actual = Select-VSVersion -PreferredVersion 'Some unknown VS version'

# Assert.
Assert-AreEqual '14.0' $actual
Assert-WasCalled Write-Warning -Times 1
