[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Register-Mock Get-ParsedSessionVariables { }

Register-Mock Invoke-PsOnRemote { }
Register-Mock Invoke-Command {
    $deploymentResponse = @{}
    $deploymentResponse.Status = "Passed"
    return $deploymentResponse
 }
 
Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $envWithBothProtocalsNotSet  } -ParametersEvaluator {$EnvironmentName -eq $envWithBothProtocalsNotSet}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq ($envWithBothProtocalsNotSet)}
Register-Mock Get-EnvironmentProperty { return '' } -ParametersEvaluator {$Environment.Name -eq $envWithBothProtocalsNotSet -and $Key -eq $resourceWinRMHttpsPortKeyName}
Register-Mock Get-EnvironmentProperty { return '' } -ParametersEvaluator  {$Environment.Name -eq $envWithBothProtocalsNotSet -and $Key -eq $resourceWinRMHttpPortKeyName}

Assert-Throws {
    & "$remotePowershellRunnerPath" -environmentName $envWithBothProtocalsNotSet  -machineNames $validMachineName1 -scriptPath $validScriptPath -runPowershellInParallel $false
} -MessagePattern "*"

Assert-WasCalled Get-EnvironmentProperty -Times 1 -ParametersEvaluator {$Environment.Name -eq $envWithBothProtocalsNotSet -and $Key -eq $skipCACheckKeyName}
Assert-WasCalled Get-EnvironmentProperty -Times 1 -ParametersEvaluator {$Environment.Name -eq $envWithBothProtocalsNotSet -and $Key -eq $resourceWinRMHttpsPortKeyName}
Assert-WasCalled Get-EnvironmentProperty -Times 1 -ParametersEvaluator {$Environment.Name -eq $envWithBothProtocalsNotSet -and $Key -eq $resourceWinRMHttpPortKeyName}
