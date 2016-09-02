[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Select-MSBuildLocation.ps1
Register-Mock Get-MSBuildPath

# Act/Assert.
Assert-Throws { Select-MSBuildLocation -Method 'Version' -Location '' -Version '' -Architecture 'Some architecture' }
