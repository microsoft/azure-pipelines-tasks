[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Invoke-ScriptArgumentSanitization
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/PerformsBasicFlow_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $true } -- -Name FailOnStandardError
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Get-Module
Register-Mock Initialize-AzModule { throw "Initialization failed" }
Register-Mock Get-VstsEndpoint { @{auth = @{ scheme = "ServicePrincipal" }} }
Register-Mock Remove-EndpointSecrets
Register-Mock Write-VstsTaskError
Register-Mock Disconnect-AzureAndClearContext
Register-Mock Expand-ModuleZip
Register-Mock Invoke-RestMethod
Register-Mock Save-Module
Register-Mock ConvertTo-SecureString

Assert-Throws {
    & $PSScriptRoot\..\AzurePowerShell.ps1
} -MessagePattern "*Initialization failed*"

Assert-WasCalled Remove-EndpointSecrets -Times 1