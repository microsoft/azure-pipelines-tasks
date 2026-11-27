[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\SetupMocks.ps1
$scriptArguments = '-Name build; Write-Output value; #'
$inlineFeatureFlag = 'EnableServiceFabricPowerShellInlineScriptArgumentsSanitization'
Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { $serviceConnectionName } -- -Name serviceConnectionName -Require
Register-Mock Get-VstsInput { "InlineScript" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { 'param($Name) Write-Output $Name' } -- -Name Inline
Register-Mock Get-VstsInput { $scriptArguments } -- -Name ScriptArguments
Register-Mock Connect-ServiceFabricClusterFromServiceEndpoint { throw "ConnectNotExpected" }
Register-Mock Publish-Telemetry

# Act/Assert: inline feature flag off - sanitization is skipped for InlineScript.
Register-Mock Get-VstsPipelineFeature { $false } -- -FeatureName $inlineFeatureFlag
Register-Mock Invoke-ScriptArgumentSanitization
Assert-Throws {
    & $PSScriptRoot\..\ServiceFabricPowerShell.ps1
} -MessagePattern "ConnectNotExpected"
Assert-WasCalled Invoke-ScriptArgumentSanitization -Times 0

# Act/Assert: inline feature flag on - InlineScript arguments are sanitized before connecting.
Unregister-Mock Get-VstsPipelineFeature
Unregister-Mock Invoke-ScriptArgumentSanitization
Register-Mock Get-VstsPipelineFeature { $true } -- -FeatureName $inlineFeatureFlag
Register-Mock Invoke-ScriptArgumentSanitization { throw "ScriptArgsSanitized" }
Assert-Throws {
    & $PSScriptRoot\..\ServiceFabricPowerShell.ps1
} -MessagePattern "ScriptArgsSanitized"
Assert-WasCalled Invoke-ScriptArgumentSanitization -- -InputArgs $scriptArguments -TaskName 'ServiceFabricPowerShellV1' -PipelineFeatureFlagName 'EnableServiceFabricPowerShellArgumentsSanitization'