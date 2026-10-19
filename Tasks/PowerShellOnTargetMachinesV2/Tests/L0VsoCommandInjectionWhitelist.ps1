[CmdletBinding()]
param()

# Test: PowerShellOnTargetMachines.ps1 whitelist-aware neutralization of the ##vso[ command-injection fix.
#
# Whitelist-aware neutralization: escape ##vso[ -> ##_vso[ ONLY for commands NOT on the whitelist
# delivered via the AGENT_ALLOWEDLOGGINGCOMMANDS environment variable. Whitelisted commands are left
# unchanged, and an empty/unset whitelist changes nothing (feature-off).
#
# This test runs the ACTUAL task script with mocked dependencies and a malicious deployment
# response, then verifies non-whitelisted ##vso[ commands are escaped while whitelisted ones survive.

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

# Build the malicious remote output in variables so the literal "##vso[" token does not appear in the
# mock scriptblock body itself. Register-Mock echoes the scriptblock source via Write-Verbose, and the
# test harness runs with VerbosePreference=Continue and captures every stream - a literal "##vso[" in
# the mock body would otherwise show up in the captured output as a false "raw command survived".
$maliciousDeploymentLog = "##vso[task.setvariable variable=DEPLOY_TOKEN]stolen-from-compromised-vm`n##vso[task.setvariable variable=VM_COMPROMISED]true`nLegitimate deployment output`nMixed ##vso[task.complete result=Failed] mid-line"
$maliciousServiceLog = "##vso[task.setvariable variable=SERVICE_INJECT]via-service-log"

# Mock Invoke-Command to return a deployment response with malicious ##vso commands in DeploymentLog.
# This simulates what the DTT DLL returns when a compromised remote VM injects commands.
Register-Mock Invoke-Command {
    return @{
        Status = "Passed"
        DeploymentLog = $maliciousDeploymentLog
        ServiceLog = $maliciousServiceLog
        Error = $null
    }
}

Register-Mock Get-ParsedSessionVariables { return @{} }

try {
    # --- Case 1: whitelist contains only task.setvariable ---
    $env:AGENT_ALLOWEDLOGGINGCOMMANDS = "task.setvariable"
    $allowedOutput = (& $remotePowershellRunnerPath) *>&1 | Out-String

    Assert-AreEqual $true ($allowedOutput -match '##vso\[task\.setvariable') "Whitelisted command (task.setvariable) must be preserved"
    Assert-AreEqual $true ($allowedOutput -match '##_vso\[task\.complete') "Non-whitelisted command (task.complete) must be escaped to ##_vso["
    Assert-AreEqual $true ($allowedOutput -notmatch '##vso\[task\.complete') "Non-whitelisted raw ##vso[task.complete must not survive"
    Assert-AreEqual $true ($allowedOutput -match 'Legitimate deployment output') "Legitimate output should pass through unmodified"

    # --- Case 2: empty whitelist = feature-off, nothing escaped ---
    $env:AGENT_ALLOWEDLOGGINGCOMMANDS = ""
    $emptyOutput = (& $remotePowershellRunnerPath) *>&1 | Out-String

    Assert-AreEqual $true ($emptyOutput -match '##vso\[task\.setvariable') "Empty whitelist: task.setvariable must stay raw"
    Assert-AreEqual $true ($emptyOutput -match '##vso\[task\.complete') "Empty whitelist: task.complete must stay raw"
    Assert-AreEqual $true ($emptyOutput -notmatch '##_vso\[') "Empty whitelist: nothing must be escaped"

    # --- Case 3: whitelist matching is case-insensitive (regression guard for the HashSet comparer) ---
    # The whitelist is delivered upper-cased while the injected command is lower-case. Get-AllowedLoggingCommands
    # builds an OrdinalIgnoreCase HashSet; if that comparer were dropped (e.g. by PowerShell unrolling the set on
    # return), the match below would fail and the whitelisted command would be wrongly escaped.
    $env:AGENT_ALLOWEDLOGGINGCOMMANDS = "TASK.SETVARIABLE"
    $caseInsensitiveOutput = (& $remotePowershellRunnerPath) *>&1 | Out-String

    Assert-AreEqual $true ($caseInsensitiveOutput -match '##vso\[task\.setvariable') "Case-insensitive whitelist: upper-cased TASK.SETVARIABLE must whitelist lower-case task.setvariable"
    Assert-AreEqual $true ($caseInsensitiveOutput -match '##_vso\[task\.complete') "Case-insensitive whitelist: non-whitelisted task.complete must still be escaped"
} finally {
    Remove-Item Env:\AGENT_ALLOWEDLOGGINGCOMMANDS -ErrorAction SilentlyContinue
}
