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

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $environmentWithSkipCANotSet  } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCANotSet}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCANotSet}
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpPort } -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCANotSet -and $Key -eq $resourceWinRMHttpPortKeyName}

& "$remotePowershellRunnerPath" -environmentName $environmentWithSkipCANotSet  -machineNames $validMachineName1 -scriptPath $validScriptPath -runPowershellInParallel $false -protocol "HTTP"

Assert-WasCalled Get-EnvironmentProperty -Times 0 -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCANotSet -and $Key -eq $resourceWinRMHttpsPortKeyName}

# Function called twice
Assert-WasCalled Get-EnvironmentProperty -Times 2 -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCANotSet -and $Key -eq $resourceWinRMHttpPortKeyName}