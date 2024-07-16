[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

$invalidEnvironmentWithNoResource = "invalidEnvironmentWithNoResource"

#TODO : Mocked Modules - Move to Common Test Folder

Unregister-Mock Get-EnvironmentProperty
Register-Mock Get-EnvironmentProperty {  }

Register-Mock Get-EnvironmentResources { throw "No resources found" } -ParametersEvaluator{$EnvironmentName -eq $invalidEnvironmentWithNoResource}
Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $invalidEnvironmentWithNoResource } -ParametersEvaluator{$EnvironmentName -eq $invalidEnvironmentWithNoResource}
Register-Mock Get-SanitizerCallStatus { return $false }
Register-Mock Get-SanitizerActivateStatus { return $false }

Assert-Throws {
    & "$copyFilesToMachinesPath" -environmentName $invalidEnvironmentWithNoResource -machineNames $invalidInputMachineNames -sourcePath $validSourcePackage -targetPath $validApplicationPath -cleanTargetBeforeCopy $true -copyFilesInParallel $false
} -MessagePattern "No resources found"

Assert-WasCalled Get-EnvironmentProperty -Times 0

Unregister-Mock Get-EnvironmentResources
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}

& "$copyFilesToMachinesPath" -environmentName $validEnvironmentName -resourceFilteringMethod "tags" -machineNames "" -sourcePath $validSourcePackage -targetPath $validApplicationPath -cleanTargetBeforeCopy $true -copyFilesInParallel $false

Assert-WasCalled Get-EnvironmentResources -Times 1 -ParametersEvaluator {$validEnvironmentName -eq $validEnvironmentName}