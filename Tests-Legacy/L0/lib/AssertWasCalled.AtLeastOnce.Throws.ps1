[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Register-Mock Invoke-SomeCommand

# Act / Assert throws.
Assert-Throws { Assert-WasCalled Invoke-SomeCommand }
