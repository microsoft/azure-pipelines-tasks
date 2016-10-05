[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Select-MSBuildLocation.ps1
Register-Mock Write-Warning
Register-Mock Get-MSBuildPath { 'Some resolved location' } -- -Version '' -Architecture 'Some architecture' -SearchCom: $false # Should not search COM when falling back to latest.

# Act.
$actual = Select-MSBuildLocation -Method 'Version' -Location '' -Version '15.0' -Architecture 'Some architecture'

# Assert.
Assert-WasCalled Write-Warning
Assert-AreEqual 'Some resolved location' $actual
