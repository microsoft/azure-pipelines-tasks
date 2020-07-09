[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$vmName = "myVM0"
$vmfqdn = "lbipac2b71e2680c44fd987d.westus.cloudapp.azure.com"
$vmWinRMHttpsPort1 = '40001'
$vmWinRMHttpsPort2 = '40003'
$vmWinRMHttpsPort3 = '40005'
$azureVMsProperties = Get-AzureVMResourcesProperties -resourceGroupName $validRG -resourceFilteringMethod 'tags'
$azureVMCredntials = Get-AzureVMsCredentials -vmsAdminUserName $validInputVmsAdminUserName -vmsAdminPassword $validInputVmsAdminPassword

Register-Mock ConvertTo-SecureString { return $securedMockPassword }
$invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMsProperties -networkCredentials $azureVMCredntials

# Test 1 "Should throw if failed on one vm and passed on other vm" 

Register-Mock Invoke-RemoteScript { return $invokeRemoteScriptOnePassOneFailResponse }

Assert-Throws {
    Copy-FilesParallellyToAzureVMs -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential -protocol $invokeRemoteScriptParams.protocol -sessionName "AFCCopyToVMs" -remoteScriptJobArguments @{} -sessionOption $invokeRemoteScriptParams.sessionOption
} -MessagePattern "AFC_ParallelCopyFailed*"

# Test 2 "Should not throw if copy passed on both vms" 

Unregister-Mock Invoke-RemoteScript
Register-Mock Invoke-RemoteScript { return $invokeRemoteScriptAllPassedResponse } 

Copy-FilesParallellyToAzureVMs -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential -protocol $invokeRemoteScriptParams.protocol -sessionName "AFCCopyToVMs" -remoteScriptJobArguments @{} -sessionOption $invokeRemoteScriptParams.sessionOption
