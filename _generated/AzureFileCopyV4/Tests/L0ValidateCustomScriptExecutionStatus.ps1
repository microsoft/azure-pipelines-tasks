[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

$extensionName="WinRMCustomScriptExtension"  

# Test 1 "Should throw Resource group name is null"
Assert-Throws {
    $response = Validate-CustomScriptExecutionStatus -resourceGroupName $null -vmName $vm0Name -extensionName $extensionName
} -MessagePattern "AFC_SetCustomScriptExtensionFailed *"

# Test 2 "Should throw when VM name is null"
Assert-Throws {
    $response =  Validate-CustomScriptExecutionStatus -resourceGroupName $validRG -vmName $null -extensionName $extensionName
} -MessagePattern "AFC_SetCustomScriptExtensionFailed *"


# Test 3 "Should throw when VM name is invalid"
Assert-Throws {
    $response = Validate-CustomScriptExecutionStatus -resourceGroupName $validRG -vmName $invalidMachineName -extensionName $extensionName
} -MessagePattern "AFC_SetCustomScriptExtensionFailed *"

# Test 4 "Should throw Extension name is null"
Assert-Throws {
    $response = Validate-CustomScriptExecutionStatus -resourceGroupName $validRG -vmName $vm0Name -extensionName $null
} -MessagePattern "AFC_SetCustomScriptExtensionFailed *"

# Test 5 "should throw when Extension name is invalid"
$invalidExtensionName="InvalidWinRMCustomScriptExtension"
Assert-Throws {
    $response =  Validate-CustomScriptExecutionStatus -resourceGroupName $validRG -vmName $vm0Name -extensionName $invalidExtensionName
} -MessagePattern "AFC_SetCustomScriptExtensionFailed *"

# Test 6 "Should not throw" "For valid values, if previous extension deployed successfully"
Register-Mock Remove-AzureMachineCustomScriptExtension { return @{}}
$vmInstanceViews[$vm0Name]["Extensions"]=$extensions

Validate-CustomScriptExecutionStatus -resourceGroupName $validRG -vmName $vm0Name -extensionName $extensionName
Assert-WasCalled Remove-AzureMachineCustomScriptExtension -Times 0

# Test 7 "Should throw for valid values, if previous extension failed to deploy" 
$extensions[0]["SubStatuses"][1]["Message"]="Extension script execution failed."
$vmInstanceViews[$vm0Name]["Extensions"]=$extensions

Assert-Throws {
    Validate-CustomScriptExecutionStatus -resourceGroupName $validRG -vmName $vm0Name -extensionName $extensionName
} -MessagePattern "AFC_SetCustomScriptExtensionFailed *"
Assert-WasCalled Remove-AzureMachineCustomScriptExtension -Times 1

# Test 8 "For valid values, if previous extension failed to provision"
Unregister-Mock Remove-AzureMachineCustomScriptExtension
Register-Mock Remove-AzureMachineCustomScriptExtension { return @{}}
$extensions[0]["SubStatuses"][1]["Message"]="Failed to apply the extension."
$vmInstanceViews[$vm0Name]["Extensions"]=$extensions 

Assert-Throws {
    Validate-CustomScriptExecutionStatus -resourceGroupName $validRG -vmName $vm0Name -extensionName $extensionName
} -MessagePattern "AFC_SetCustomScriptExtensionFailed *"
Assert-WasCalled Remove-AzureMachineCustomScriptExtension -Times 1

#Clean the extension
$vmInstanceViews[$vm0Name]["Extensions"]=@()
