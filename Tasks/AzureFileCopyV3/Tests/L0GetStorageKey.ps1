[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

Register-Mock Validate-AzurePowershellVersion {}
Register-Mock Write-Telemetry { }

# Test 1 "should throw if storage not found"
$invalidRGStorage = "invalidRGStorage"
Assert-Throws {
    Get-StorageKey -storageAccountName $invalidRGStorage -endpoint @{}
} -MessagePattern "Storage account: $invalidRGStorage not found. Selected Connection 'ServicePrincipal' supports storage account of Azure Resource Manager type only."
