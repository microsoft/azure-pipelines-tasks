[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentName } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentProperty { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-SanitizerActivateStatus { return $false }

& "$copyFilesToMachinesPath" -environmentName $validEnvironmentName -machineNames $validMachineNames -sourcePath $validSourcePackage -targetPath $validApplicationPath -cleanTargetBeforeCopy $true -copyFilesInParallel $false

Assert-WasCalled Invoke-Command -Times 2