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
