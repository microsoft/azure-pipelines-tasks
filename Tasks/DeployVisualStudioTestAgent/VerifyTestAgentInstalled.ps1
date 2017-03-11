function CheckTestAgentIsRunning([string] $ProcessName) {
	$dtaProcess = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
	if (-not $dtaProcess)
	{
		Write-Verbose "Test Agent is not running as it's not configured against Team Foundation Service" -verbose
        return
	}
	Write-Verbose "Test Agent is already running" -verbose
}

function CheckTestAgentInstalled([string] $ProductVersion = "14.0") {
	Write-Verbose "Query for Testplatfrom version: $ProductVersion"

	$versionInstalled = Get-TestAgentInstalledVersion -ProductVersion $ProductVersion # Get installed test agent version as per user requested version
	if($versionInstalled -ne "0.0") {
		Write-Verbose -Message ("Test Agent already exists") -verbose
		Write-Verbose -Message ("Version: $versionInstalled") -verbose

		CheckTestAgentIsRunning -ProcessName "DTAExecutionHost"
	} else {
		Write-Verbose -Message ("Test Agent does not exists") -verbose
	}
}

CheckTestAgentInstalled -ProductVersion $ProductVersion