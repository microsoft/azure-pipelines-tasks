[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Invoke-SomeCommand -Func { 'Not expected return value' } -- -Param1 Value1 -Param2 Value2

# Act.
$actual = Invoke-SomeCommand -Param1 Value1 -Param2 'Different parameter value'

# Assert.
Assert-IsNullOrEmpty $actual
