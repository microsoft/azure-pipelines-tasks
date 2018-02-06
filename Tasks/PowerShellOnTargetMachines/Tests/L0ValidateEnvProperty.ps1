[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Register-Mock Register-Environment {
    return GetEnvironmentWithStandardProvider $invalidEnvironmentNameForNoResourceProperty 
} -ParametersEvaluator { $EnvironmentName -eq $invalidEnvironmentNameForNoResourceProperty }

Register-Mock Get-EnvironmentResources { return $resourceFailForNoProperty } -ParametersEvaluator {$EnvironmentName -eq $invalidEnvironmentNameForNoResourceProperty}
Register-Mock Get-EnvironmentProperty { throw "No property invalidResourcePropertyKeyName found." } -ParametersEvaluator { $ResourceId -eq $machineIdForNoResouceProperty }

Assert-Throws {
    & "$remotePowershellRunnerPath" -environmentName $invalidEnvironmentNameForNoResourceProperty -machineNames $validMachineNames -scriptPath $validScriptPath -runPowershellInParallel $false
} -MessagePattern "No property invalidResourcePropertyKeyName found."

