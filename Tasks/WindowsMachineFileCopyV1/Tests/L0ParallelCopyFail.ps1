[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator{$EnvironmentName -eq $EnvironmentNameForFailedJob}

Register-Mock Get-EnvironmentProperty { return $validMachineName1 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}
Register-Mock Get-EnvironmentProperty { return $validMachineName2 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId2}

Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-SanitizerActivateStatus { return $false }

Register-Mock Receive-Job { }  -ParametersEvaluator { $Id -eq 1 }
Register-Mock Receive-Job { throw "Copy to one or more machines failed." }  -ParametersEvaluator { $Id -eq 2 }

#Start-Job Register-Mocks
Register-Mock Start-Job { $testJobs.Add($Job1); return $job1} -ParametersEvaluator{$ArgumentList -contains $validResource1.Name }
Register-Mock Start-Job { $testJobs.Add($Job2); return $job2} -ParametersEvaluator{$ArgumentList -contains $validResource1Duplicate.Name -and $ArgumentList -contains $environmentWinRMHttpPortForDuplicateResource }
Register-Mock Start-Job { $testJobs.Add($Job2); return $job2} -ParametersEvaluator{$ArgumentList -contains $validResource2.Name }

#Get-Job Register-Mocks
Register-Mock Get-Job { return $testJobs }

#Start-Sleep Register-Mocks
Register-Mock Start-Sleep { }

#Remove-Job Register-Mocks
Register-Mock Remove-Job { $testJobs.RemoveAt(0) }

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $EnvironmentNameForFailedJob  } -ParametersEvaluator{$EnvironmentName -eq $EnvironmentNameForFailedJob}

#Import-Module Register-Mocks
Register-Mock Import-Module { }

Assert-Throws {
    & "$copyFilesToMachinesPath" -environmentName $EnvironmentNameForFailedJob -machineNames $validMachineNames -sourcePath $validSourcePackage -targetPath $validApplicationPath -cleanTargetBeforeCopy $false -copyFilesInParallel $true
} -MessagePattern "Copy to one or more machines failed."
