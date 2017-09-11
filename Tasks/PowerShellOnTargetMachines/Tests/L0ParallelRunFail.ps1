[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { return $EnvironmentNameForFailedJob } -ParametersEvaluator{ $Name -eq  "EnvironmentName" }
Register-Mock Get-VstsInput { return $validMachineNames } -ParametersEvaluator{ $Name -eq  "MachineNames" }
Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq  "ScriptPath" }
Register-Mock Get-VstsInput { return $true } -ParametersEvaluator{ $Name -eq  "RunPowershellInParallel" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "InitializationScriptPath" }
Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq  "adminUsername" }

Register-Mock Get-ParsedSessionVariables { }
Register-Mock Receive-Job {return @{"Status"="Passed"}}

Register-Mock Invoke-PsOnRemote {}
Register-Mock Invoke-Command {return @{"Status"="Passed"}}

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
Unregister-Mock Receive-Job
Register-Mock Receive-Job { return $JobFailResponseForDeploy }  -ParametersEvaluator { $Id -eq 2 }

#Remove-Job Mocks
Unregister-Mock Remove-Job
Register-Mock Remove-Job { $testJobs.RemoveAt(0) }

Assert-Throws {
    & "$remotePowershellRunnerPath"
} -MessagePattern "PS_TM_DeploymentOnOneOrMoreMachinesFailed"

Assert-WasCalled Start-Job -Times 2