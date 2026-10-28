[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1

$invalidInputStorageAccount = "invalidInputStorageAccount"
$exceptionMessage = "Exception thrown"
$cleanupCallCount = 0

function global:Remove-EndpointSecrets { $script:cleanupCallCount++ }

Register-Mock Write-Telemetry { }
Register-Mock Test-Path { return $true } -ParametersEvaluator { $Path -eq "c:\foo\bar" }
Register-Mock Test-Path { return $false } -ParametersEvaluator { $Path -eq $validInputSourcePath }
Register-Mock Get-VstsTaskVariable { return 'c:\foo\bar' }
Register-Mock Protect-ScriptArguments { return @() }

# Test 1 "Should throw if Invoke-Expression fails" at time of azcopy login
Register-Mock Invoke-Expression { throw $exceptionMessage }

Assert-Throws {
    Upload-FilesToAzureContainer -sourcePath $validInputSourcePath -endPoint $spnEndpoint -storageAccountName $invalidInputStorageAccount -containerName $validInputContainerName `
                                -blobPrefix $validInputBlobPrefix -blobStorageEndpoint $validBlobStorageEndpoint -azCopyLocation $validAzCopyLocation -destinationType $validInputAzureBlobDestinationType `
                                -containerSasToken $validSasToken
} -MessagePattern "*ServicePrincipalError*"

Assert-AreEqual 1 $cleanupCallCount "Certificate secrets should be removed after a failed AzCopy login"
Unregister-Mock Invoke-Expression

# Test 2 "Should throw and delete container if destination azureVM"
Register-Mock Remove-AzureContainer { }
Register-Mock Invoke-Expression { } -ParametersEvaluator {$command -eq "login" }
Register-Mock Invoke-Expression { throw $exceptionMessage } -ParametersEvaluator {$command -eq "copy" }

Assert-Throws {
    Upload-FilesToAzureContainer -sourcePath $validInputSourcePath -endPoint $spnEndpoint -storageAccountName $invalidInputStorageAccount -containerName $validInputContainerName `
                                -blobPrefix $validInputBlobPrefix -azCopyLocation $validAzCopyLocation -destinationType $validInputAzureVmsDestinationType -containerSasToken $validSasToken
} -MessagePattern "*AFC_UploadContainerStorageAccount*invalidInputStorageAccount*"

Assert-WasCalled Remove-AzureContainer -Times 1
Assert-AreEqual 2 $cleanupCallCount "Certificate secrets should be removed after a failed AzCopy upload"