function Check-TestAgentIsRunning($Version)
{
    $testAgentPath = Locate-TestAgentPath($Version)
    if (!$testAgentPath)
    {
        Write-Verbose "Test Agent path doesn't exist" -verbose
        return $false
    }
    
    if (-not (Test-Path ($testAgentPath + "\Agent"))){
        Write-Verbose "Test Agent is not configured" -verbose
        return $false
    }

    $testAgentTfsUrl = (Get-ItemProperty ($testAgentPath + "\Agent") -ErrorAction SilentlyContinue).TfsUrl
    if ([string]::IsNullOrWhiteSpace($testAgentTfsUrl))
    {
        Write-Verbose "Test Agent is not running as it's not configured against Team Foundation Service" -verbose
        return $false
    }
    Write-Verbose "Test Agent is already running" -verbose
    return $true
}

Check-TestAgentIsRunning -Version "14.0"