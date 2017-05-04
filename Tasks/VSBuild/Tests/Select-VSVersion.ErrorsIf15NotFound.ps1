[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-VSVersion.ps1
Register-Mock Write-Warning
Register-Mock Get-VSPath

# Act/Act.
Assert-Throws { Select-VSVersion -PreferredVersion '15.0' } -MessagePattern '*not*found*15.0*'
