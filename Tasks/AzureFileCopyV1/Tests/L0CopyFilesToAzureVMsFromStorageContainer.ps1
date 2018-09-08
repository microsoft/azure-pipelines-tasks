[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

$rgWithClassicVMs = "taskplatformtesttwovm"
$azureVMsProperties = Get-AzureVMResourcesProperties -resourceGroupName $rgWithClassicVMs -connectionType 'Certificate' -resourceFilteringMethod 'tags'
$azureVMCredntials = Get-AzureVMsCredentials -vmsAdminUserName $validInputVmsAdminUserName -vmsAdminPassword $validInputVmsAdminPassword
$deploymentUtilitiesLocation = Join-Path $(Get-Location).Path "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs"

Register-Mock Copy-FilesParallellyToAzureVMs { }
Register-Mock Copy-FilesSequentiallyToAzureVMs { }

# Test 1 "Should Call Copy-FilesParallellyToAzureVMs for parallel option"
Copy-FilesToAzureVMsFromStorageContainer -storageAccountName $validInputStorageAccount -containerName $validInputContainerName -containerSasToken $validSasToken `
    -targetPath $validInputTargetPath -azCopyLocation $validAzCopyLocation -resourceGroupName $rgWithClassicVMs -azureVMResourcesProperties $azureVMsProperties `
    -azureVMsCredentials $azureVMCredntials -cleanTargetBeforeCopy "false" -communicationProtocol '' -skipCACheckOption "false" -enableDetailedLoggingString "false" `
    -additionalArguments "" -copyFilesInParallel "true" -connectionType 'ServicePrincipal'

Assert-WasCalled Copy-FilesParallellyToAzureVMs -Times 1
Assert-WasCalled Copy-FilesSequentiallyToAzureVMs -Times 0


# Test 2 "should call Copy-FilesSequentiallyToAzureVMs for sequential option with greater than one vm"
Copy-FilesToAzureVMsFromStorageContainer -storageAccountName $validInputStorageAccount -containerName $validInputContainerName -containerSasToken $validSasToken `
    -targetPath $validInputTargetPath -azCopyLocation $validAzCopyLocation -resourceGroupName $rgWithClassicVMs -azureVMResourcesProperties $azureVMsProperties `
    -azureVMsCredentials $azureVMCredntials -cleanTargetBeforeCopy "false" -communicationProtocol '' -skipCACheckOption "false" -enableDetailedLoggingString "false" `
    -additionalArguments "" -copyFilesInParallel "false" -connectionType 'ServicePrincipal'


Unregister-Mock Copy-FilesParallellyToAzureVMs
Register-Mock Copy-FilesParallellyToAzureVMs { }

Assert-WasCalled Copy-FilesParallellyToAzureVMs -Times 0
Assert-WasCalled Copy-FilesSequentiallyToAzureVMs -Times 1

# Test 3 "should call Copy-FilesSequentiallyToAzureVMs for parallel option with one vm"
$azureVMsProperties.Remove("vm0")

Unregister-Mock Copy-FilesSequentiallyToAzureVMs
Register-Mock Copy-FilesSequentiallyToAzureVMs { }

Copy-FilesToAzureVMsFromStorageContainer -storageAccountName $validInputStorageAccount -containerName $validInputContainerName -containerSasToken $validSasToken `
    -targetPath $validInputTargetPath -azCopyLocation $validAzCopyLocation -resourceGroupName $rgWithClassicVMs -azureVMResourcesProperties $azureVMsProperties `
    -azureVMsCredentials $azureVMCredntials -cleanTargetBeforeCopy "false" -communicationProtocol '' -skipCACheckOption "false" -enableDetailedLoggingString "false" `
    -additionalArguments "" -copyFilesInParallel "false" -connectionType 'ServicePrincipal'


Assert-WasCalled Copy-FilesParallellyToAzureVMs -Times 0
Assert-WasCalled Copy-FilesSequentiallyToAzureVMs -Times 1