[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Helpers.ps1
Register-Mock Get-MSBuildLocation

# Act/Assert.
Assert-Throws { Select-MSBuildLocation -Method 'Version' -Location '' -Version '' -Architecture 'Some architecture' }
