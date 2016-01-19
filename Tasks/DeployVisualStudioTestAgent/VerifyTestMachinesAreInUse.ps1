function Check-TestAgentIsRunning([string] $version)
{
	$avlVersion = Locate-TestVersion
	if($avlVersion)
	{
		$version = $avlVersion
	}
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

function Locate-TestVersion()
{
	#Find the latest version
	$regPath = "HKLM:\SOFTWARE\Microsoft\DevDiv\vstf\Servicing"
	if (-not (Test-Path $regPath))
	{
		$regPath = "HKLM:\SOFTWARE\Wow6432Node\Microsoft\DevDiv\vstf\Servicing"
	}
	if (-not (Test-Path $regPath))
	{
		return $null
	}
	
	$keys = Get-Item $regPath | %{$_.GetSubKeyNames()} -ErrorAction SilentlyContinue
	$version = Get-SubKeysInFloatFormat $keys | Sort-Object -Descending | Select-Object -First 1

	if ([string]::IsNullOrWhiteSpace($version))
	{
		return $null
	}
	return $version
}

function Get-SubKeysInFloatFormat($keys)
{
	$targetKeys = @()      # New array
	foreach ($key in $keys)
	{
		$targetKeys += [decimal] $key
	}

	return $targetKeys
}

Check-TestAgentIsRunning -version "14.0"