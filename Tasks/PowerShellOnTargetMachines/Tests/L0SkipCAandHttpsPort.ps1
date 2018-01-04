[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { return $environmentWithSkipCASet } -ParametersEvaluator{ $Name -eq  "EnvironmentName" }
Register-Mock Get-VstsInput { return $validMachineName1 } -ParametersEvaluator{ $Name -eq  "MachineNames" }
Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq  "ScriptPath" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "RunPowershellInParallel" }
Register-Mock Get-VstsInput { return "HTTPS" } -ParametersEvaluator{ $Name -eq  "protocol" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "InitializationScriptPath" }
Register-Mock Get-VstsInput { return "adminUser" } -ParametersEvaluator{ $Name -eq  "adminUsername" }

Register-Mock Get-ParsedSessionVariables { }
Register-Mock Receive-Job {return @{"Status"="Passed"}}

Register-Mock Invoke-PsOnRemote { }
Register-Mock Invoke-Command {
    $deploymentResponse = @{}
    $deploymentResponse.Status = "Passed"
    return $deploymentResponse
 }

Register-Mock Register-Environment { return GetEnvironmentWithAzureProvider  $EnvironmentName } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCASet}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$Environment.Name -eq ($environmentWithSkipCASet)}
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpsPort } -ParametersEvaluator {$Key -eq $resourceWinRMHttpsPortKeyName}

& "$remotePowershellRunnerPath"

#Function invoked twice. (once for each valid resource)
Assert-WasCalled Get-EnvironmentProperty -Times 2 -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCASet -and $Key -eq $resourceWinRMHttpsPortKeyName}
Assert-WasCalled Get-EnvironmentProperty -Times 0 -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCASet -and $Key -eq $resourceWinRMHttpPortKeyName}