[CmdletBinding()]
param()

# Test: AzureFileCopy V1 must sanitize ##vso[ commands from remote VM output
# before they reach the agent's log processor.
#
# This test sources Utility.ps1 (which defines Copy-FilesSequentiallyToAzureVMs) and the
# Write-ResponseLogs override from AzureFileCopy.ps1, then calls Copy-FilesSequentiallyToAzureVMs
# with a malicious deployment response to verify sanitization works end-to-end.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1
. $PSScriptRoot\..\AzureFileCopyJob.ps1

# Define the PRODUCTION Write-ResponseLogs override (same code as in AzureFileCopy.ps1).
# In production, this overrides the DTT module's export. In test, we define it directly.
function Write-ResponseLogs {
    [CmdletBinding()]
    param(
        [string][Parameter(Mandatory=$true)] $operationName,
        [string][Parameter(Mandatory=$true)] $fqdn,
        [object][Parameter(Mandatory=$true)] $deploymentResponse
    )
    Write-Verbose "Finished $operationName operation on $fqdn"
    if (-not [string]::IsNullOrEmpty($deploymentResponse.DeploymentLog)) {
        Write-Output "Deployment logs for $operationName operation on $fqdn "
        Write-Output (($deploymentResponse.DeploymentLog | Format-List | Out-String) -replace '##vso\[', '##_vso[')
    }
    if (-not [string]::IsNullOrEmpty($deploymentResponse.ServiceLog)) {
        Write-Verbose "Service logs for $operationName operation on $fqdn "
        Write-Verbose (($deploymentResponse.ServiceLog | Format-List | Out-String) -replace '##vso\[', '##_vso[')
    }
}

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$vmWinRMHttpsPort = '40003'
$azureVMsProperties = Get-AzureVMResourcesProperties -resourceGroupName $validRG -connectionType 'ServicePrincipal' -resourceFilteringMethod 'tags'
$azureVMCredntials = Get-AzureVMsCredentials -vmsAdminUserName $validInputVmsAdminUserName -vmsAdminPassword $validInputVmsAdminPassword

Register-Mock Get-DeploymentModulePath { Write-Output (Join-Path $(Get-Location).Path "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs") }
Register-Mock Get-ChildItem { return $assembly }
Register-Mock Get-AzureStorageAccount { return $null }
Register-Mock Write-Telemetry { }
Register-Mock Publish-Azure-Telemetry { }
Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-SanitizerActivateStatus { return $false }

# Mock Invoke-Command to return a deployment response with malicious ##vso commands in DeploymentLog.
# This simulates what happens when a compromised remote VM injects commands via its script output.
Register-Mock Invoke-Command {
    return @{
        Status = "Passed"
        DeploymentLog = "##vso[task.setvariable variable=DEPLOY_TOKEN]stolen-from-compromised-vm`n##vso[task.setvariable variable=VM_COMPROMISED]true`nLegitimate deployment output`nMixed ##vso[task.complete result=Failed] mid-line"
        ServiceLog = "##vso[task.setvariable variable=SERVICE_INJECT]via-service-log"
        Error = $null
    }
}

# Call Copy-FilesSequentiallyToAzureVMs and capture output
$allOutput = (Copy-FilesSequentiallyToAzureVMs -storageAccountName $validInputStorageAccount -containerName $validInputContainerName -containerSasToken $validSasToken `
    -targetPath $validInputTargetPath -azCopyLocation $validAzCopyLocation -azureVMResourcesProperties $azureVMsProperties `
    -azureVMsCredentials $azureVMCredntials -cleanTargetBeforeCopy "false" -communicationProtocol '' -skipCACheckOption "false" -enableDetailedLoggingString "false" `
    -additionalArguments "" -connectionType "ServicePrincipal") 2>&1 | Out-String

# Verify: NO raw ##vso[task.setvariable] in output (injection blocked by Write-ResponseLogs override)
Assert-AreEqual $true ($allOutput -notmatch '##vso\[task\.setvariable') "##vso[task.setvariable] from remote VM must be escaped by Write-ResponseLogs override"

# Verify: escaped ##_vso[ is present (commands are visible but neutralized)
Assert-AreEqual $true ($allOutput -match '##_vso\[') "Escaped ##_vso[ should appear in output"

# Verify: legitimate output passes through
Assert-AreEqual $true ($allOutput -match 'Legitimate deployment output') "Legitimate output should pass through unmodified"
