[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Invoke-SomeCommand
Invoke-SomeCommand

# Act / Assert does not throw.
Assert-WasCalled Invoke-SomeCommand
