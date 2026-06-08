[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockHelper.ps1

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$winrmPort1 = "40001"
$winrmPort2 = "40003"
$winrmPort3 = "40005"
$vmfqdn = "lbipac2b71e2680c44fd987d.westus.cloudapp.azure.com"
$azureRMVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName $validRG
$azureRGResourcesDetails = Get-AzureRMResourceGroupResourcesDetails -resourceGroupName $validRG -azureRMVMResources $azureRMVMResources
$networkInterfaceResources = $azureRGResourcesDetails["networkInterfaceResources"]
$publicIPAddressResources = $azureRGResourcesDetails["publicIPAddressResources"]
$loadBalancerResources = $azureRGResourcesDetails["loadBalancerResources"]

# Test 1 "It should valid portList if RG deployed successfully"
[hashtable]$winRMHttpsPortMap = @{}
foreach($lbName in $loadBalancerResources.Keys){
    $lbDetails = $loadBalancerResources[$lbName]
    $frontEndIPConfigs = $lbDetails["frontEndIPConfigs"]
    $inboundRules = $lbDetails["inboundRules"]
    $winRMHttpsPortMap = Get-FrontEndPorts -BackEndPort "5986" -PortList $winRMHttpsPortMap -networkInterfaceResources $networkInterfaceResources -inboundRules $inboundRules

    Assert-AreEqual $true $winRMHttpsPortMap.ContainsKey($azureRMVMResources[0].Id)
    Assert-AreEqual $winrmPort1 $winRMHttpsPortMap[$azureRMVMResources[0].Id]

    Assert-AreEqual $true $winRMHttpsPortMap.ContainsKey($azureRMVMResources[1].Id)
    Assert-AreEqual $winrmPort2 $winRMHttpsPortMap[$azureRMVMResources[1].Id]
}