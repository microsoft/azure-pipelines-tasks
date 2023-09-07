[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

Register-Mock Write-Telemetry { }
Register-Mock Switch-AzureMode { }

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$azureRMVMResources = Get-AzureRMVMsInResourceGroup -resourceGroupName $validRG    
$azureVMResource1 = $azureRMVMResources[0]
$validTagFilterForVMResource1 = "role:test"
$azureVMResource2 = $azureRMVMResources[1]

# Test 1 "should return true if vm match tag filter criteria with case insensitive check"
$vmMatchFilterCriteria = Does-AzureVMMatchTagFilterCriteria -azureVMResource $azureVMResource1 -filter "Role:TEST, Test1"
Assert-AreEqual $true $vmMatchFilterCriteria

# Test 2 "should return true if vm match tag filter criteria with same tag repeated twice"
$vmMatchFilterCriteria = Does-AzureVMMatchTagFilterCriteria -azureVMResource $azureVMResource2 -filter "OS:win8, win9; Role:myTEST, MYTest, Test1"
Assert-AreEqual $true $vmMatchFilterCriteria

# Test 3 "should return false if vm does not match tag filter criteria"
$vmMatchFilterCriteria = Does-AzureVMMatchTagFilterCriteria -azureVMResource $azureVMResource2 -filter "OS:win8, win9; Role:Test5, Test2, Test1"
Assert-AreEqual $false $vmMatchFilterCriteria

# Test 4 "Should throw if invalid tag filter format"
Assert-Throws {
    Does-AzureVMMatchTagFilterCriteria -azureVMResource $azureVMResource2 -filter "OS:win8 : win9; Role:myTEST, MYTest, Test1"
} -MessagePattern "AFC_IncorrectTags"