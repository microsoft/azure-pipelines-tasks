[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockHelper.ps1

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$vm0Name = "myVM0"
$azureRMVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName $validRG

# Test 1 "Should Call Does-AzureVMMatchTagFilterCriteria for every VM for filter criteria"
$filteredAzureVMResources = Get-TagBasedFilteredAzureVMs -azureVMResources $azureRMVMResources -filter "role:web"

#Assert-WasCalled Does-AzureVMMatchTagFilterCriteria -Times $azureRMVMResources.Count -ParametersEvaluator {$filter -eq "role:web"}

# Test 2 "Should return VMs that matches tag filter criteria"
$filteredAzureVMResources = Get-TagBasedFilteredAzureVMs -azureVMResources $azureRMVMResources -filter "role:test"

Assert-AreEqual $vm0Name $filteredAzureVMResources.Name