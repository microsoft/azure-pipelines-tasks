[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force


$invalidEnvironmentWithNoResource = "invalidEnvironmentWithNoResource"

Register-Mock Get-EnvironmentProperty { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $invalidEnvironmentNameForFailCopy}
Register-Mock Get-EnvironmentResources { return $resourceFailForCopy } -ParametersEvaluator {$EnvironmentName -eq $invalidEnvironmentNameForFailCopy}
Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-SanitizerActivateStatus { return $false }

Unregister-Mock Invoke-Command
Register-Mock Invoke-Command { throw "$FailedCopyError" }

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $invalidEnvironmentNameForFailCopy  } -ParametersEvaluator{$EnvironmentName -eq $invalidEnvironmentNameForFailCopy}

Assert-Throws {
    & "$copyFilesToMachinesPath" -environmentName $invalidEnvironmentNameForFailCopy -machineNames $validMachineNames -sourcePath $validSourcePackage -targetPath $validApplicationPath -cleanTargetBeforeCopy $true -copyFilesInParallel $false
} -MessagePattern "$FailedCopyError"
