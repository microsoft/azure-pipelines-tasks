[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
$env:BUILD_REPOSITORY_PROVIDER = 'Some repository provider'
$env:BUILD_SOURCESDIRECTORY = 'Some build sources directory'
$env:SYSTEM_TEAMPROJECTID = 'Some team project ID'
Register-Mock Invoke-DisposeSourceProvider
Register-Mock Write-Warning

# Act.
$actual = Get-SourceProvider

# Assert.
Assert-IsNullOrEmpty $actual
# Asserting that dispose was called isn't partically interesting for the flow
# exercised by this test case. However, it does validate that dispose would
# would get called properly for other providers.
Assert-WasCalled Invoke-DisposeSourceProvider -Time 1 -ParametersEvaluator {
        $Provider -ne $null -and
        $Provider.Name -eq $env:BUILD_REPOSITORY_PROVIDER
    }
Assert-WasCalled Write-Warning
