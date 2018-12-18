[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockHelper.ps1

Register-Mock Write-Telemetry {}

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$azureRMVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName $validRG

# Test 1 "should call tag filter if machineNames filter selected and no filter provided"
$filteredAzureVMResources = Get-FilteredAzureVMsInResourceGroup -azureVMResources $azureRMVMResources -resourceFilteringMethod "machineNames" -filter ""
Assert-AreEqual 3 $filteredAzureVMResources.Count

# Test 2 "should call tag filter when tags filter selected and non-empty filter provided" 
$filteredAzureVMResources = Get-FilteredAzureVMsInResourceGroup -azureVMResources $azureRMVMResources -resourceFilteringMethod "tags" -filter "role:web"
Assert-AreEqual 0 $filteredAzureVMResources.Count

Register-Mock Get-MachineBasedFilteredAzureVMs { }

# Test 3 "should call Get-MachineBasedFilteredAzureVMs for machineNames filter with non-empty filter"
$filteredAzureVMResources = Get-FilteredAzureVMsInResourceGroup -azureVMResources $azureRMVMResources -resourceFilteringMethod "machineNames" -filter "vm0"
Assert-AreEqual 0 $filteredAzureVMResources.Count
