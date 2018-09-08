[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentNameWithDuplicateResourceName } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentNameWithDuplicateResourceName}
Register-Mock Get-EnvironmentResources { return $validResourcesWithDuplicateResourceName } -ParametersEvaluator {$Environment.Name -eq $validEnvironmentNameWithDuplicateResourceName}
Register-Mock Get-EnvironmentProperty{ return $environmentWinRMHttpPortForDuplicateResource } -ParametersEvaluator{$Key -eq $resourceWinRMHttpPortKeyName -and $ResourceId -eq $validMachineId1Duplicate}
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpsPort } -ParametersEvaluator {$Key -eq $resourceWinRMHttpsPortKeyName}
Register-Mock Get-EnvironmentProperty { return $validMachineName1 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1Duplicate}
Register-Mock Get-EnvironmentProperty { return $validMachineName1 } -ParametersEvaluator{$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}
Register-Mock Start-Job { $testJobs.Add($Job1); return $job1} -ParametersEvaluator {$ArgumentList -contains $validResource1.Name -and $ArgumentList -contains $environmentWinRMHttpsPort}
Register-Mock Start-Job { $testJobs.Add($Job2); return $job2} -ParametersEvaluator {$ArgumentList -contains $validResource1Duplicate.Name -and $ArgumentList -contains $environmentWinRMHttpPortForDuplicateResource }
#Get-Job Mocks
Register-Mock Get-Job { return $testJobs }

#Start-Sleep Mocks
Register-Mock Start-Sleep { }

#Receive-Job Mocks
Register-Mock Receive-Job { return $JobPassResponse}

#Remove-Job Mocks
Register-Mock Remove-Job { $testJobs.RemoveAt(0) }

& "$remotePowershellRunnerPath" -environmentName $validEnvironmentNameWithDuplicateResourceName -machineNames "" -scriptPath $validScriptPath -runPowershellInParallel $true

Assert-WasCalled Start-Job -Times 2
Assert-WasCalled Get-EnvironmentProperty -Times 1 -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1Duplicate}
Assert-WasCalled Get-EnvironmentProperty -Times 1 -ParametersEvaluator {$Key -eq $resourceWinRMHttpPortKeyName -and $ResourceId -eq $validMachineId1Duplicate}