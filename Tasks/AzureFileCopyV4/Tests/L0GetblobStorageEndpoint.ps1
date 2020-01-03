[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

Register-Mock Validate-AzurePowershellVersion {}
Register-Mock Write-Telemetry { }

$invalidRGStorage = "invalidRGStorage"

# Test 1 "Should throw if Blob storage not found"
Assert-Throws {
    Get-blobStorageEndpoint -storageAccountName $invalidRGStorage -endpoint @{}
} -MessagePattern "Unable to find storage type $invalidRGStorage with Connection SPN"