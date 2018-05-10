[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1

$invalidInputStorageAccount = "invalidInputStorageAccount"
$exceptionMessage = "Exception thrown"

Register-Mock Write-Telemetry { }

# Test 1 "Should throw if Invoke-Expression fails"
Register-Mock Invoke-Expression { throw $exceptionMessage }
Assert-Throws {
    Upload-FilesToAzureContainer -sourcePath $validInputSourcePath -storageAccountName $invalidInputStorageAccount -containerName $validInputContainerName `
                                 -blobPrefix $validInputBlobPrefix -blobStorageEndpoint $validBlobStorageEndpoint -storageKey $validStorageKey -azCopyLocation $validAzCopyLocation -destinationType $validInputAzureBlobDestinationType
} -MessagePattern "*AFC_UploadContainerStorageAccount*invalidInputStorageAccount*"

# Test 2 "Should throw and delete container if destination azureVM"
Register-Mock Remove-AzureContainer { }

Assert-Throws {
    Upload-FilesToAzureContainer -sourcePath $validInputSourcePath -storageAccountName $invalidInputStorageAccount -containerName $validInputContainerName `
                                 -blobPrefix $validInputBlobPrefix -storageKey $validStorageKey -azCopyLocation $validAzCopyLocation -destinationType $validInputAzureVmsDestinationType
} -MessagePattern "*AFC_UploadContainerStorageAccount*invalidInputStorageAccount*"

Assert-WasCalled Remove-AzureContainer -Times 1


# Test 3 "Success in Upload blob destination"
Unregister-Mock Invoke-Expression
Register-Mock Invoke-Expression { return $succeededCopyResponse }

Upload-FilesToAzureContainer -sourcePath $validInputSourcePath -storageAccountName $validInputStorageAccount -containerName $validInputContainerName `
                             -blobPrefix $validInputBlobPrefix -storageKey $validStorageKey -azCopyLocation $validAzCopyLocation -destinationType $validInputAzureBlobDestinationType

Assert-WasCalled Invoke-Expression -Times 1