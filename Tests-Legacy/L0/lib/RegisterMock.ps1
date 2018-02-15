[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Invoke-SomeCommand -Func { 'Expected return value' }

# Act.
$actual = Invoke-SomeCommand -Param1 Value1 -Param2 Value2

# Assert.
Assert-AreEqual 'Expected return value' $actual
