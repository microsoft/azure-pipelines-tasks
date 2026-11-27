[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentName } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentProperty { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-SanitizerActivateStatus { return $false }
Register-Mock Get-VstsTaskVariable { return $global:hardeningFeature } -ParametersEvaluator { $Name -eq 'DistributedTask.Tasks.EnableWindowsMachineFileCopyArgumentsHardening' }
Register-Mock Get-VstsPipelineFeature { return $global:netUseFeature } -ParametersEvaluator { $FeatureName -eq 'EnableLegacyWindowsMachineFileCopyNetUseCommand' }

try
{
    $expectedTaskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $global:hardeningFeature = $null
    $global:netUseFeature = $true
    & "$copyFilesToMachinesPath" -environmentName $validEnvironmentName -machineNames $validMachineNames -sourcePath $validSourcePackage -targetPath $validApplicationPath -cleanTargetBeforeCopy $true -copyFilesInParallel $false

    Assert-WasCalled Invoke-Command -Times 2 -ParametersEvaluator { $ArgumentList[7] -is [bool] -and $ArgumentList[7] -and $ArgumentList[9] -is [bool] -and -not $ArgumentList[9] }

    $global:hardeningFeature = 'False'
    & "$copyFilesToMachinesPath" -environmentName $validEnvironmentName -machineNames $validMachineNames -sourcePath $validSourcePackage -targetPath $validApplicationPath -cleanTargetBeforeCopy $true -copyFilesInParallel $false

    Assert-WasCalled Invoke-Command -Times 2 -ParametersEvaluator { $ArgumentList[7] -is [bool] -and -not $ArgumentList[7] -and $ArgumentList[9] -is [bool] -and $ArgumentList[9] }
    Assert-WasCalled Invoke-Command -Times 4 -ParametersEvaluator { [IO.Path]::GetFullPath([string]$ArgumentList[8]) -eq $expectedTaskRoot }
}
finally
{
    Remove-Variable -Name hardeningFeature, netUseFeature -Scope Global -ErrorAction SilentlyContinue
}