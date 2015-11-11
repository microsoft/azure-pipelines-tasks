[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\TestHelpers.ps1
Register-Stub Invoke-SomeCommand

# Act / Assert throws.
Assert-Throws { Assert-WasCalled Invoke-SomeCommand }
