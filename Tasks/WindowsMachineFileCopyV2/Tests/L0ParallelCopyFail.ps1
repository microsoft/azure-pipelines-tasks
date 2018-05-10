[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

Unregister-Mock Get-VstsInput
Unregister-Mock Start-Job
Unregister-Mock Receive-Job
Unregister-Mock Get-Job
Unregister-Mock Remove-Job 
Unregister-Mock Start-Sleep 
Unregister-Mock Import-Module 

Register-Mock Get-VstsInput { return $EnvironmentNameForFailedJob } -ParametersEvaluator{ $Name -eq  "MachineNames" }
Register-Mock Get-VstsInput { return $password } -ParametersEvaluator{ $Name -eq  "AdminPassword" }
Register-Mock Get-VstsInput { return $validSourcePackage } -ParametersEvaluator{ $Name -eq  "SourcePath" }
Register-Mock Get-VstsInput { return $validApplicationPath } -ParametersEvaluator{ $Name -eq  "TargetPath" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "CleanTargetBeforeCopy" }
Register-Mock Get-VstsInput { return $true } -ParametersEvaluator{ $Name -eq  "CopyFilesInParallel" }

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
    & "$copyFilesToMachinesPath" 
} -MessagePattern "Copy to one or more machines failed."
