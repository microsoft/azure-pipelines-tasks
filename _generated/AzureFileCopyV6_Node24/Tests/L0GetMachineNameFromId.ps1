[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockHelper.ps1

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$vm0Name = "myVM0"
$vm1Name = "mytestVM0"
$vm2Name = "mytestPTVM0"
$winrmPort1 = "40001"
$winrmPort2 = "40003"
$winrmPort3 = "40005"
$vmfqdn = "lbipac2b71e2680c44fd987d.westus.cloudapp.azure.com"
$azureRMVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName $validRG
$azureRGResourcesDetails = Get-AzureRMResourceGroupResourcesDetails -resourceGroupName $validRG -azureRMVMResources $azureRMVMResources
$networkInterfaceResources = $azureRGResourcesDetails["networkInterfaceResources"]
$publicIPAddressResources = $azureRGResourcesDetails["publicIPAddressResources"]
$loadBalancerResources = $azureRGResourcesDetails["loadBalancerResources"]

[hashtable]$fqdnMap = @{}
[hashtable]$winRMHttpsPortMap = @{}
foreach($lbName in $loadBalancerResources.Keys)
{
    $lbDetails = $loadBalancerResources[$lbName]
    $frontEndIPConfigs = $lbDetails["frontEndIPConfigs"]
    $inboundRules = $lbDetails["inboundRules"]

    $fqdnMap = Get-MachinesFqdnsForLB -resourceGroupName $validRG -publicIPAddressResources $publicIPAddressResources -networkInterfaceResources $networkInterfaceResources -frontEndIPConfigs $frontEndIPConfigs -fqdnMap $fqdnMap
    $winRMHttpsPortMap = Get-FrontEndPorts -BackEndPort "5986" -PortList $winRMHttpsPortMap -networkInterfaceResources $networkInterfaceResources -inboundRules $inboundRules
}
# Test 1 "should create valid map for map parameter FQDN"
$fqdnMap = Get-MachineNameFromId -resourceGroupName $validRG -Map $fqdnMap -MapParameter "FQDN" -azureRMVMResources $azureRMVMResources -ThrowOnTotalUnavaialbility $true

Assert-AreEqual $true $fqdnMap.ContainsKey($vm0Name)
Assert-AreEqual $vmfqdn $fqdnMap[$vm0Name]
Assert-AreEqual $true $fqdnMap.ContainsKey($vm1Name)

# Test 2 "should create valid map for map parameter Front End port"
$winRMHttpsPortMap = Get-MachineNameFromId -Map $winRMHttpsPortMap -MapParameter "Front End port" -azureRMVMResources $azureRMVMResources -ThrowOnTotalUnavaialbility $false

Assert-AreEqual $true $winRMHttpsPortMap.ContainsKey($vm0Name)
Assert-AreEqual $winrmPort1 $winRMHttpsPortMap[$vm0Name]
Assert-AreEqual $true $winRMHttpsPortMap.ContainsKey($vm1Name)
Assert-AreEqual $winrmPort2 $winRMHttpsPortMap[$vm1Name]


# Test 3 "It should return partial map if for not all resources map is not configured properly"

[hashtable]$fqdnMap = @{}
[hashtable]$winRMHttpsPortMap = @{}
foreach($lbName in $loadBalancerResources.Keys)
{
    $lbDetails = $loadBalancerResources[$lbName]
    $frontEndIPConfigs = $lbDetails["frontEndIPConfigs"]
    $inboundRules = $lbDetails["inboundRules"]

    $fqdnMap = Get-MachinesFqdnsForLB -resourceGroupName $validRG -publicIPAddressResources $publicIPAddressResources -networkInterfaceResources $networkInterfaceResources -frontEndIPConfigs $frontEndIPConfigs -fqdnMap $fqdnMap
    $winRMHttpsPortMap = Get-FrontEndPorts -BackEndPort "5986" -PortList $winRMHttpsPortMap -networkInterfaceResources $networkInterfaceResources -inboundRules $inboundRules
}
$fqdnMap.Remove($azureRMVMResources[0].Id)

$fqdnMap = Get-MachineNameFromId -resourceGroupName $validRG -Map $fqdnMap -MapParameter "FQDN" -azureRMVMResources $azureRMVMResources -ThrowOnTotalUnavaialbility $true

Assert-AreEqual $false $fqdnMap.ContainsKey($vm0Name)
Assert-AreEqual $true $fqdnMap.ContainsKey($vm1Name)
Assert-AreEqual $vmfqdn $fqdnMap[$vm1Name]

# Test 4 "throw error if no resource is available and ThrowOnTotalUnavailability is set to true"

[hashtable]$fqdnMap = @{}
[hashtable]$winRMHttpsPortMap = @{}
foreach($lbName in $loadBalancerResources.Keys)
{
    $lbDetails = $loadBalancerResources[$lbName]
    $frontEndIPConfigs = $lbDetails["frontEndIPConfigs"]
    $inboundRules = $lbDetails["inboundRules"]

    $fqdnMap = Get-MachinesFqdnsForLB -resourceGroupName $validRG -publicIPAddressResources $publicIPAddressResources -networkInterfaceResources $networkInterfaceResources -frontEndIPConfigs $frontEndIPConfigs -fqdnMap $fqdnMap
    $winRMHttpsPortMap = Get-FrontEndPorts -BackEndPort "5986" -PortList $winRMHttpsPortMap -networkInterfaceResources $networkInterfaceResources -inboundRules $inboundRules
}
$fqdnMap.Remove($azureRMVMResources[0].Id)
$fqdnMap.Remove($azureRMVMResources[1].Id)
$fqdnMap.Remove($azureRMVMResources[2].Id)

Assert-Throws {
    $fqdnMap = Get-MachineNameFromId -resourceGroupName $validRG -Map $fqdnMap -MapParameter "FQDN" -azureRMVMResources $azureRMVMResources -ThrowOnTotalUnavailability $true
} -MessagePattern "AFC_MachineNameFromIdErrorAllResources*"
