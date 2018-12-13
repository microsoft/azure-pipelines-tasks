[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\AzureFileCopyRemoteJob.ps1
. $PSScriptRoot\MockHelper.ps1

$azureVMsProperties = Get-AzureVMResourcesProperties -resourceGroupName $validRG -resourceFilteringMethod 'tags'
$azureVMCredntials = Get-AzureVMsCredentials -vmsAdminUserName $validInputVmsAdminUserName -vmsAdminPassword $validInputVmsAdminPassword

Register-Mock Get-ChildItem { }

Register-Mock Copy-FilesParallellyToAzureVMs { }
Register-Mock Copy-FilesSequentiallyToAzureVMs { }

Register-Mock ConvertTo-SecureString { return $securedMockPassword }
$invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMsProperties -networkCredentials $azureVMCredntials

# Test 1 "Should Call Copy-FilesParallellyToAzureVMs for parallel option"
Copy-FilesToAzureVMsFromStorageContainer -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential `
                                         -protocol $invokeRemoteScriptParams.protocol `
                                         -sessionOption $invokeRemoteScriptParams.sessionOption `
                                         -blobStorageEndpoint $validBlobStorageEndpoint `
                                         -containerName $validInputContainerName `
                                         -containerSasToken $validSasToken `
                                         -targetPath $validInputTargetPath `
                                         -cleanTargetBeforeCopy $false `
                                         -copyFilesInParallel $true `
                                         -additionalArguments "" `
                                         -azCopyToolLocation "AzCopy" `
                                         -fileCopyJobScript $AzureFileCopyRemoteJob `
                                         -enableDetailedLogging $false


Assert-WasCalled Copy-FilesParallellyToAzureVMs -Times 1
Assert-WasCalled Copy-FilesSequentiallyToAzureVMs -Times 0


# Test 2 "should call Copy-FilesSequentiallyToAzureVMs for sequential option"
Copy-FilesToAzureVMsFromStorageContainer -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential `
                                         -protocol $invokeRemoteScriptParams.protocol `
                                         -sessionOption $invokeRemoteScriptParams.sessionOption `
                                         -blobStorageEndpoint $validBlobStorageEndpoint `
                                         -containerName $validInputContainerName `
                                         -containerSasToken $validSasToken `
                                         -targetPath $validInputTargetPath `
                                         -cleanTargetBeforeCopy $false `
                                         -copyFilesInParallel $false `
                                         -additionalArguments "" `
                                         -azCopyToolLocation "AzCopy" `
                                         -fileCopyJobScript $AzureFileCopyRemoteJob `
                                         -enableDetailedLogging $false


Unregister-Mock Copy-FilesParallellyToAzureVMs
Register-Mock Copy-FilesParallellyToAzureVMs { }

Assert-WasCalled Copy-FilesParallellyToAzureVMs -Times 0
Assert-WasCalled Copy-FilesSequentiallyToAzureVMs -Times 1