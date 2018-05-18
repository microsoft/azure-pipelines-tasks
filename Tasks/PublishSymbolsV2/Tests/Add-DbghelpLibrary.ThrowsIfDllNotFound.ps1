[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\IndexHelpers\DbghelpFunctions.ps1
Register-Mock Get-DbghelpPath { throw "This error should be thrown." }
Register-Mock Get-CurrentProcess
Register-Mock Invoke-LoadLibrary

# Act/Assert.
Assert-Throws { Add-DbghelpLibrary } -MessagePattern "This error should be thrown."
