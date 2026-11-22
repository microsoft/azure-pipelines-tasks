[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

Unregister-Mock Get-VstsInput

Register-Mock Get-VstsInput { return $validEnvironmentName } -ParametersEvaluator{ $Name -eq  "MachineNames" }
Register-Mock Get-VstsInput { return $password } -ParametersEvaluator{ $Name -eq  "AdminPassword" }
Register-Mock Get-VstsInput { return $validSourcePackage } -ParametersEvaluator{ $Name -eq  "SourcePath" }
Register-Mock Get-VstsInput { return $validApplicationPath } -ParametersEvaluator{ $Name -eq  "TargetPath" }
Register-Mock Get-VstsInput { return $true } -ParametersEvaluator{ $Name -eq  "CleanTargetBeforeCopy" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "CopyFilesInParallel" }

Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-SanitizerActivateStatus { return $false }
Register-Mock Test-LegacyCommandOptIn { return $global:legacyOptIn }
Register-Mock Get-VstsPipelineFeature { return $false } -ParametersEvaluator { $FeatureName -eq 'EnableWindowsMachineFileCopyArgumentsHardening' }

try
{
    $expectedTaskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $global:legacyOptIn = $false
    & "$copyFilesToMachinesPath"

    Assert-WasCalled Invoke-Command -Times 1 -ParametersEvaluator { $ArgumentList[8] -is [bool] -and $ArgumentList[8] }

    $global:legacyOptIn = $true
    & "$copyFilesToMachinesPath"

    Assert-WasCalled Invoke-Command -Times 1 -ParametersEvaluator { $ArgumentList[8] -is [bool] -and -not $ArgumentList[8] }
    Assert-WasCalled Invoke-Command -Times 2 -ParametersEvaluator { [IO.Path]::GetFullPath([string]$ArgumentList[6]) -eq $expectedTaskRoot }
}
finally
{
    Remove-Variable -Name legacyOptIn -Scope Global -ErrorAction SilentlyContinue
}