function Check-TestAgentIsRunning([string] $Version)
{
	$Version = Locate-TestVersion
	$testAgentPath = "HKLM:\SOFTWARE\Microsoft\VisualStudio\{0}\EnterpriseTools\QualityTools\Agent" -f $Version
	
	if (-not (Test-Path $testAgentPath))
	{
		$testAgentPath = "HKLM:\SOFTWARE\Wow6432Node\Microsoft\VisualStudio\{0}\EnterpriseTools\QualityTools\Agent" -f $Version
	}
	
	if (-not (Test-Path $testAgentPath))
	{
        Write-Verbose "Test Agent is not running as Path doesn't exist" -verbose
		return $false
	}
	
	$testAgentTfsUrl = (Get-ItemProperty $testAgentPath -ErrorAction SilentlyContinue).TfsUrl
	if (($testAgentTfsUrl -eq $null) -or ($testAgentTfsUrl.Length -eq 0))
    {
        Write-Verbose "Test Agent is not running as TfsUrl is empty" -verbose
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
	$keys = Get-Item $regPath | %{$_.GetSubKeyNames()}
	$Version = Get-SubKeysInFloatFormat $keys | Sort-Object -Descending | Select-Object -First 1

	if ([string]::IsNullOrWhiteSpace($Version))
	{
		return $null
	}
	return $Version
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

Check-TestAgentIsRunning -Version "14.0"