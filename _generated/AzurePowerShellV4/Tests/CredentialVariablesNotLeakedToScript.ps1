[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
Register-Mock Invoke-ScriptArgumentSanitization
$targetAzurePs = "4.1.0"
Register-Mock Get-VstsInput { "myArmConnection" } -- -Name ConnectedServiceNameARM -Require
Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/CredentialVariablesNotLeakedToScript_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $false } -- -Name FailOnStandardError
Register-Mock Get-VstsInput { $false } -- -Name pwsh -AsBool
Register-Mock Update-PSModulePathForHostedAgent
Register-Mock Get-Module
Register-Mock Initialize-AzModule
Register-Mock Get-VstsEndpoint {
    @{
        auth = @{
            scheme = "ServicePrincipal"
            parameters = @{
                serviceprincipalkey = "arm-secret"
            }
        }
    }
} -- -Name myArmConnection -Require
Register-Mock Get-VstsEndpoint {
    @{
        auth = @{
            parameters = @{
                AccessToken = "job-token"
            }
        }
    }
} -- -Name SystemVssConnection -Require
Register-Mock Remove-EndpointSecrets
Register-Mock Disconnect-AzureAndClearContext
Register-Mock Expand-ModuleZip
Register-Mock Invoke-RestMethod
Register-Mock Save-Module
Register-Mock ConvertTo-SecureString { "encrypted-token" }

# Act.
$actual = & $PSScriptRoot\..\AzurePowerShell.ps1

# Assert.
Assert-AreEqual $true ($actual -contains "CREDENTIAL_SCOPE_CLEAN") "Customer script should not see credential variables"
Assert-AreEqual $false ([bool]($actual | Where-Object { $_ -like "CREDENTIAL_SCOPE_LEAK:*" })) "Customer script reported leaked credential variables"
