[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Select-VSVersion.ps1
Register-Mock Write-Warning
Register-Mock Get-VSPath

# Act.
$actual = Select-VSVersion -PreferredVersion ''

# Assert.
Assert-AreEqual '' $actual
Assert-WasCalled Write-Warning -Times 1
