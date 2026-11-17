[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

# Resource/environment property values (e.g. a WinRM port tag) are untrusted - they can be set by
# anyone with write access to the target resource, independent of who owns/runs this pipeline.
# This test asserts those values always reach Invoke-PsOnRemote as literal data, never as text that
# gets evaluated as PowerShell before the call is made.
$maliciousPort = "5986`$(Set-Content -LiteralPath ([IO.Path]::Combine(`$env:AGENT_TEMPDIRECTORY,'canary.txt')) -Value pwned)"
$maliciousFqdn = "contoso.example.com`$(Set-Content -LiteralPath ([IO.Path]::Combine(`$env:AGENT_TEMPDIRECTORY,'canary.txt')) -Value pwned)"

$remotePowershellRunnerPath = "$PSScriptRoot\..\PowerShellOnTargetMachines.ps1"

Register-Mock Register-Environment { return GetEnvironmentWithStandardProvider $validEnvironmentName } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-EnvironmentResources { return @($validResource1) } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}
Register-Mock Get-ParsedSessionVariables { }

# Both the WinRM port AND the machine FQDN are attacker-reachable resource properties - exercise both.
Register-Mock Get-EnvironmentProperty { return $maliciousPort } -ParametersEvaluator {$Key -eq $resourceWinRMHttpsPortKeyName}
Register-Mock Get-EnvironmentProperty { return $maliciousFqdn } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}

Register-Mock Invoke-PsOnRemote { $passResponseForResource1 } -ParametersEvaluator {
    # The mock only matches (and the task only succeeds) when BOTH hostile values arrive intact,
    # character-for-character, as plain string parameters - i.e. never evaluated as code.
    $MachineDnsName -ceq $maliciousFqdn -and $WinRMPort -ceq $maliciousPort
}

& "$remotePowershellRunnerPath" -environmentName $validEnvironmentName -machineNames $validMachineNames -scriptPath $validScriptPath -runPowershellInParallel $false `
                -adminUserName $userName -adminPassword $password -protocol $winRmProtocol -testCertificate "False"

Assert-WasCalled Invoke-PsOnRemote -Times 1 -ParametersEvaluator {
    $MachineDnsName -ceq $maliciousFqdn -and $WinRMPort -ceq $maliciousPort
}
