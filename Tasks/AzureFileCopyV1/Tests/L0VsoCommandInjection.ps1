[CmdletBinding()]
param()

# Test: AzureFileCopy.ps1 must sanitize ##vso[ commands from remote VM output
# before they reach the agent's log processor.
#
# This test runs the ACTUAL task script with mocked dependencies and a malicious deployment
# response, then verifies the script's output contains no raw ##vso[ injection commands.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockHelper.ps1

$azureFileCopyPath = "$PSScriptRoot\..\AzureFileCopy.ps1"

# --- Mock all Get-VstsInput calls used at the top of AzureFileCopy.ps1 ---
Register-Mock Get-VstsInput { return "ConnectedServiceNameARM" } -ParametersEvaluator { $Name -eq "ConnectedServiceNameSelector" }
Register-Mock Get-VstsInput { return $validInputSourcePath } -ParametersEvaluator { $Name -eq "SourcePath" }
Register-Mock Get-VstsInput { return "AzureVMs" } -ParametersEvaluator { $Name -eq "Destination" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator { $Name -eq "ConnectedServiceName" }
Register-Mock Get-VstsInput { return "fakeServiceConnection" } -ParametersEvaluator { $Name -eq "ConnectedServiceNameARM" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator { $Name -eq "StorageAccount" }
Register-Mock Get-VstsInput { return $validInputStorageAccount } -ParametersEvaluator { $Name -eq "StorageAccountRM" }
Register-Mock Get-VstsInput { return $validInputContainerName } -ParametersEvaluator { $Name -eq "ContainerName" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator { $Name -eq "BlobPrefix" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator { $Name -eq "EnvironmentName" }
Register-Mock Get-VstsInput { return $validResourceGroupName } -ParametersEvaluator { $Name -eq "EnvironmentNameRM" }
Register-Mock Get-VstsInput { return "machineNames" } -ParametersEvaluator { $Name -eq "ResourceFilteringMethod" }
Register-Mock Get-VstsInput { return "vm0" } -ParametersEvaluator { $Name -eq "MachineNames" }
Register-Mock Get-VstsInput { return $validInputVmsAdminUserName } -ParametersEvaluator { $Name -eq "VmsAdminUsername" }
Register-Mock Get-VstsInput { return $validInputVmsAdminPassword } -ParametersEvaluator { $Name -eq "VmsAdminPassword" }
Register-Mock Get-VstsInput { return $validInputTargetPath } -ParametersEvaluator { $Name -eq "TargetPath" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator { $Name -eq "AdditionalArguments" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator { $Name -eq "CleanTargetBeforeCopy" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator { $Name -eq "CopyFilesInParallel" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator { $Name -eq "SkipCACheck" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator { $Name -eq "EnableCopyPrerequisites" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator { $Name -eq "OutputStorageContainerSasToken" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator { $Name -eq "OutputStorageUri" }

# --- Mock module imports and infrastructure ---
Register-Mock Import-Module { }
Register-Mock Import-VstsLocStrings { }
Register-Mock Initialize-Azure { }
Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-SanitizerActivateStatus { return $false }
Register-Mock Modify-PSModulePathForHostedAgent { }

# --- Mock Azure operations used in the main try block ---
Register-Mock Get-AzureUtility { return "AzureUtilityRest.ps1" }
Register-Mock Get-TypeOfConnection { return "ServicePrincipal" }
Register-Mock Get-StorageKey { return "fakeStorageKey" }
Register-Mock Create-AzureStorageContext { return @{ BlobEndPoint = "https://fake.blob.core.windows.net/" } }
Register-Mock Get-StorageAccountType { return "Standard_LRS" }
Register-Mock Get-blobStorageEndpoint { return "https://fake.blob.core.windows.net/" }
Register-Mock Upload-FilesToAzureContainer { }
Register-Mock Check-ContainerNameAndArgs { }
Register-Mock Generate-AzureStorageContainerSASToken { return "fakeSasToken" }
Register-Mock Get-SkipCACheckOption { return "" }
Register-Mock Get-AzureVMsCredentials { return @{ userName = "admin"; password = "pass" } }
Register-Mock Remove-AzureContainer { }
Register-Mock Remove-EndpointSecrets { }
Register-Mock Disconnect-AzureAndClearContext { }
Register-Mock Write-Telemetry { }

# Mock Get-AzureVMResourcesProperties to return a single VM
Register-Mock Get-AzureVMResourcesProperties {
    $props = @{}
    $props["vm0"] = @{ Name = "vm0"; fqdn = "compromised-vm.westus.cloudapp.azure.com"; winRMHttpsPort = "5986" }
    return $props
}

# --- Mock Copy-FilesToAzureVMsFromStorageContainer to call Copy-FilesSequentiallyToAzureVMs ---
# We do NOT mock Write-ResponseLogs — we want the production override from AzureFileCopy.ps1

# Mock Invoke-Command (used inside Copy-FilesSequentiallyToAzureVMs via $AzureFileCopyJob scriptblock)
# to return a deployment response with malicious ##vso commands in DeploymentLog.
Register-Mock Invoke-Command {
    return @{
        Status = "Passed"
        DeploymentLog = "##vso[task.setvariable variable=DEPLOY_TOKEN]stolen-from-compromised-vm`n##vso[task.setvariable variable=VM_COMPROMISED]true`nLegitimate deployment output`nMixed ##vso[task.complete result=Failed] mid-line"
        ServiceLog = "##vso[task.setvariable variable=SERVICE_INJECT]via-service-log"
        Error = $null
    }
}

Register-Mock Get-DeploymentModulePath { return "fakeModulePath" }
Register-Mock Get-ChildItem { return $assembly }
Register-Mock Get-AzureStorageAccount { return $null }
Register-Mock Publish-Azure-Telemetry { }

# --- Run the actual task script and capture output ---
$allOutput = (& $azureFileCopyPath) 2>&1 | Out-String

# Verify: NO raw ##vso[task.setvariable] in output (injection blocked by Write-ResponseLogs override)
Assert-AreEqual $true ($allOutput -notmatch '##vso\[task\.setvariable') "##vso[task.setvariable] from remote VM must be escaped by the task's Write-ResponseLogs override"

# Verify: escaped ##_vso[ is present (commands are visible but neutralized)
Assert-AreEqual $true ($allOutput -match '##_vso\[') "Escaped ##_vso[ should appear in task output"

# Verify: legitimate output passes through
Assert-AreEqual $true ($allOutput -match 'Legitimate deployment output') "Legitimate output should pass through unmodified"
