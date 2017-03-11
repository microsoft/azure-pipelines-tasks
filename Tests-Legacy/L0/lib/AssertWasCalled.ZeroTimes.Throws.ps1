[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Invoke-SomeCommand
Invoke-SomeCommand

# Act / Assert does not throw.
Assert-Throws { Assert-WasCalled Invoke-SomeCommand -Times 0 }
