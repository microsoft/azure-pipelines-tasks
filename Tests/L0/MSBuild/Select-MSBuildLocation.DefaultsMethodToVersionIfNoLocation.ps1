[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Select-MSBuildLocation.ps1
Register-Mock Get-MSBuildPath { 'Some resolved location' }

# Act.
$actual = Select-MSBuildLocation -Method '' -Location '' -Version '' -Architecture 'Some architecture'

# Assert.
Assert-AreEqual 'Some resolved location' $actual
