[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockHelper.ps1

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$azureRMVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName $validRG

Register-Mock Get-FilteredAzureVMsInResourceGroup {}

# Test 1 "should call Get-FilteredAzureVMsInResourceGroup with proper paramters"
Get-FilteredAzureRMVMsInResourceGroup -azureRMVMResources $azureRMVMResources -resourceFilteringMethod "tags" -filter ""
Assert-WasCalled Get-FilteredAzureVMsInResourceGroup -Times 1 -ParametersEvaluator {
    $resourceFilteringMethod -eq "tags"-and $filter -eq "" -and $azureVMResources.Count -eq $azureRMVMResources.Count
}
