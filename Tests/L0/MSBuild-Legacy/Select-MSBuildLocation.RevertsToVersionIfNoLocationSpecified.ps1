[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\LegacyHelpers.ps1
Register-Mock Get-MSBuildLocation { 'Some resolved location' } -- -Version '' -Architecture 'Some architecture'

# Act.
$actual = Select-MSBuildLocation -Method 'Location' -Location '' -Version '' -Architecture 'Some architecture'

# Assert.
Assert-AreEqual 'Some resolved location' $actual
