[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Register-Mock Invoke-PsOnRemote { }
Register-Mock Invoke-Command {
    $deploymentResponse = @{}
    $deploymentResponse.Status = "Passed"
    return $deploymentResponse
}

Register-Mock Register-Environment { return GetEnvironmentWithAzureProvider $EnvironmentName } -ParametersEvaluator { $EnvironmentName -eq $environmentWithSkipCASet }
Register-Mock Get-EnvironmentResources { $validResources } -ParametersEvaluator { $EnvironmentName -eq $environmentWithSkipCASet }

Register-Mock Get-EnvironmentProperty { $environmentWinRMHttpsPort} -ParametersEvaluator { $Environment.Name -eq $environmentWithSkipCASet -and $Key -eq $resourceWinRMHttpsPortKeyName }
Register-Mock Get-ParsedSessionVariables { }

& "$remotePowershellRunnerPath" -environmentName $environmentWithSkipCASet -machineNames $validMachineName1 -scriptPath $validScriptPath -runPowershellInParallel $false

Assert-WasCalled Get-EnvironmentProperty -Times 1 -ParametersEvaluator { $Environment.Name -eq $environmentWithSkipCASet -and $Key -eq $skipCACheckKeyName }
Assert-WasCalled Get-EnvironmentProperty -Times 0 -ParametersEvaluator { $Key -eq $resourceWinRMHttpPortKeyName }