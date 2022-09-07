[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..
Register-Mock Get-MSBuildPath

# Act/Assert.
Assert-Throws { Select-MSBuildPath -Method 'Version' -Location '' -PreferredVersion '' -Architecture 'Some architecture' }
Assert-WasCalled Get-MSBuildPath -- -Version '16.0' -Architecture 'Some architecture'
Assert-WasCalled Get-MSBuildPath -- -Version '15.0' -Architecture 'Some architecture'
Assert-WasCalled Get-MSBuildPath -- -Version '14.0' -Architecture 'Some architecture'
Assert-WasCalled Get-MSBuildPath -- -Version '12.0' -Architecture 'Some architecture'
Assert-WasCalled Get-MSBuildPath -- -Version '4.0' -Architecture 'Some architecture'
Assert-WasCalled Get-MSBuildPath -Times 6
