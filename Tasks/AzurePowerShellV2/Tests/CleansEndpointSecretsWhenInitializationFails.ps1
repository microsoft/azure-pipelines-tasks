[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Invoke-ScriptArgumentSanitization
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/PerformsBasicFlow_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Initialize-Azure { throw "Initialization failed" }
Register-Mock Get-VstsEndpoint { @{auth = @{ scheme = "ServicePrincipal" }} }
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext

Assert-Throws {
    & $PSScriptRoot\..\AzurePowerShell.ps1
} -MessagePattern "*Initialization failed*"

Assert-WasCalled Remove-EndpointSecrets -Times 1
Assert-WasCalled Disconnect-AzureAndClearContext -Times 1