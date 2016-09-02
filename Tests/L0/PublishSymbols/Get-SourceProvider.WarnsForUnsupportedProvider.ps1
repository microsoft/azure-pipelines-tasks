[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\SourceProviderFunctions.ps1
Register-Mock Get-VstsTaskVariable { 'Some repository provider' } -- -Name Build.Repository.Provider -Require
Register-Mock Get-VstsTaskVariable { 'Some build sources directory' } -- -Name Build.SourcesDirectory -Require
Register-Mock Get-VstsTaskVariable { 'Some team project ID' } -- -Name System.TeamProjectId -Require
Register-Mock Write-Warning

# Act.
$actual = Get-SourceProvider

# Assert.
Assert-IsNullOrEmpty $actual
Assert-WasCalled Write-Warning
