[CmdletBinding()]
param()

# Test: PowerShellOnTargetMachinesV1 must sanitize ##vso[ commands from Receive-Job output.
#
# The vulnerability: In parallel execution mode, Start-Job runs PowerShellJob on remote VMs.
# Receive-Job collects ALL output including ##vso[ lines injected by a compromised VM.
# The output flows to agent stdout which processes ##vso commands (setvariable, uploadfile, etc).
#
# EXPECTED: This test FAILS until the vulnerability is fixed.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentName } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}

Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpsPort } -ParametersEvaluator {$Key -eq $resourceWinRMHttpsPortKeyName}
Register-Mock Get-EnvironmentProperty { return $validMachineName1 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}
Register-Mock Get-EnvironmentProperty { return $validMachineName2 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId2}

Register-Mock Start-Job { $testJobs.Add($Job1); return $job1} -ParametersEvaluator {$ArgumentList -contains $validResource1.Name }
Register-Mock Start-Job { $testJobs.Add($Job2); return $job2} -ParametersEvaluator {$ArgumentList -contains $validResource2.Name }

Register-Mock Get-Job { return $testJobs }
Register-Mock Start-Sleep { }

# Mock Receive-Job to simulate a compromised VM injecting ##vso commands
# In a real attack, the remote VM's Write-Host output flows through the job's
# information stream (stream 6) and appears on the agent's stdout directly via Receive-Job.
Register-Mock Receive-Job {
    Write-Host "##vso[task.setvariable variable=injectedSecret;issecret=true]stolen-value"
    Write-Host "##vso[task.setvariable variable=Build.Repository.Clean]true"
    return $JobPassResponse
}

Register-Mock Remove-Job { $testJobs.RemoveAt(0) }

# Capture ALL output from running the task
$allOutput = & {
    & "$remotePowershellRunnerPath" -environmentName $validEnvironmentName -machineNames $validMachineNames -scriptPath $validScriptPath -runPowershellInParallel $true
} *>&1

# Verify: NO ##vso[task.setvariable] commands should appear in the task's output
$vsoCommandsFound = @()
foreach ($line in $allOutput) {
    $lineStr = ($line | Out-String).Trim()
    if ($lineStr -match '##vso\[task\.setvariable') {
        $vsoCommandsFound += $lineStr
    }
}

Assert-AreEqual 0 $vsoCommandsFound.Count "##vso[task.setvariable] commands from remote VM must be stripped. Found $($vsoCommandsFound.Count) injected commands: $($vsoCommandsFound -join '; ')"
