[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Select-VSVersion.ps1
Register-Mock Write-Warning
Register-Mock Get-VSPath { } -- -Version 'Some unknown VS version'
Register-Mock Get-VSPath { "Some location" } -ParametersEvaluator { $Version -ne 'Some unknown VS version' }

# Act.
$actual = Select-VSVersion -PreferredVersion 'Some unknown VS version'

# Assert.
Assert-AreEqual '15.0' $actual
Assert-WasCalled Write-Warning -Times 1
