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

Register-Mock Register-Environment { return GetEnvironmentWithAzureProvider  $EnvironmentName } -ParametersEvaluator {$EnvironmentName -eq $environmentWithSkipCASet}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$Environment.Name -eq ($environmentWithSkipCASet)}
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpsPort } -ParametersEvaluator {$Key -eq $resourceWinRMHttpsPortKeyName}

& "$remotePowershellRunnerPath" -environmentName $environmentWithSkipCASet  -machineNames $validMachineName1 -scriptPath $validScriptPath -runPowershellInParallel $false -protocol "HTTPS"

#Function invoked twice. (once for each valid resource)
Assert-WasCalled Get-EnvironmentProperty -Times 2 -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCASet -and $Key -eq $resourceWinRMHttpsPortKeyName}
Assert-WasCalled Get-EnvironmentProperty -Times 0 -ParametersEvaluator {$Environment.Name -eq $environmentWithSkipCASet -and $Key -eq $resourceWinRMHttpPortKeyName}