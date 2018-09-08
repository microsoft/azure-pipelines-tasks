[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Register-Mock Get-ParsedSessionVariables { }

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
    & "$remotePowershellRunnerPath" -environmentName $invalidEnvironmentNameForFailDeploy -machineNames $validMachineNames -scriptPath $validScriptPath -runPowershellInParallel $false
} -MessagePattern "$FailedDeployError"