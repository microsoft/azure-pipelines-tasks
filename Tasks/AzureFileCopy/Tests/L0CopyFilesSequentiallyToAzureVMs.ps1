[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1
. $PSScriptRoot\..\AzureFileCopyJob.ps1

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$vmName = "myVM0"
$vmfqdn = "lbipac2b71e2680c44fd987d.westus.cloudapp.azure.com"
$vmWinRMHttpsPort = '40003'
$azureVMsProperties = Get-AzureVMResourcesProperties -resourceGroupName $validRG -connectionType 'ServicePrincipal' -resourceFilteringMethod 'tags'
$azureVMCredntials = Get-AzureVMsCredentials -vmsAdminUserName $validInputVmsAdminUserName -vmsAdminPassword $validInputVmsAdminPassword
Register-Mock Get-DeploymentModulePath { Write-Output (Join-Path $(Get-Location).Path "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs") }

Register-Mock Copy-ToAzureMachines { return $failedDeploymentResponseForCopy } -ParameterFilter { $WinRMPort -eq $vmWinRMHttpsPort }
Register-Mock Get-ChildItem { return $assembly }
Register-Mock Write-ResponseLogs { }
Register-Mock Get-AzureStorageAccount { return $null }
Register-Mock Write-Telemetry { }

# Test 1 "Should throw if failed on one vm"
Assert-Throws {
Copy-FilesSequentiallyToAzureVMs -storageAccountName $validInputStorageAccount -containerName $validInputContainerName -containerSasToken $validSasToken `
    -targetPath $validInputTargetPath -azCopyLocation $validAzCopyLocation -azureVMResourcesProperties $azureVMsProperties `
    -azureVMsCredentials $azureVMCredntials -cleanTargetBeforeCopy "false" -communicationProtocol '' -skipCACheckOption "false" -enableDetailedLoggingString "false" `
    -additionalArguments "" -connectionType "ServicePrincipal"
} -MessagePattern "AFC_WinRMHelpMessage AFC_AzureFileCopyMoreHelp*"

# Test 2 "Should not throw if copy succeded on both vms"
Register-Mock Copy-ToAzureMachines { return $passedDeploymentResponseForCopy }

 Copy-FilesSequentiallyToAzureVMs -storageAccountName $validInputStorageAccount -containerName $validInputContainerName -containerSasToken $validSasToken `
    -targetPath $validInputTargetPath -azCopyLocation $validAzCopyLocation -azureVMResourcesProperties $azureVMsProperties `
    -azureVMsCredentials $azureVMCredntials -cleanTargetBeforeCopy "false" -communicationProtocol '' -skipCACheckOption "false" -enableDetailedLoggingString "false" `
    -additionalArguments "" -connectionType "ServicePrincipal"
