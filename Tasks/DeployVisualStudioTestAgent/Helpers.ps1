function LocateTestVersion($productversion)
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
	$avlVersion = Get-SubKeysInFloatFormat $keys | Sort-Object -Descending | Select-Object -First 1	
	
	if ([string]::IsNullOrWhiteSpace($avlVersion))
	{
		return $productversion
	}
	return $avlVersion
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