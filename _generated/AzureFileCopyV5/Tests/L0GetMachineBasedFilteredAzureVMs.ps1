[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockHelper.ps1

Register-Mock Write-Telemetry {}

$rgWithClassicVMs = "taskplatformtesttwovm"
$classicvm0 = "vm0"
$classicvm1 = "VM1"
$azureClassicVMResources = Get-AzureClassicVMsInResourceGroup -resourceGroupName $rgWithClassicVMs

# Test 1 "should return all vms corresponding to filter with case insensitive check"
$filteredAzureVMResources = Get-MachineBasedFilteredAzureVMs -azureVMResources $azureClassicVMResources -resourceFilteringMethod "machineNames" -filter "vM0, Vm1"
Assert-AreEqual 2 $filteredAzureVMResources.Count

# Test 2 "should return only one vm corresponding to its filter even if filter is repeated more than once"
$filteredAzureVMResources = Get-MachineBasedFilteredAzureVMs -azureVMResources $azureClassicVMResources -resourceFilteringMethod "machineNames" -filter "vM0, VM0, vm0"
Assert-AreEqual 1 $filteredAzureVMResources.Count

$nonExistingFilter = "vm2"

# Test 3 "Should throw if for any filter there is not corresponding vm"
Assert-Throws {
    $filteredAzureVMResources = Get-MachineBasedFilteredAzureVMs -azureVMResources $azureClassicVMResources -resourceFilteringMethod "machineNames" -filter "$nonExistingFilter, Vm1"
} -MessagePattern "AFC_MachineDoesNotExist vm2"
