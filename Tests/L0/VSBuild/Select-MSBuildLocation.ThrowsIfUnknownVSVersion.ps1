[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\VSBuild\Helpers.ps1
Register-Mock Get-LocalizedString { $OFS = " " ; "$args" }
    
# Act/Assert.
Assert-Throws { Select-MSBuildLocation -VSVersion 'Unknown VS version' -Architecture 'Some architecture' } -MessagePattern "*Unknown VS version*"
