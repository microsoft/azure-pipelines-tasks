[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Helpers.ps1
Register-Mock Write-Warning
Register-Mock Get-VisualStudioPath { } -- -Version 'Some unknown VS version'
Register-Mock Get-VisualStudioPath { 'Some location' } -- -Version '14.0'

# Act.
$actual = Select-VSVersion -PreferredVersion 'Some unknown VS version'

# Assert.
Assert-AreEqual '14.0' $actual
Assert-WasCalled Write-Warning -Times 1
