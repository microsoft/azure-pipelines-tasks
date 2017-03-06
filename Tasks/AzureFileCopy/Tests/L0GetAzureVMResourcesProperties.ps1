[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

Register-Mock Write-Telemetry { }

$rgWithClassicVMs = "taskplatformtesttwovm"
$vmName = "vm0"
$vmfqdn = "taskplatformtesttwovm.cloudapp.net"

# Test 1 "should return azureVM resources if valid input given"
$response = Get-AzureVMResourcesProperties -resourceGroupName $rgWithClassicVMs -connectionType 'Certificate' -resourceFilteringMethod 'tags'

Assert-IsNotNullOrEmpty $response
Assert-AreEqual 2 $response.Count

$resource = $response[$vmName]
Assert-AreEqual $vmName $resource.Name
Assert-AreEqual $vmfqdn $resource.fqdn 
Assert-AreEqual 5986 $resource.winRMHttpsPort


# Test 2 "should throw if no azurevm resources"
$cloudServiceWithNoVM = "taskplatformtestnovm"

Assert-Throws {
    $response = Get-AzureVMResourcesProperties -resourceGroupName $cloudServiceWithNoVM -connectionType 'Certificate' -resourceFilteringMethod 'tags'
} -MessagePattern "AFC_NoClassicVMResources*"

# Test 3 "should throw if no azurevm resources (connection type is UserNamePassword)"
$cloudServiceWithNoVM = "taskplatformtestnovm"

Assert-Throws {
    Get-AzureVMResourcesProperties -resourceGroupName $cloudServiceWithNoVM -connectionType 'UserNamePassword' -resourceFilteringMethod 'tags'
} -MessagePattern "AFC_NoGenericVMResources*"

# Test 4 "should throw if no azurevm resources (connection type is ServicePrincipal)"
$cloudServiceWithNoVM = "taskplatformtestnovm"

Assert-Throws {
    Get-AzureVMResourcesProperties -resourceGroupName $cloudServiceWithNoVM -connectionType 'ServicePrincipal' -resourceFilteringMethod 'tags'
} -MessagePattern "AFC_NoARMVMResources*"

# Test 5 "should return azureVM resources if valid input given (connection type is ServicePrincipal)"
$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$vmName = "myVM0"
$vmfqdn = "lbipac2b71e2680c44fd987d.westus.cloudapp.azure.com"
$vmWinRMHttpsPort = '40001'

$response = Get-AzureVMResourcesProperties -resourceGroupName $validRG -connectionType 'ServicePrincipal' -resourceFilteringMethod 'tags'

Assert-IsNotNullOrEmpty $response
Assert-AreEqual 3 $response.Count

$resource = $response[$vmName]

Assert-AreEqual $vmName $resource.Name
Assert-AreEqual $vmfqdn $resource.fqdn
Assert-AreEqual $vmWinRMHttpsPort $resource.winRMHttpsPort