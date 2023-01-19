[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockHelper.ps1

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$vmName = "myVM0"
$vmfqdn = "lbipac2b71e2680c44fd987d.westus.cloudapp.azure.com"
$vmWinRMHttpsPort = '40001'
$azureRMVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName $validRG

# Test 1 "It should return azure vm connection details for valid input"
$response = Get-AzureRMVMsConnectionDetailsInResourceGroup -resourceGroupName $validRG -azureRMVMResources $azureRMVMResources

Assert-IsNotNullOrEmpty $response
Assert-AreEqual 3 $response.Count

$resource = $response[$vmName]

Assert-AreEqual $vmName $resource.Name
Assert-AreEqual $vmfqdn $resource.fqdn
Assert-AreEqual $vmWinRMHttpsPort $resource.winRMHttpsPort

#Test 2 "It should return null if no azure vms"
$response = Get-AzureRMVMsConnectionDetailsInResourceGroup -resourceGroupName $validRG -azureRMVMResources $null

Assert-IsNullOrEmpty $response

$response = Get-AzureRMVMsConnectionDetailsInResourceGroup -resourceGroupName $validRG -azureRMVMResources $azureRMVMResources -connectedServiceName "connectedServiceName"
Assert-IsNotNullOrEmpty $response
Assert-AreEqual 3 $response.Count

