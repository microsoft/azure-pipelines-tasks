function CheckTestAgentIsRunning([string] $ProcessName) {
    $dtaProcess = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    
    if (-not $dtaProcess)
    {
        Write-Verbose "DTAExecutionHost is not running" -Verbose
        return
    }

    Write-Verbose "Test Agent is already running" -Verbose
    Write-Verbose "Stopping the current DTAExecutionHost process" -Verbose
    Stop-Process $dtaProcess -ErrorAction SilentlyContinue
}

function RemoveTestAgentServiceIfExists([string] $ServiceName) {
    # Stop DTA Services if anything is running or registered
    # This is to make sure DTAv1 doesn't cause trouble during *reboots* for DTAv2
    Remove-Service -ServiceName "DTAAgentExecutionService" | Out-Null
}

function CheckTestAgentInstalled([string] $ProductVersion = "14.0") {
    Write-Verbose "Query for Testplatfrom version: $ProductVersion"

    $versionInstalled = Get-TestAgentInstalledVersion -ProductVersion $ProductVersion # Get installed test agent version as per user requested version
    if($versionInstalled -ne "0.0") {
        Write-Verbose -Message ("Test Agent already exists") -Verbose
        Write-Verbose -Message ("Version: $versionInstalled") -Verbose

        RemoveTestAgentServiceIfExists -ServiceName "DTAAgentExecutionService"
        CheckTestAgentIsRunning -ProcessName "DTAExecutionHost"
        Remove-Item -Recurse -Force "$Env:SystemDrive\TestAgent" -ErrorAction SilentlyContinue
    } else {
        Write-Verbose -Message ("Test Agent does not exists") -Verbose
    }
}

CheckTestAgentInstalled -ProductVersion $ProductVersion