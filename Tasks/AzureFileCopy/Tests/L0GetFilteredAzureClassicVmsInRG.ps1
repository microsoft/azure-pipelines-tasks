[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockHelper.ps1

$rgWithClassicVMs = "taskplatformtesttwovm"
$azureClassicVMResources = Get-AzureClassicVMsInResourceGroup -resourceGroupName $rgWithClassicVMs

Register-Mock Get-FilteredAzureVMsInResourceGroup { }

# Test 1 "should call Get-FilteredAzureVMsInResourceGroup"
$filteredAzureClassicVMResources = Get-FilteredAzureClassicVMsInResourceGroup -azureClassicVMResources $azureClassicVMResources -resourceFilteringMethod "tags" -filter ""
Assert-WasCalled Get-FilteredAzureVMsInResourceGroup -Times 1 -ParametersEvaluator {
    $resourceFilteringMethod -eq "tags" -and $filter -eq "" -and $azureVMResources.Count -eq $azureClassicVMResources.Count 
}

