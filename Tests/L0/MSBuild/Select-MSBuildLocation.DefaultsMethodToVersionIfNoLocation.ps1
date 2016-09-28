[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Select-MSBuildLocation.ps1
Register-Mock Get-MSBuildPath { 'Some resolved location' } -- -Version '' -Architecture 'Some architecture' -SearchCom: $false # Should not search COM since version is not 15.0.

# Act.
$actual = Select-MSBuildLocation -Method '' -Location '' -Version '' -Architecture 'Some architecture'

# Assert.
Assert-AreEqual 'Some resolved location' $actual
