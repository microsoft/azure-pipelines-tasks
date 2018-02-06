[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"


Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $EnvironmentNameForFailedJob } -ParametersEvaluator {$EnvironmentName -eq $EnvironmentNameForFailedJob}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $EnvironmentNameForFailedJob}

Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpsPort } -ParametersEvaluator {$Key -eq $resourceWinRMHttpsPortKeyName}
Register-Mock Get-EnvironmentProperty { return $validMachineName1 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}
Register-Mock Get-EnvironmentProperty { return $validMachineName2 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId2}

Register-Mock Start-Job { $testJobs.Add($Job1); return $job1} -ParametersEvaluator {$ArgumentList -contains $validResource1.Name }
Register-Mock Start-Job { $testJobs.Add($Job2); return $job2} -ParametersEvaluator {$ArgumentList -contains $validResource2.Name }

#Get-Job Mocks
Register-Mock Get-Job { return $testJobs }

#Start-Sleep Mocks
Register-Mock Start-Sleep { }

#Receive-Job Mocks
Register-Mock Receive-Job { return $JobFailResponseForDeploy }  -ParametersEvaluator { $Id -eq 2 }

#Remove-Job Mocks
Register-Mock Remove-Job { $testJobs.RemoveAt(0) }

Assert-Throws {
    & "$remotePowershellRunnerPath" -environmentName $EnvironmentNameForFailedJob -machineNames $validMachineNames -scriptPath $validScriptPath -runPowershellInParallel $true
} -MessagePattern "Deployment on one or more machines failed."

Assert-WasCalled Start-Job -Times 2