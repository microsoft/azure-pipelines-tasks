[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

Unregister-Mock Get-VstsInput

Register-Mock Get-VstsInput { return $invalidEnvironmentNameForFailCopy } -ParametersEvaluator{ $Name -eq  "MachineNames" }
Register-Mock Get-VstsInput { return $password } -ParametersEvaluator{ $Name -eq  "AdminPassword" }
Register-Mock Get-VstsInput { return $validSourcePackage } -ParametersEvaluator{ $Name -eq  "SourcePath" }
Register-Mock Get-VstsInput { return $validApplicationPath } -ParametersEvaluator{ $Name -eq  "TargetPath" }
Register-Mock Get-VstsInput { return $true } -ParametersEvaluator{ $Name -eq  "CleanTargetBeforeCopy" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "CopyFilesInParallel" }

Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-SanitizerActivateStatus { return $false }

$invalidEnvironmentWithNoResource = "invalidEnvironmentWithNoResource"

Unregister-Mock Invoke-Command
Register-Mock Invoke-Command { throw "$FailedCopyError" }

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $invalidEnvironmentNameForFailCopy  } -ParametersEvaluator{$EnvironmentName -eq $invalidEnvironmentNameForFailCopy}

Assert-Throws {
    & "$copyFilesToMachinesPath"
} -MessagePattern "$FailedCopyError"
