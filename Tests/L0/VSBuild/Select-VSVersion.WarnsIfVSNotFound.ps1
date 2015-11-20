[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Helpers.ps1
Register-Mock Write-Warning
Register-Mock Get-VisualStudioPath

# Act.
$actual = Select-VSVersion -PreferredVersion ''

# Assert.
Assert-AreEqual '' $actual
Assert-WasCalled Write-Warning -Times 1
