[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-VSVersion.ps1
Register-Mock Get-VSPath { 'Some location' } -- -Version 'Some preferred version'

# Act.
$actual = Select-VSVersion -PreferredVersion 'Some preferred version'

# Assert.
Assert-AreEqual 'Some preferred version' $actual
Assert-WasCalled Get-VSPath -Times 1