[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockHelper.ps1

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$vmfqdn = "lbipac2b71e2680c44fd987d.westus.cloudapp.azure.com"
$azureRMVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName $validRG
$azureRGResourcesDetails = Get-AzureRMResourceGroupResourcesDetails -resourceGroupName $validRG -azureRMVMResources $azureRMVMResources
$networkInterfaceResources = $azureRGResourcesDetails["networkInterfaceResources"]
$publicIPAddressResources = $azureRGResourcesDetails["publicIPAddressResources"]
$loadBalancerResources = $azureRGResourcesDetails["loadBalancerResources"]
[hashtable]$fqdnMap = @{}

# Test 1 "It should valid fqdnMap if RG deployed successfully"
foreach($lbName in $loadBalancerResources.Keys) {
    $lbDetails = $loadBalancerResources[$lbName]
    $frontEndIPConfigs = $lbDetails["frontEndIPConfigs"]
    $inboundRules = $lbDetails["inboundRules"]
    $fqdnMap = Get-MachinesFqdnsForLB -resourceGroupName $validRG -publicIPAddressResources $publicIPAddressResources -networkInterfaceResources $networkInterfaceResources -frontEndIPConfigs $frontEndIPConfigs -fqdnMap $fqdnMap
    
    Assert-AreEqual $true $fqdnMap.ContainsKey($azureRMVMResources[0].Id)
    Assert-AreEqual $vmfqdn $fqdnMap[$azureRMVMResources[0].Id]

    Assert-AreEqual $true $fqdnMap.ContainsKey($azureRMVMResources[1].Id)
    Assert-AreEqual $vmfqdn $fqdnMap[$azureRMVMResources[1].Id]
}