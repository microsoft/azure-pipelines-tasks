[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-MSBuildLocation.ps1
Register-Mock Get-MSBuildPath

# Act/Assert.
Assert-Throws { Select-MSBuildLocation -VSVersion '15.0' -Architecture 'Some architecture' } -MessagePattern "*MSBuild*not*found*"
