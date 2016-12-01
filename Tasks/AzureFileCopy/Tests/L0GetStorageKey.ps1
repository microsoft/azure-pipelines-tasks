[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1
$invalidClassicStorage = "invalidClassicStorage"
$connectedServiceName = "DummyConnectedServiceName"

Register-Mock Validate-AzurePowershellVersion {}
Register-Mock Get-Endpoint { return $null }

Register-Mock Write-Telemetry { }

# Test 1 "should throw if storage not found for connection certificate"
Assert-Throws {
    Get-StorageKey -storageAccountName $invalidClassicStorage -connectionType 'Certificate' -connectedServiceName $connectedServiceName
} -MessagePattern "AFC_ClassicStorageAccountNotFound *"

# Test 2 "should throw if storage not found for connection usernamepassword"
$invalidStorage = "invalidStorage"
Assert-Throws {
    Get-StorageKey -storageAccountName $invalidStorage -connectionType 'UserNamePassword' -connectedServiceName $connectedServiceName
} -MessagePattern "AFC_GenericStorageAccountNotFound *"

# Test 3 "should throw if storage not found for connection connection SPN"
$invalidRGStorage = "invalidRGStorage"
Assert-Throws {
    Get-StorageKey -storageAccountName $invalidRGStorage -connectionType 'ServicePrincipal' -connectedServiceName $connectedServiceName
} -MessagePattern "Storage account: $invalidRGStorage not found. Selected Connection 'ServicePrincipal' supports storage account of Azure Resource Manager type only."
