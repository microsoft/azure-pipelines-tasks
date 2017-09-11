[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { return $invalidEnvironmentNameForFailDeploy } -ParametersEvaluator{ $Name -eq  "EnvironmentName" }
Register-Mock Get-VstsInput { return $validMachineNames } -ParametersEvaluator{ $Name -eq  "MachineNames" }
Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq  "ScriptPath" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "RunPowershellInParallel" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "InitializationScriptPath" }
Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq  "adminUsername" }

Register-Mock Get-ParsedSessionVariables { }
Register-Mock Receive-Job {return @{"Status"="Failed"}}

Register-Mock Register-Environment { 
    return GetEnvironmentWithStandardProvider $invalidEnvironmentNameForFailDeploy
} -ParametersEvaluator {$EnvironmentName -eq $invalidEnvironmentNameForFailDeploy}

Register-Mock Get-EnvironmentResources { return $resourceFailForDeploy } -ParametersEvaluator {$EnvironmentName -eq $invalidEnvironmentNameForFailDeploy}
Register-Mock Get-Environment { return $environmentWithStandardProvider } -ParametersEvaluator {$EnvironmentName -eq $invalidEnvironmentNameForFailDeploy}

Register-Mock Get-EnvironmentProperty {
    $machineNamesForFailDeploy
}

Register-Mock Invoke-PsOnRemote { throw "$FailedDeployError" } -ParametersEvaluator { $MachineDnsName -eq $machineNamesForFailDeploy}

Assert-Throws {
    & "$remotePowershellRunnerPath"
} -MessagePattern "$FailedDeployError"