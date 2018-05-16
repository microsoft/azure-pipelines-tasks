[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1

$invalidInputStorageAccount = "invalidInputStorageAccount"
$exceptionMessage = "Exception thrown"

Register-Mock Write-Telemetry { }

# Test 1 "Should throw if destination blob is invalid"
Register-Mock Copy-FilesToAzureBlob { throw $exceptionMessage } -ParametersEvaluator {$StorageAccountName -eq $invalidInputStorageAccount}
Assert-Throws {
    Upload-FilesToAzureContainer -sourcePath $validInputSourcePath -storageAccountName $invalidInputStorageAccount -containerName $validInputContainerName `
                                 -blobPrefix $validInputBlobPrefix -storageKey $validStorageKey -azCopyLocation $validAzCopyLocation -destinationType $validInputAzureBlobDestinationType
} -MessagePattern "*AFC_UploadContainerStorageAccount*invalidInputStorageAccount*"

# Test 2 "Should throw and delete container if destination azureVM"
Register-Mock Remove-AzureContainer { }

Assert-Throws {
    Upload-FilesToAzureContainer -sourcePath $validInputSourcePath -storageAccountName $invalidInputStorageAccount -containerName $validInputContainerName `
                                 -blobPrefix $validInputBlobPrefix -storageKey $validStorageKey -azCopyLocation $validAzCopyLocation -destinationType $validInputAzureVmsDestinationType
} -MessagePattern "*AFC_UploadContainerStorageAccount*invalidInputStorageAccount*"

Assert-WasCalled Remove-AzureContainer -Times 1


# Test 3 "Success in Upload blob destination"
Register-Mock Copy-FilesToAzureBlob { return $succeededCopyResponse } -ParametersEvaluator {$StorageAccountName -eq $validInputStorageAccount}

Upload-FilesToAzureContainer -sourcePath $validInputSourcePath -storageAccountName $validInputStorageAccount -containerName $validInputContainerName `
                             -blobPrefix $validInputBlobPrefix -storageKey $validStorageKey -azCopyLocation $validAzCopyLocation -destinationType $validInputAzureBlobDestinationType

Assert-WasCalled Copy-FilesToAzureBlob -Times 1 -ParametersEvaluator {$StorageAccountName -eq $validInputStorageAccount}