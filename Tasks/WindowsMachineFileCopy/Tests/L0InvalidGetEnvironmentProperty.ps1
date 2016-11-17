[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

$invalidEnvironmentWithNoResource = "invalidEnvironmentWithNoResource"

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $invalidEnvironmentNameForNoResourceProperty  } -ParametersEvaluator{$EnvironmentName -eq $invalidEnvironmentNameForNoResourceProperty}
Register-Mock Get-EnvironmentResources { return $resourceFailForNoProperty } -ParametersEvaluator{$EnvironmentName -eq $invalidEnvironmentNameForNoResourceProperty}
Register-Mock Get-EnvironmentProperty { throw "No property invalidResourcePropertyKeyName found." } -ParametersEvaluator{$ResourceId -eq $machineIdForNoResouceProperty}

Assert-Throws {
    & "$copyFilesToMachinesPath" -environmentName $invalidEnvironmentNameForNoResourceProperty -machineNames $validMachineNames -sourcePath $validSourcePackage -targetPath $validApplicationPath -cleanTargetBeforeCopy $true -copyFilesInParallel $false
} -MessagePattern "No property invalidResourcePropertyKeyName found."

Assert-WasCalled Get-EnvironmentProperty -Times 0 -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName -and $Key -eq "Password"}