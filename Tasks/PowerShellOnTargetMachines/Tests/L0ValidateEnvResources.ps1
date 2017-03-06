[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentNameWithNoVm } -ParametersEvaluator  { $EnvironmentName -eq $validEnvironmentNameWithNoVm }
Register-Mock Get-EnvironmentResources { return $emptyResourceList } -ParametersEvaluator { $EnvironmentName -eq $validEnvironmentNameWithNoVm }

# "Should throw for environment name with no vm"
Assert-Throws {
    & "$remotePowershellRunnerPath" -environmentName $validEnvironmentNameWithNoVm -machineNames $emptyInputMachineName -scriptPath $validScriptPath -runPowershellInParallel $false
} -MessagePattern "No machine exists under environment: '$validEnvironmentNameWithNoVm' for deployment"

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $invalidInputEnvironmentName } -ParametersEvaluator { $EnvironmentName -eq $invalidInputEnvironmentName }
Register-Mock Get-EnvironmentResources { throw "No environment found" } -ParametersEvaluator {$EnvironmentName -eq $invalidInputEnvironmentName}
Register-Mock Get-EnvironmentProperty { }

# "Should throw for invalid environment name"
Assert-Throws {
    & "$remotePowershellRunnerPath" -environmentName $invalidInputEnvironmentName -machineNames $validMachineNames -scriptPath $validScriptPath -runPowershellInParallel $false
} -MessagePattern "No environment found"

Assert-WasCalled Get-EnvironmentProperty -Times 0

$invalidEnvironmentWithNoResource = "invalidEnvironmentWithNoResource"
Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $invalidEnvironmentWithNoResource } -ParametersEvaluator { $EnvironmentName -eq $invalidEnvironmentWithNoResource }
Register-Mock Get-EnvironmentResources { throw "No resources found" } -ParametersEvaluator {$EnvironmentName -eq $invalidEnvironmentWithNoResource}

# "Should throw for invalid machine names"
Assert-Throws {
    & "$remotePowershellRunnerPath" -environmentName $invalidEnvironmentWithNoResource -machineNames $invalidInputMachineNames -scriptPath $validScriptPath -runPowershellInParallel $false
} -MessagePattern "No resources found"

Assert-WasCalled Get-EnvironmentProperty -Times 0


Unregister-Mock Get-EnvironmentProperty
Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentName } -ParametersEvaluator { $EnvironmentName -eq $validEnvironmentName }
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator { $EnvironmentName -eq $validEnvironmentName }
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpPort } -ParametersEvaluator { $Key -eq $resourceWinRMHttpPortKeyName }

Register-Mock Invoke-Command {  
    $deploymentResponse = @{}
    $deploymentResponse.Status = "Passed"
    return $deploymentResponse
}
#should not throw error for valid input
& "$remotePowershellRunnerPath" -environmentName $validEnvironmentName -resourceFilteringMethod "tags" -machineNames $validTagString -scriptPath $validScriptPath -runPowershellInParallel $false

Assert-WasCalled Get-EnvironmentResources -Times 1 -ParametersEvaluator { $Environment.Name -eq $validEnvironmentName }