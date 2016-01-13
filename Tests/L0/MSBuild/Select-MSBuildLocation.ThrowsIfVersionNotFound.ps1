[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\MSBuild\Select-MSBuildLocation_PS3.ps1
Register-Mock Get-MSBuildPath

# Act/Assert.
Assert-Throws { Select-MSBuildLocation -Method 'Version' -Location '' -Version '' -Architecture 'Some architecture' }
