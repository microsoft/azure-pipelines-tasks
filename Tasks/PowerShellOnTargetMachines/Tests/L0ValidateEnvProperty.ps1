[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { return $invalidEnvironmentNameForNoResourceProperty } -ParametersEvaluator{ $Name -eq  "EnvironmentName" }
Register-Mock Get-VstsInput { return $validMachineNames } -ParametersEvaluator{ $Name -eq  "MachineNames" }
Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq  "ScriptPath" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "RunPowershellInParallel" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "InitializationScriptPath" }
Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq  "adminUsername" }

Register-Mock Get-ParsedSessionVariables { }
Register-Mock Receive-Job {return @{"Status"="Failed"}}

Register-Mock Register-Environment {
    return GetEnvironmentWithStandardProvider $invalidEnvironmentNameForNoResourceProperty 
} -ParametersEvaluator { $EnvironmentName -eq $invalidEnvironmentNameForNoResourceProperty }

Register-Mock Get-EnvironmentResources { return $resourceFailForNoProperty } -ParametersEvaluator {$EnvironmentName -eq $invalidEnvironmentNameForNoResourceProperty}
Register-Mock Get-EnvironmentProperty { throw "No property invalidResourcePropertyKeyName found." } -ParametersEvaluator { $ResourceId -eq $machineIdForNoResouceProperty }

Assert-Throws {
    & "$remotePowershellRunnerPath"
} -MessagePattern "No property invalidResourcePropertyKeyName found."

