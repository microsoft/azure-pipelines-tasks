function GetEnvironmentWithStandardProvider(
    [string]$environmentName)
{
    return @{ "Name" = $environmentName }
}

Unregister-Mock Test-Path
Unregister-Mock ConvertTo-SecureString
Unregister-Mock Invoke-Command

Register-Mock Test-Path { return $true } -ParametersEvaluator{ $LiteralPath -eq  $validSourcePackage }
Register-Mock Test-Path { return $false } -ParametersEvaluator { $LiteralPath -eq $invalidSourcePath }

Register-Mock Invoke-Command { }
Register-Mock ConvertTo-SecureString { return $password }
