[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Select-MSBuildLocation.ps1
Register-Mock Get-MSBuildPath { 'Some resolved location' } -- -Version '15.0' -Architecture 'Some architecture' -SearchCom: $true

# Act.
$actual = Select-MSBuildLocation -Method 'Version' -Location 'Some input location' -Version '15.0' -Architecture 'Some architecture'

# Assert.
Assert-AreEqual 'Some resolved location' $actual
