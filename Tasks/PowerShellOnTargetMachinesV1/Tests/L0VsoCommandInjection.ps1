[CmdletBinding()]
param()

# Test: PowerShellOnTargetMachines.ps1 must sanitize ##vso[ commands from remote VM output
# before they reach the agent's log processor.
#
# This test runs the ACTUAL task script with mocked dependencies and a malicious deployment
# response, then verifies the script's output contains no raw ##vso[ injection commands.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

# Remove the default Write-ResponseLogs mock — we want the REAL override from the production script.
Unregister-Mock Write-ResponseLogs

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Register-Mock Get-ParsedSessionVariables { return @{} }

# Mock Invoke-Command to return a deployment response with malicious ##vso commands in DeploymentLog.
# This simulates what the DTT DLL returns when a compromised remote VM injects commands.
Register-Mock Invoke-Command {
    return @{
        Status = "Passed"
        DeploymentLog = "##vso[task.setvariable variable=DEPLOY_TOKEN]stolen-from-compromised-vm`n##vso[task.setvariable variable=VM_COMPROMISED]true`nLegitimate deployment output`nMixed ##vso[task.complete result=Failed] mid-line"
        ServiceLog = "##vso[task.setvariable variable=SERVICE_INJECT]via-service-log"
        Error = $null
    }
}

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $environmentWithSkipCANotSet } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCANotSet}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCANotSet}
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpsPort } -ParametersEvaluator {$Key -eq $resourceWinRMHttpsPortKeyName}
Register-Mock Get-EnvironmentProperty { return '' } -ParametersEvaluator {$Key -eq $skipCACheckKeyName}

# Run the actual task script with parameters and capture all output
$allOutput = (& $remotePowershellRunnerPath -environmentName $environmentWithSkipCANotSet -machineNames $validMachineName1 -scriptPath $validScriptPath -runPowershellInParallel $false -protocol "HTTPS" -testCertificate "true") 2>&1 | Out-String

# Verify: NO raw ##vso[task.setvariable] in output (injection blocked by the task's sanitization)
Assert-AreEqual $true ($allOutput -notmatch '##vso\[task\.setvariable') "##vso[task.setvariable] from remote VM must be escaped by the task's sanitization"

# Verify: escaped ##_vso[ is present (commands are visible but neutralized)
Assert-AreEqual $true ($allOutput -match '##_vso\[') "Escaped ##_vso[ should appear in task output"

# Verify: legitimate output passes through
Assert-AreEqual $true ($allOutput -match 'Legitimate deployment output') "Legitimate output should pass through unmodified"
