[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$vmName = "myVM0"
$vmfqdn = "lbipac2b71e2680c44fd987d.westus.cloudapp.azure.com"
$vmWinRMHttpsPort = '40003'
$azureVMsProperties = Get-AzureVMResourcesProperties -resourceGroupName $validRG -resourceFilteringMethod 'tags'
$azureVMCredntials = Get-AzureVMsCredentials -vmsAdminUserName $validInputVmsAdminUserName -vmsAdminPassword $validInputVmsAdminPassword

Register-Mock ConvertTo-SecureString { return $securedMockPassword }
$invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMsProperties -networkCredentials $azureVMCredntials

Register-Mock Invoke-RemoteScript { return $invokeRemoteScriptFailedResponse }

# Test 1 "Should throw if failed on one vm"
Assert-Throws {
    Copy-FilesSequentiallyToAzureVMs -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential -protocol $invokeRemoteScriptParams.protocol -sessionName "AFCCopyToVMs" -remoteScriptJobArguments @{} -sessionOption $invokeRemoteScriptParams.sessionOption
} -MessagePattern "AFC_CopyFailed $vmfqdn`:$vmWinRMHttpsPort AFC_AzureFileCopyMoreHelp*"

# Test 2 "Should not throw if copy succeded on both vms"
Unregister-Mock Invoke-RemoteScript
Register-Mock Invoke-RemoteScript { return $invokeRemoteScriptPassedResponse }

Copy-FilesSequentiallyToAzureVMs -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential -protocol $invokeRemoteScriptParams.protocol -sessionName "AFCCopyToVMs" -remoteScriptJobArguments @{} -sessionOption $invokeRemoteScriptParams.sessionOption