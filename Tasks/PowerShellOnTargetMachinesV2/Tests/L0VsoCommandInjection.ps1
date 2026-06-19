[CmdletBinding()]
param()

# Test: PowerShellOnTargetMachinesV2 must sanitize ##vso[ commands from Receive-Job output.
#
# The vulnerability: In parallel execution mode, Start-Job runs PowerShellJob on remote VMs.
# When the job completes, Receive-Job collects ALL output (including ##vso[ lines injected
# by a compromised VM). This output flows to the agent stdout which processes ##vso commands.
# The task does NOT filter ##vso[ lines from the received job output.
#
# EXPECTED: This test FAILS until the vulnerability is fixed.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { return $validEnvironmentName } -ParametersEvaluator{ $Name -eq  "EnvironmentName" }
Register-Mock Get-VstsInput { return $validMachineNames } -ParametersEvaluator{ $Name -eq  "MachineNames" }
Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq  "ScriptPath" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "InitializationScriptPath" }
Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq  "AdminUserName" }
Register-Mock Get-VstsInput { return "adminPassword" } -ParametersEvaluator{ $Name -eq  "AdminPassword" }
Register-Mock Get-VstsInput { return "HTTPS" } -ParametersEvaluator{ $Name -eq  "Protocol" }
Register-Mock Get-VstsInput { return "false" } -ParametersEvaluator{ $Name -eq  "testCertificate" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "ScriptArguments" }
Register-Mock Get-VstsInput { return "true" } -ParametersEvaluator{ $Name -eq  "RunPowershellInParallel" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "SessionVariables" }

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentName } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpsPort } -ParametersEvaluator {$Key -eq $resourceWinRMHttpsPortKeyName}
Register-Mock Get-EnvironmentProperty { return $validMachineName1 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}
Register-Mock Get-EnvironmentProperty { return $validMachineName2 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId2}

Register-Mock Start-Job { $testJobs.Add($Job1); return $job1} -ParametersEvaluator {$ArgumentList -contains $validResource1.Name }
Register-Mock Start-Job { $testJobs.Add($Job2); return $job2} -ParametersEvaluator {$ArgumentList -contains $validResource2.Name }
Register-Mock Get-Job { return $testJobs }
Register-Mock Start-Sleep { }

# KEY: Mock Receive-Job to return a response that includes ##vso commands
# This simulates what happens when a compromised VM injects ##vso lines into the
# remote PowerShell output stream, which Receive-Job then collects.
$maliciousJobResponse = @{
    "Status" = $PassedStatus
    "DeploymentLog" = $SuccessLog
    "ServiceLog" = $null
    "Error" = $null
}

Register-Mock Receive-Job {
    # Simulates a compromised VM injecting ##vso commands via remote script output.
    # In a real attack, Write-Host from a PS job flows through stream 6 to agent stdout.
    Write-Host "##vso[task.setvariable variable=secretVar;issecret=true]stolen-credentials"
    Write-Host "##vso[task.setvariable variable=system.accesstoken]pwned"
    return $maliciousJobResponse
}
Register-Mock Remove-Job { $testJobs.RemoveAt(0) }

# Capture ALL output from running the task
$allOutput = & {
    & "$remotePowershellRunnerPath"
} *>&1

# Verify: NO ##vso[ commands should appear in the task's output
$vsoCommandsFound = @()
foreach ($line in $allOutput) {
    $lineStr = ($line | Out-String).Trim()
    if ($lineStr -match '##vso\[task\.setvariable') {
        $vsoCommandsFound += $lineStr
    }
}

Assert-AreEqual 0 $vsoCommandsFound.Count "##vso[task.setvariable] commands from remote VM job output must be stripped. Found $($vsoCommandsFound.Count) injected commands: $($vsoCommandsFound -join '; ')"
