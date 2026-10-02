[CmdletBinding()]
param()

# Test: AzureFileCopy.ps1 whitelist-aware neutralization of the ##vso[ command-injection fix.
#
# Write-ResponseLogs escapes "##vso[" -> "##_vso[" ONLY for commands that are NOT on the whitelist
# delivered via the AGENT_ALLOWEDLOGGINGCOMMANDS environment variable. Whitelisted commands are left
# unchanged, and an empty/unset whitelist changes nothing (feature-off).
#
# This test runs the ACTUAL task script with mocked dependencies and a malicious deployment response.

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

# We do NOT mock Write-ResponseLogs - we want the production override from AzureFileCopy.ps1.

# Build the malicious remote output in variables so the literal "##vso[" token does not appear in the
# mock scriptblock body itself. Register-Mock echoes the scriptblock source via Write-Verbose, and the
# test harness runs with VerbosePreference=Continue and captures every stream - a literal "##vso[" in
# the mock body would otherwise show up in the captured output as a false "raw command survived".
$maliciousDeploymentLog = "##vso[task.setvariable variable=DEPLOY_TOKEN]stolen-from-compromised-vm`nLegitimate deployment output`nMixed ##vso[task.complete result=Failed] mid-line"
$maliciousServiceLog = "##vso[task.setvariable variable=SERVICE_INJECT]via-service-log"

# Mock Invoke-Command (used inside Copy-FilesSequentiallyToAzureVMs via $AzureFileCopyJob scriptblock)
# to return a deployment response with malicious ##vso commands in DeploymentLog.
Register-Mock Invoke-Command {
    return @{
        Status = "Passed"
        DeploymentLog = $maliciousDeploymentLog
        ServiceLog = $maliciousServiceLog
        Error = $null
    }
}

Register-Mock Get-DeploymentModulePath { return "fakeModulePath" }
Register-Mock Get-ChildItem { return $assembly }
Register-Mock Get-AzureStorageAccount { return $null }
Register-Mock Publish-Azure-Telemetry { }

try {
    # --- Case 1: whitelist contains only task.setvariable ---
    $env:AGENT_ALLOWEDLOGGINGCOMMANDS = "task.setvariable"
    $allowedOutput = (& $azureFileCopyPath) *>&1 | Out-String

    Assert-AreEqual $true ($allowedOutput -match '##vso\[task\.setvariable') "Whitelisted command (task.setvariable) must be preserved"
    Assert-AreEqual $true ($allowedOutput -match '##_vso\[task\.complete') "Non-whitelisted command (task.complete) must be escaped to ##_vso["
    Assert-AreEqual $true ($allowedOutput -notmatch '##vso\[task\.complete') "Non-whitelisted raw ##vso[task.complete must not survive"
    Assert-AreEqual $true ($allowedOutput -match 'Legitimate deployment output') "Legitimate output should pass through unmodified"

    # --- Case 2: empty whitelist = feature-off, nothing escaped ---
    $env:AGENT_ALLOWEDLOGGINGCOMMANDS = ""
    $emptyOutput = (& $azureFileCopyPath) *>&1 | Out-String

    Assert-AreEqual $true ($emptyOutput -match '##vso\[task\.setvariable') "Empty whitelist: task.setvariable must stay raw"
    Assert-AreEqual $true ($emptyOutput -match '##vso\[task\.complete') "Empty whitelist: task.complete must stay raw"
    Assert-AreEqual $true ($emptyOutput -notmatch '##_vso\[') "Empty whitelist: nothing must be escaped"

    # --- Case 3: whitelist matching is case-insensitive (regression guard for the HashSet comparer) ---
    # The whitelist is delivered upper-cased while the injected command is lower-case. Get-AllowedLoggingCommands
    # builds an OrdinalIgnoreCase HashSet; if that comparer were dropped (e.g. by PowerShell unrolling the set on
    # return), the match below would fail and the whitelisted command would be wrongly escaped.
    $env:AGENT_ALLOWEDLOGGINGCOMMANDS = "TASK.SETVARIABLE"
    $caseInsensitiveOutput = (& $azureFileCopyPath) *>&1 | Out-String

    Assert-AreEqual $true ($caseInsensitiveOutput -match '##vso\[task\.setvariable') "Case-insensitive whitelist: upper-cased TASK.SETVARIABLE must whitelist lower-case task.setvariable"
    Assert-AreEqual $true ($caseInsensitiveOutput -match '##_vso\[task\.complete') "Case-insensitive whitelist: non-whitelisted task.complete must still be escaped"
} finally {
    Remove-Item Env:\AGENT_ALLOWEDLOGGINGCOMMANDS -ErrorAction SilentlyContinue
}
