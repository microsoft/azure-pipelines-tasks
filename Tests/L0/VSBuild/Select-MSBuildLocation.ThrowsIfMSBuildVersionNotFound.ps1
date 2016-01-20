[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Select-MSBuildLocation_PS3.ps1
Register-Mock Get-MSBuildPath
    
# Act/Assert.
Assert-Throws { Select-MSBuildLocation -VSVersion '14.0' -Architecture 'Some architecture' } -MessagePattern "*MSBuild*not*found*"
