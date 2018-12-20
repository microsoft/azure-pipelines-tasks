[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

Register-Mock Write-Telemetry { }

# Test 1 "should throw if no azurevm resources"
Assert-Throws {
    Get-AzureVMResourcesProperties -resourceGroupName $rgWithNoVM -resourceFilteringMethod 'tags'
} -MessagePattern "AFC_NoARMVMResources*"

# Test 2 "should return azureVM resources if valid input given"
$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$vmName = "myVM0"
$vmfqdn = "lbipac2b71e2680c44fd987d.westus.cloudapp.azure.com"
$vmWinRMHttpsPort = '40001'

$response = Get-AzureVMResourcesProperties -resourceGroupName $validRG -resourceFilteringMethod 'tags'

Assert-IsNotNullOrEmpty $response
Assert-AreEqual 3 $response.Count

$resource = $response[$vmName]

Assert-AreEqual $vmName $resource.Name
Assert-AreEqual $vmfqdn $resource.fqdn
Assert-AreEqual $vmWinRMHttpsPort $resource.winRMHttpsPort