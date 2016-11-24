[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

### Mocked Modules #####
function Get-AzureMachineStatus {
    param([string]$resourceGroupName,
          [string]$name)
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($name)) {
        if(-not $resourceGroups.ContainsKey($resourceGroupName)) {
            throw "Resource group '$resourceGroupName' could not be found."
        }
        $VMs = $resourceGroups[$resourceGroupName].VMsDetails
        if($VMs -and $VMs.ContainsKey($name)) {
            $tempExts = $vmInstanceViews[$name]["Extensions"]
            if($tempExts -and $tempExts.Count -ge 1) {
                $status = @{}
                $status["Extensions"] = $tempExts
                #$customScriptExtension=$tempExts[0]
            }
            else {
                throw "No extension exists with name '$winrmCustomScriptExtension'"
            }
        }
        else {
            throw "The Resource 'Microsoft.Compute/virtualMachines/$name/extensions/$winrmCustomScriptExtension' under resource group '$resourceGroupName' was not found."
        }
    }
    return $status
}

function Remove-AzureMachineCustomScriptExtension {
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName) -and -not [string]::IsNullOrEmpty($name)) {
        if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName)) {
            $response = @{}
            $VMs = $resourceGroups[$resourceGroupName].VMsDetails
            if($VMs -and $VMs.ContainsKey($vmName)) {
                $tempExts = $vmInstanceViews[$vmName]["Extensions"]
                if($tempExts -and $tempExts.Count -ge 1) {
                    $vmInstanceViews[$vmName]["extensions"]=@()
                    $response["Status"]="Succeeded"
                }
                else {
                    $response["Status"]="Succeeded"
                }
            }
            else {
                $response["Status"]="Succeeded"
            }
        }
    }
    return $response
}

### Mocked Variables
$vm0Name = "myVM0"
$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$extensionName="WinRMCustomScriptExtension"
$invalidMachineName = "invalidMachine"
$invalidExtensionName="InvalidWinRMCustomScriptExtension"
$resourceGroups = @{}

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
Assert-Throws {
    $response =  Validate-CustomScriptExecutionStatus -resourceGroupName $validRG -vmName $vm0Name -extensionName $invalidExtensionName
} -MessagePattern "AFC_SetCustomScriptExtensionFailed *"
