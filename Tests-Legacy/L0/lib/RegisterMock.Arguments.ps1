[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Invoke-SomeCommand -Func { 'Expected value' } -- -Param1 Value1 -Param2 Value2

# Act.
$actual = Invoke-SomeCommand -Param1 Value1 -Param2 Value2

# Assert.
Assert-AreEqual 'Expected value' $actual
