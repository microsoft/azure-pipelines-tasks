[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentName } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpsPort } -ParametersEvaluator {$Key -eq $resourceWinRMHttpsPortKeyName}
Register-Mock Get-ParsedSessionVariables { }

Register-Mock Get-EnvironmentProperty { return $validMachineName1 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}
Register-Mock Get-EnvironmentProperty { return $validMachineName2 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId2}

Register-Mock Invoke-PsOnRemote { $passResponseForResource1 } -ParametersEvaluator {$MachineDnsName -eq $validResource1.Name -and $scriptPath -eq $validScriptPath }
Register-Mock Invoke-PsOnRemote { $passResponseForResource2 } -ParametersEvaluator {$MachineDnsName -eq $validResource2.Name -and $scriptPath -eq $validScriptPath }

& "$remotePowershellRunnerPath" -environmentName $validEnvironmentName -machineNames $validMachineNames -scriptPath $validScriptPath -runPowershellInParallel $false `
                -adminUserName $userName -adminPassword $password -protocol $winRmProtocol -testCertificate "False"

Assert-WasCalled Register-Environment -Times 1 -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName -and $EnvironmentSpecification -eq $validEnvironmentName `
                        -and $UserName -eq $userName -and $Password -eq $password -and $WinRmProtocol -eq $winRmProtocol -and $TestCertificate -eq $false}