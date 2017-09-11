[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentNameWithNoVm } -ParametersEvaluator  { $EnvironmentName -eq $validEnvironmentNameWithNoVm }
Register-Mock Get-EnvironmentResources { return $emptyResourceList } -ParametersEvaluator { $EnvironmentName -eq $validEnvironmentNameWithNoVm }

Unregister-Mock Receive-Job
Register-Mock Receive-Job {return @{"Status"="Failed"}}

# "Should throw for environment name with no vm"
Assert-Throws {

    Unregister-Mock Get-VstsInput
    Register-Mock Get-VstsInput { return $validEnvironmentNameWithNoVm } -ParametersEvaluator{ $Name -eq  "EnvironmentName" }
    Register-Mock Get-VstsInput { return $emptyInputMachineName } -ParametersEvaluator{ $Name -eq  "MachineNames" }
    Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq  "ScriptPath" }
    Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "runPowershellInParallel" }
    Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "InitializationScriptPath" }
    Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq  "adminUsername" }

    & "$remotePowershellRunnerPath"
} -MessagePattern "PS_TM_NoMachineExistsUnderEnvironment0ForDeployment validEnvironmentNameWithNoVm"

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $invalidInputEnvironmentName } -ParametersEvaluator { $EnvironmentName -eq $invalidInputEnvironmentName }
Register-Mock Get-EnvironmentResources { throw "No environment found" } -ParametersEvaluator {$EnvironmentName -eq $invalidInputEnvironmentName}
Register-Mock Get-EnvironmentProperty { }

Unregister-Mock Receive-Job
Register-Mock Receive-Job {return @{"Status"="Failed"}}

# "Should throw for invalid environment name"
Assert-Throws {

    Unregister-Mock Get-VstsInput
    Register-Mock Get-VstsInput { return $invalidInputEnvironmentName } -ParametersEvaluator{ $Name -eq  "EnvironmentName" }
    Register-Mock Get-VstsInput { return $validMachineNames } -ParametersEvaluator{ $Name -eq  "MachineNames" }
    Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq  "ScriptPath" }
    Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "runPowershellInParallel" }
    Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "InitializationScriptPath" }
    Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq  "adminUsername" }

    & "$remotePowershellRunnerPath"
} -MessagePattern "No environment found"

Assert-WasCalled Get-EnvironmentProperty -Times 0

$invalidEnvironmentWithNoResource = "invalidEnvironmentWithNoResource"
Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $invalidEnvironmentWithNoResource } -ParametersEvaluator { $EnvironmentName -eq $invalidEnvironmentWithNoResource }
Register-Mock Get-EnvironmentResources { throw "No resources found" } -ParametersEvaluator {$EnvironmentName -eq $invalidEnvironmentWithNoResource}

Unregister-Mock Receive-Job
Register-Mock Receive-Job {return @{"Status"="Failed"}}

# "Should throw for invalid machine names"
Assert-Throws {
    
    Unregister-Mock Get-VstsInput
    Register-Mock Get-VstsInput { return $invalidEnvironmentWithNoResource } -ParametersEvaluator{ $Name -eq  "EnvironmentName" }
    Register-Mock Get-VstsInput { return $invalidInputMachineNames } -ParametersEvaluator{ $Name -eq  "MachineNames" }
    Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq  "ScriptPath" }
    Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "runPowershellInParallel" }
    Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "InitializationScriptPath" }
    Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq  "adminUsername" }

    & "$remotePowershellRunnerPath"
} -MessagePattern "No resources found"

Assert-WasCalled Get-EnvironmentProperty -Times 0


Unregister-Mock Get-EnvironmentProperty
Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentName } -ParametersEvaluator { $EnvironmentName -eq $validEnvironmentName }
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator { $EnvironmentName -eq $validEnvironmentName }
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpPort } -ParametersEvaluator { $Key -eq $resourceWinRMHttpPortKeyName }
Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq  "adminUsername" }

Unregister-Mock Receive-Job
Register-Mock Receive-Job {return @{"Status"="Passed"}}

Register-Mock Invoke-Command {  
    $deploymentResponse = @{}
    $deploymentResponse.Status = "Passed"
    return $deploymentResponse
}

Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { return $validEnvironmentName } -ParametersEvaluator{ $Name -eq  "EnvironmentName" }
Register-Mock Get-VstsInput { return $validTagString } -ParametersEvaluator{ $Name -eq  "MachineNames" }
Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq  "ScriptPath" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "runPowershellInParallel" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "InitializationScriptPath" }
Register-Mock Get-VstsInput { return "tags" } -ParametersEvaluator{ $Name -eq  "resourceFilteringMethod" }
Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq  "adminUsername" }

#should not throw error for valid input
& "$remotePowershellRunnerPath"

Assert-WasCalled Get-EnvironmentResources -Times 1 -ParametersEvaluator { $Environment.Name -eq $validEnvironmentName }