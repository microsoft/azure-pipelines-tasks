[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Stub Invoke-SomeCommand
Invoke-SomeCommand -Param1 Value1 -Param2 Value2

# Act / Assert throw.
Assert-Throws { Assert-WasCalled Invoke-SomeCommand -- -Param1 Value1 -Param2 DifferentValue }
