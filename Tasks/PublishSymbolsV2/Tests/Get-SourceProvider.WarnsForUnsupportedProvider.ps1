[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\IndexHelpers\SourceProviderFunctions.ps1
Register-Mock Get-VstsTaskVariable { 'Some repository provider' } -- -Name Build.Repository.Provider -Require
Register-Mock Get-VstsTaskVariable { 'Some team project ID' } -- -Name System.TeamProjectId -Require
Register-Mock Write-Warning

# Act.
$actual = Get-SourceProvider 'Some build sources directory'

# Assert.
Assert-IsNullOrEmpty $actual
Assert-WasCalled Write-Warning
