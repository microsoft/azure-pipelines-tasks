[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

Register-Mock Validate-AzurePowershellVersion {}
Register-Mock Get-Endpoint { return $null }
Register-Mock Write-Telemetry { }

$invalidClassicStorage = "invalidClassicStorage"
$invalidStorage = "invalidStorage"
$connectedServiceName = "DummyConnectedServiceName"
$invalidRGStorage = "invalidRGStorage"

# Test 1 "Should throw if Blob storage not found for connection Certificate"
Assert-Throws {
    Get-StorageAccountType -storageAccountName $invalidClassicStorage -connectionType 'Certificate' -connectedServiceName $connectedServiceName
} -MessagePattern "AFC_BlobStorageNotFound *"

# Test 2 "Should throw if Blob storage not found for connection UserNamePassword"
Assert-Throws {
    Get-StorageAccountType -storageAccountName $invalidStorage -connectionType 'UserNamePassword' -connectedServiceName $connectedServiceName
} -MessagePattern "AFC_BlobStorageNotFound *"

Register-Mock Get-AzureStorageAccountTypeFromARM {
    throw "Unable to find storage type $invalidRGStorage with Connection SPN"
}
# Test 3 "Should throw if Blob storage not found for connection ARM endpoint"
Assert-Throws {
    Get-StorageAccountType -storageAccountName $invalidRGStorage -connectionType 'ServicePrincipal' -connectedServiceName $connectedServiceName
} -MessagePattern "Unable to find storage type $invalidRGStorage with Connection SPN"

Assert-WasCalled -Times 1 Get-AzureStorageAccountTypeFromARM