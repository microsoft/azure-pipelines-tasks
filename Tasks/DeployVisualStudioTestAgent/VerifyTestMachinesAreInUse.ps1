function Check-TestAgentIsRunning($Version)
{
    $testAgentPath = Locate-TestAgentPath($Version)
    $testAgentTfsUrl = (Get-ItemProperty $testAgentPath -ErrorAction SilentlyContinue).TfsUrl
    if ([string]::IsNullOrWhiteSpace($testAgentTfsUrl))
    {
        Write-Verbose "Test Agent is not running as it's not configured against Team Foundation Service" -verbose
        return $false
    }
    Write-Verbose "Test Agent is already running" -verbose
    return $true
}

Check-TestAgentIsRunning -Version "14.0"