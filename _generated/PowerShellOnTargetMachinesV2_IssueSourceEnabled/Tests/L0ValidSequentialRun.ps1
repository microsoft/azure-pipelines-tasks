[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Unregister-Mock Get-VstsInput
Register-Mock Get-VstsInput { return $validEnvironmentName } -ParametersEvaluator{ $Name -eq  "EnvironmentName" }
Register-Mock Get-VstsInput { return $validMachineNames } -ParametersEvaluator{ $Name -eq  "MachineNames" }
Register-Mock Get-VstsInput { return $validScriptPath } -ParametersEvaluator{ $Name -eq  "ScriptPath" }
Register-Mock Get-VstsInput { return $userName } -ParametersEvaluator{ $Name -eq  "adminUserName" }
Register-Mock Get-VstsInput { return $password } -ParametersEvaluator{ $Name -eq  "adminPassword" }
Register-Mock Get-VstsInput { return $winRmProtocol } -ParametersEvaluator{ $Name -eq  "protocol" }
Register-Mock Get-VstsInput { return $testCertificate } -ParametersEvaluator{ $Name -eq  "False" }
Register-Mock Get-VstsInput { return $false } -ParametersEvaluator{ $Name -eq  "RunPowershellInParallel" }
Register-Mock Get-VstsInput { return "" } -ParametersEvaluator{ $Name -eq  "InitializationScriptPath" }

Register-Mock Get-ParsedSessionVariables { }
Register-Mock Receive-Job {return @{"Status"="Passed"}}

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentName } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentResources { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentProperty { return $environmentWinRMHttpsPort } -ParametersEvaluator {$Key -eq $resourceWinRMHttpsPortKeyName}

Register-Mock Get-EnvironmentProperty { return $validMachineName1 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}
Register-Mock Get-EnvironmentProperty { return $validMachineName2 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId2}

Register-Mock Invoke-PsOnRemote { $passResponseForResource1 } -ParametersEvaluator {$MachineDnsName -eq $validResource1.Name -and $scriptPath -eq $validScriptPath }
Register-Mock Invoke-PsOnRemote { $passResponseForResource2 } -ParametersEvaluator {$MachineDnsName -eq $validResource2.Name -and $scriptPath -eq $validScriptPath }

& "$remotePowershellRunnerPath"

Assert-WasCalled Register-Environment -Times 1 -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName -and $EnvironmentSpecification -eq $validEnvironmentName `
                        -and $UserName -eq $userName -and $Password -eq $password -and $WinRmProtocol -eq $winRmProtocol -and $TestCertificate -eq $false}