[CmdletBinding()]
param()

# Test: PowerShellOnTargetMachines.ps1 DRY-RUN of the ##vso[ command-injection fix.
#
# The dry-run must NOT sanitize ##vso[ commands coming from remote VM output (so customers who
# intentionally use ##vso[ commands on remote machines keep working). Instead it must publish
# telemetry describing which ##vso[ commands would have been blocked.
#
# This test runs the ACTUAL task script with mocked dependencies and a malicious deployment
# response, then verifies the raw ##vso[ commands are still emitted unchanged AND that dry-run
# telemetry is published.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

# Remove the default Write-ResponseLogs mock - we want the REAL override from the production script.
Unregister-Mock Write-ResponseLogs

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

# Setup inputs for single-machine sequential execution
Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { return $environmentWithSkipCANotSet } -ParametersEvaluator{ $Name -eq "EnvironmentName" }
Register-Mock Get-VstsInput { return $validMachineName1 } -ParametersEvaluator{ $Name -eq "MachineNames" }
Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq "ScriptPath" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq "RunPowershellInParallel" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq "InitializationScriptPath" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq "ScriptArguments" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq "SessionVariables" }
Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq "AdminUserName" }
Register-Mock Get-VstsInput { return "adminPass" } -ParametersEvaluator{ $Name -eq "AdminPassword" }
Register-Mock Get-VstsInput { return "HTTPS" } -ParametersEvaluator{ $Name -eq "Protocol" }
Register-Mock Get-VstsInput { return "true" } -ParametersEvaluator{ $Name -eq "testCertificate" }

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $environmentWithSkipCANotSet } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCANotSet}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCANotSet}
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpsPort } -ParametersEvaluator {$Key -eq $resourceWinRMHttpsPortKeyName}
Register-Mock Get-EnvironmentProperty { return '' } -ParametersEvaluator {$Key -eq $skipCACheckKeyName}

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

Register-Mock Get-ParsedSessionVariables { return @{} }

# Run the actual task script and capture all output streams (including the host/information
# stream 6 where Write-Host writes, since the dry-run telemetry is emitted via Write-Host).
$allOutput = (& $remotePowershellRunnerPath) *>&1 | Out-String

# Verify: dry-run does NOT sanitize - the raw ##vso[task.setvariable] must still be present (pass-through).
Assert-AreEqual $true ($allOutput -match '##vso\[task\.setvariable') "Dry-run must NOT modify remote output - raw ##vso[task.setvariable] should still be present"

# Verify: dry-run does NOT escape commands to ##_vso[.
Assert-AreEqual $true ($allOutput -notmatch '##_vso\[') "Dry-run must not escape ##vso[ to ##_vso["

# Verify: dry-run telemetry is published for the detected commands.
Assert-AreEqual $true ($allOutput -match 'telemetry\.publish area=TaskHub;feature=RemoteVsoCommandInjectionDryRun') "Dry-run telemetry must be published when ##vso[ commands are detected in remote output"

# Verify: the published telemetry names the detected command(s).
Assert-AreEqual $true ($allOutput -match 'task\.setvariable') "Dry-run telemetry payload should reference the detected command name"

# Verify: legitimate output passes through unmodified.
Assert-AreEqual $true ($allOutput -match 'Legitimate deployment output') "Legitimate output should pass through unmodified"
