[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-MSBuildLocation.ps1
Register-Mock Get-MSBuildPath { 'Some resolved location' } -- -Version '' -Architecture 'Some architecture' -SearchCom

# Act.
$actual = Select-MSBuildLocation -Method '' -Location '' -Version '' -Architecture 'Some architecture'

# Assert.
Assert-AreEqual 'Some resolved location' $actual
