[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1
$invalidClassicStorage = "invalidClassicStorage"
$connectedServiceName = "DummyConnectedServiceName"

Register-Mock Validate-AzurePowershellVersion {}
Register-Mock Get-Endpoint { return $null }

Assert-Throws {
    Get-StorageKey -storageAccountName $invalidClassicStorage -connectionType 'Certificate' -connectedServiceName $connectedServiceName
} -MessagePattern "VI"
