function Check-TestAgentIsRunning([string] $version)
{
	$version = LocateTestVersion $version
	Write-Verbose "VS Agent version $version" -verbose
	
	$testAgentPath = "HKLM:\SOFTWARE\Microsoft\VisualStudio\{0}\EnterpriseTools\QualityTools\Agent" -f $version
	
	if (-not (Test-Path $testAgentPath))
	{
		$testAgentPath = "HKLM:\SOFTWARE\Wow6432Node\Microsoft\VisualStudio\{0}\EnterpriseTools\QualityTools\Agent" -f $version
	}
	
	if (-not (Test-Path $testAgentPath))
	{
		Write-Verbose "Test Agent is not running as Path doesn't exist" -verbose
		return $false
	}
	
	$testAgentTfsUrl = (Get-ItemProperty $testAgentPath -ErrorAction SilentlyContinue).TfsUrl
	if ([string]::IsNullOrWhiteSpace($testAgentTfsUrl))
	{
		Write-Verbose "Test Agent is not running as it's not configured against Team Foundation Service" -verbose
		return $false
	}
	Write-Verbose "Test Agent is already running" -verbose
	return $true
}

Check-TestAgentIsRunning -version "14.0"