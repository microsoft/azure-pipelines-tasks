function GetEnvironmentWithStandardProvider(
    [string]$environmentName)
{
    return @{ "Name" = $environmentName }
}

Register-Mock Test-Path { return $true } -ParametersEvaluator{ $LiteralPath -eq  $validSourcePackage }
Register-Mock Test-Path { return $false } -ParametersEvaluator { $LiteralPath -eq $invalidSourcePath }
Register-Mock Get-ResourceFQDNTagKey { return $validResourceFQDNKeyName }
Register-Mock Get-VssConnection { return $null }

Register-Mock Invoke-Command { }
Register-Mock Get-ResourceCredentials { }


#Register-Mock Get-EnvironmentProperty { return $validMachineName1 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId1}
#Register-Mock Get-EnvironmentProperty { return $validMachineName2 } -ParametersEvaluator {$Key -eq $resourceFQDNKeyName -and $ResourceId -eq $validMachineId2}
#Register-Mock Get-EnvironmentProperty { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $invalidEnvironmentNameForFailCopy}
#Register-Mock Get-EnvironmentProperty { return $validResources } -ParametersEvaluator {$EnvironmentName -eq $validEnvironmentName}