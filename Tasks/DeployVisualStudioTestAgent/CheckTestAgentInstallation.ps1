function Check-Installation($ProductVersion)
{
    $InstalledCheckRegKey = ("SOFTWARE\Microsoft\DevDiv\vstf\Servicing\{0}\testagentcore" -f $ProductVersion)
	$InstalledCheckRegValueName = "Install"
	$InstalledCheckRegValueData = "1"

	$isProductExists = Get-ProductEntry -InstalledCheckRegKey $InstalledCheckRegKey -InstalledCheckRegValueName $InstalledCheckRegValueName -InstalledCheckRegValueData $InstalledCheckRegValueData

	if($isProductExists)
	{
		Write-Verbose -Message ("Test Agent already exists") -verbose
	}
	else
	{
		Write-Verbose -Message ("Test Agent does not exists.") -verbose
	}
}

function Get-RegistryValue {
	param
	(
		[parameter(Mandatory = $true)]
		[Microsoft.Win32.RegistryHive]
		$RegistryHive,

		[parameter(Mandatory = $true)]
		[System.String]
		$Key,

		[parameter(Mandatory = $true)]
		[System.String]
		$Value,

		[parameter(Mandatory = $true)]
		[Microsoft.Win32.RegistryView]
		$RegistryView
	)

	try
	{
		$baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey($RegistryHive, $RegistryView)
		$subKey = $baseKey.OpenSubKey($Key)

		if($subKey -ne $null)
		{
			return $subKey.GetValue($Value)
		}
	}
	catch
	{
		$exceptionText = ($_ | Out-String).Trim()
		Write-Verbose "Exception occured in GetRegistryValueIgnoreError: $exceptionText" -verbose
	}

	return $null
}

function Get-ProductEntry {
	param
	(
		[string] $InstalledCheckRegKey,
		[string] $InstalledCheckRegValueName,
		[string] $InstalledCheckRegValueData
	)

	if ($InstalledCheckRegKey -and $InstalledCheckRegValueName -and $InstalledCheckRegValueData)
	{
		$installValue = $null

		#if 64bit OS, check 64bit registry view first
		if ((Get-WmiObject -Class Win32_OperatingSystem -ComputerName "localhost" -ea 0).OSArchitecture -eq '64-bit')
		{
			$installValue = Get-RegistryValue -RegistryHive LocalMachine -Key $InstalledCheckRegKey -Value $InstalledCheckRegValueName -RegistryView Registry64
		}

		if($installValue -eq $null)
		{
			$installValue = Get-RegistryValue -RegistryHive LocalMachine -Key $InstalledCheckRegKey -Value $InstalledCheckRegValueName -RegistryView Registry32
		}

		if($installValue)
		{
			if($InstalledCheckRegValueData -and $installValue -eq $InstalledCheckRegValueData)
			{
				return $true
			}
		}
	}

	return $false
}

Check-Installation  -ProductVersion "14.0"