[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Select-VSVersion.ps1
Register-Mock Get-VSPath { 'Some location' } -- -Version 'Some preferred version'

# Act.
$actual = Select-VSVersion -PreferredVersion 'Some preferred version'

# Assert.
Assert-AreEqual 'Some preferred version' $actual
