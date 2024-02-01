[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { return $environmentWithSkipCANotSet } -ParametersEvaluator{ $Name -eq  "EnvironmentName" }
Register-Mock Get-VstsInput { return $validMachineName1 } -ParametersEvaluator{ $Name -eq  "MachineNames" }
Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq  "ScriptPath" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "RunPowershellInParallel" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "InitializationScriptPath" }
Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq  "adminUsername" }

Register-Mock Get-ParsedSessionVariables { return ""}
Register-Mock Receive-Job {return @{"Status"="Passed"}}

Register-Mock Invoke-PsOnRemote { }
Register-Mock Invoke-Command {
    $deploymentResponse = @{}
    $deploymentResponse.Status = "Passed"
    return $deploymentResponse
 }

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $environmentWithSkipCANotSet  } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCANotSet}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCANotSet}
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpPort } -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCANotSet -and $Key -eq $resourceWinRMHttpPortKeyName}

& "$remotePowershellRunnerPath" 

Assert-WasCalled Get-EnvironmentProperty  -Times 1 -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCANotSet -and $Key -eq $skipCACheckKeyName}
Assert-WasCalled Get-EnvironmentProperty -Times 0 -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCANotSet -and $Key -eq $resourceWinRMHttpsPortKeyName}
Assert-WasCalled Get-EnvironmentProperty -Times 2 -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCANotSet -and $Key -eq $resourceWinRMHttpPortKeyName}
