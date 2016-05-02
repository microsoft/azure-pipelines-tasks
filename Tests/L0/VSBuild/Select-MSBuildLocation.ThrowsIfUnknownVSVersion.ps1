[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Select-MSBuildLocation.ps1

# Act/Assert.
Assert-Throws { Select-MSBuildLocation -VSVersion 'Unknown VS version' -Architecture 'Some architecture' } -MessagePattern "*Unknown VS version*"
