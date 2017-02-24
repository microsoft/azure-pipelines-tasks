function Check-Installation($ProductVersion, $VersionToInstall)
{
    $InstalledCheckRegKey = ("SOFTWARE\Microsoft\DevDiv\vstf\Servicing\{0}\testagentcore" -f $ProductVersion)
	$InstalledCheckRegValueName = "Install"
	$InstalledCheckRegValueData = "1"

	$isProductExists = $false

	$installValue = Get-ProductEntry -InstalledCheckRegKey $InstalledCheckRegKey -InstalledCheckRegValueName $InstalledCheckRegValueName

	if($installValue -and ($installValue -eq $InstalledCheckRegValueData))
	{
		$isProductExists = $true
	}
	
	if($isProductExists)
	{
		$versionInstalled = (Get-ProductEntry -InstalledCheckRegKey $InstalledCheckRegKey -InstalledCheckRegValueName "Version")
		if(!([System.String]::IsNullOrEmpty($VersionToInstall)))
		{
			$VersionToInstall = $VersionToInstall.SubString(0, $VersionToInstall.LastIndexOf('.'))

			Write-Verbose -Message ("Version already installed: " + $VersionInstalled) -verbose
			Write-Verbose -Message ("Version to be installed: " + $VersionToInstall) -verbose
		}
	}

	if($isProductExists)
	{
		if(!([System.String]::IsNullOrEmpty($VersionToInstall)))
		{
			if(($versionInstalled -ne $null) -and ([version]$VersionToInstall -le [version]$versionInstalled))
			{
				Write-Verbose -Message ("Test Agent already exists") -verbose
			}
			else 
			{
				Write-Verbose -Message ("Test Agent does not exists.") -verbose
			}
		}
		else
		{
			Write-Verbose -Message ("Test Agent already exists") -verbose
		}		
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
		[string] $InstalledCheckRegValueName
	)

	if ($InstalledCheckRegKey -and $InstalledCheckRegValueName)
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

		return $installValue
	}

	return $null
}

Check-Installation  -ProductVersion "14.0" -VersionToInstall $versionToInstall