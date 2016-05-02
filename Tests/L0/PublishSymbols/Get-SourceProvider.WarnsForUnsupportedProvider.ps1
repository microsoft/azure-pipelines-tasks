[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\SourceProviderFunctions.ps1
Register-Mock Get-VstsTaskVariable { 'Some repository provider' } -- -Name Build.Repository.Provider -Require
Register-Mock Get-VstsTaskVariable { 'Some build sources directory' } -- -Name Build.SourcesDirectory -Require
Register-Mock Get-VstsTaskVariable { 'Some team project ID' } -- -Name System.TeamProjectId -Require
Register-Mock Invoke-DisposeSourceProvider
Register-Mock Write-Warning

# Act.
$actual = Get-SourceProvider

# Assert.
Assert-IsNullOrEmpty $actual
# Asserting that dispose was called isn't partically interesting for the flow
# exercised by this test case. However, it does validate that dispose would
# would get called properly for other providers.
Assert-WasCalled Invoke-DisposeSourceProvider -Times 1 -ParametersEvaluator {
        $Provider -ne $null -and
        $Provider.Name -eq 'Some repository provider'
    }
Assert-WasCalled Write-Warning
