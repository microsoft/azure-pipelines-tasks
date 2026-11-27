[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator{$EnvironmentName -eq $EnvironmentNameForFailedJob}

Register-Mock Get-EnvironmentProperty { return $validMachineName1 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}
Register-Mock Get-EnvironmentProperty { return $validMachineName2 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId2}

Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-SanitizerActivateStatus { return $false }
Register-Mock Get-VstsTaskVariable { return $global:hardeningFeature } -ParametersEvaluator { $Name -eq 'DistributedTask.Tasks.EnableWindowsMachineFileCopyArgumentsHardening' }
Register-Mock Get-VstsPipelineFeature { return $global:netUseFeature } -ParametersEvaluator { $FeatureName -eq 'EnableLegacyWindowsMachineFileCopyNetUseCommand' }

Register-Mock Receive-Job { }  -ParametersEvaluator { $Id -eq 1 }
Register-Mock Receive-Job { throw "Copy to one or more machines failed." }  -ParametersEvaluator { $Id -eq 2 }

#Start-Job Register-Mocks
Register-Mock Start-Job { $testJobs.Add($Job1); return $job1} -ParametersEvaluator{$ArgumentList[0] -eq $validResource1.Name }
Register-Mock Start-Job { $testJobs.Add($Job2); return $job2} -ParametersEvaluator{$ArgumentList[0] -eq $validResource2.Name }

#Get-Job Register-Mocks
Register-Mock Get-Job { return $testJobs }

#Start-Sleep Register-Mocks
Register-Mock Start-Sleep { }

#Remove-Job Register-Mocks
Register-Mock Remove-Job { $testJobs.RemoveAt(0) }

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $EnvironmentNameForFailedJob  } -ParametersEvaluator{$EnvironmentName -eq $EnvironmentNameForFailedJob}

#Import-Module Register-Mocks
Register-Mock Import-Module { }

try
{
    $expectedTaskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $global:hardeningFeature = $null
    $global:netUseFeature = $true
    Assert-Throws {
        & "$copyFilesToMachinesPath" -environmentName $EnvironmentNameForFailedJob -machineNames $validMachineNames -sourcePath $validSourcePackage -targetPath $validApplicationPath -cleanTargetBeforeCopy $false -copyFilesInParallel $true
    } -MessagePattern "Copy to one or more machines failed."

    Assert-WasCalled Start-Job -Times 2 -ParametersEvaluator { $ArgumentList[7] -is [bool] -and $ArgumentList[7] -and $ArgumentList[9] -is [bool] -and -not $ArgumentList[9] }

    $testJobs.Clear()
    $global:hardeningFeature = 'False'
    Assert-Throws {
        & "$copyFilesToMachinesPath" -environmentName $EnvironmentNameForFailedJob -machineNames $validMachineNames -sourcePath $validSourcePackage -targetPath $validApplicationPath -cleanTargetBeforeCopy $false -copyFilesInParallel $true
    } -MessagePattern "Copy to one or more machines failed."

    Assert-WasCalled Start-Job -Times 2 -ParametersEvaluator { $ArgumentList[7] -is [bool] -and -not $ArgumentList[7] -and $ArgumentList[9] -is [bool] -and $ArgumentList[9] }
    Assert-WasCalled Start-Job -Times 4 -ParametersEvaluator { [IO.Path]::GetFullPath([string]$ArgumentList[8]) -eq $expectedTaskRoot }
}
finally
{
    Remove-Variable -Name hardeningFeature, netUseFeature -Scope Global -ErrorAction SilentlyContinue
}
