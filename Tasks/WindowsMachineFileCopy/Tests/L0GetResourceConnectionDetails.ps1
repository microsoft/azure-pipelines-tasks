[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force

. $PSScriptRoot\..\Utility.ps1

Register-Mock Get-ResourceCredentials { }

Register-Mock Get-EnvironmentProperty { throw "No property invalidResourcePropertyKeyName found." } -ParametersEvaluator{$ResourceId -eq $machineIdForNoResouceProperty}

Assert-Throws {
    Get-ResourceConnectionDetails -envName "envName" -resource $resourceFailForNoProperty
} -MessagePattern "No property invalidResourcePropertyKeyName found."
Assert-WasCalled Get-EnvironmentProperty -Times 1

Register-Mock Get-EnvironmentProperty { return $validMachineName1 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}

Get-ResourceConnectionDetails -envName "envName" -resource $validResource1
Assert-WasCalled Get-EnvironmentProperty -Times 1 -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}

Register-Mock Get-EnvironmentProperty { return $validMachineName2 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId2}

Get-ResourceConnectionDetails -envName "envName" -resource $validResource2
Assert-WasCalled Get-EnvironmentProperty -Times 1 -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId2}
