function Check-AgentCompat($ProductVersion)
{
    try
    {
        $avlVersion = Locate-TestVersion
        if($avlVersion)
        {
          $ProductVersion = $avlVersion
        }
        Write-Verbose "VS Agent version $version" -verbose
	
        $InstalledVersionRegValueName = "Version"
        $InstalledVersionRegKey = ("SOFTWARE\Microsoft\DevDiv\vstf\Servicing\{0}\testExecCore" -f $ProductVersion)

        if ($InstalledVersionRegKey -and $InstalledVersionRegValueName)
	    {
          $versionString = $null

          #if 64bit OS, check 64bit registry view first
          if ((Get-WmiObject -Class Win32_OperatingSystem -ComputerName "localhost" -ea 0).OSArchitecture -eq '64-bit')
          {
            $versionString = Get-RegistryValue -RegistryHive LocalMachine -Key $InstalledVersionRegKey -Value $InstalledVersionRegValueName -RegistryView Registry64
          }
          
          if($versionString -eq $null)
          {          
            $versionString = Get-RegistryValue -RegistryHive LocalMachine -Key $InstalledVersionRegKey -Value $InstalledVersionRegValueName -RegistryView Registry32
          }

          if($versionString)
          {
            $versionArray = $versionString.split('.')            

            $minorVersion=$null
            $majorVersion=$null
            if([Int]::TryParse($versionArray[0], [ref]$majorVersion) -and [Int]::TryParse($versionArray[2], [ref]$minorVersion))
            {            
              if($majorVersion -eq 14 -and $minorVersion -le 24712)
              {
                # Comparing with version of Agent last shipped that does not contain the changes.
                Write-Error "The test agent being used does not support the feature to execute tests by selecting Test Suite(s). Please use a newer version." -Verbose
              }
            }
          }
        }
    }
	catch
	{
		#Ignore
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

	$baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey($RegistryHive, $RegistryView)
	$subKey = $baseKey.OpenSubKey($Key)

	if($subKey -ne $null)
	{
		return $subKey.GetValue($Value)
	}
	return $null
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

Check-AgentCompat -ProductVersion "14.0" 
