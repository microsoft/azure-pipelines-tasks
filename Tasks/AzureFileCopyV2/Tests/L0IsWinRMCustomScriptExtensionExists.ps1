[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

$extensionName="WinRMCustomScriptExtension"

# Test 1 "Should not throw when Resource group us null"
$isExtensionExists = Is-WinRMCustomScriptExtensionExists -resourceGroupName $null -vmName $vm0Name -extensionName $extensionName -connectedServiceName $connectedServiceName
Assert-AreEqual $false $isExtensionExists

# Test 2 "Should not throw when VM name is null"
$isExtensionExists = Is-WinRMCustomScriptExtensionExists -resourceGroupName $validRG -vmName $null -extensionName $extensionName -connectedServiceName $connectedServiceName
Assert-AreEqual $false $isExtensionExists

# Test 3 "Should not throw when VM name is invalid"
$isExtensionExists = Is-WinRMCustomScriptExtensionExists -resourceGroupName $validRG -vmName $invalidMachineName -extensionName $extensionName -connectedServiceName $connectedServiceName
Assert-AreEqual $false $isExtensionExists

# Test 4 "Should not throw Extension name is null"
$isExtensionExists = Is-WinRMCustomScriptExtensionExists -resourceGroupName $validRG -vmName $vm0Name -extensionName $null -connectedServiceName $connectedServiceName
Assert-AreEqual $false $isExtensionExists

# Test 5 "Should not throw when Extension name is invalid"
$invalidExtensionName="InvalidWinRMCustomScriptExtension"

$isExtensionExists = Is-WinRMCustomScriptExtensionExists -resourceGroupName $validRG -vmName $vm0Name -extensionName $invalidExtensionName -connectedServiceName $connectedServiceName
Assert-AreEqual $false $isExtensionExists

# Test 6 "Should return true for valid values, if previous extension deployed successfully"
Register-Mock Get-AzureMachineCustomScriptExtension { return @{"ProvisioningState"="Succeeded"} }
Register-Mock Validate-CustomScriptExecutionStatus { return }
Register-Mock Remove-AzureMachineCustomScriptExtension { return @{}}
Register-Mock Get-Endpoint {}

$isExtensionExists = Is-WinRMCustomScriptExtensionExists -resourceGroupName $validRG -vmName $vm0Name -extensionName $extensionName -connectedServiceName $connectedServiceName
Assert-AreEqual $true $isExtensionExists
Assert-WasCalled Get-AzureMachineCustomScriptExtension -Times 1
Assert-WasCalled Validate-CustomScriptExecutionStatus -Times 1
Assert-WasCalled Remove-AzureMachineCustomScriptExtension -Times 0

# Test 7 "Should return false For valid values, if previous extension failed to deploy"
Unregister-Mock Validate-CustomScriptExecutionStatus
Register-Mock Validate-CustomScriptExecutionStatus { throw "error" }

$isExtensionExists = Is-WinRMCustomScriptExtensionExists -resourceGroupName $validRG -vmName $vm0Name -extensionName $extensionName -connectedServiceName $connectedServiceName

Assert-AreEqual $false $isExtensionExists
Assert-WasCalled Validate-CustomScriptExecutionStatus -Times 1

# Test 8 "Should return false For valid values, if previous extension failed to provision"
Unregister-Mock Get-AzureMachineCustomScriptExtension
Register-Mock Get-AzureMachineCustomScriptExtension { return @{properties=@{ProvisioningState="Failed"}} }

$isExtensionExists = Is-WinRMCustomScriptExtensionExists -resourceGroupName $validRG -vmName $vm0Name -extensionName $extensionName -connectedServiceName $connectedServiceName

Assert-AreEqual $false $isExtensionExists
Assert-WasCalled Get-AzureMachineCustomScriptExtension -Times 2
