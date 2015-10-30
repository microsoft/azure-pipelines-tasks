function Install-Product($SetupPath, $UserName, $Password, $ProductVersion, $Arguments)
{
	$InstalledCheckRegKey = ("SOFTWARE\Microsoft\DevDiv\vstf\Servicing\{0}\testagentcore" -f $ProductVersion)
	$InstalledCheckRegValueName = "Install"
	$InstalledCheckRegValueData = "1"
                
	$isProductExists = Get-ProductEntry -InstalledCheckRegKey $InstalledCheckRegKey -InstalledCheckRegValueName $InstalledCheckRegValueName         

	$versionToInstall = ((Get-Item $SetupPath).VersionInfo.FileVersion) 
	$versionInstalled = (Get-ProductEntry -InstalledCheckRegKey $InstalledCheckRegKey -InstalledCheckRegValueName "version")

	if($versionToInstall -ne $null)
	{
		$versionToInstall = $versionToInstall.SubString(0, $versionToInstall.LastIndexOf('.'))
	}

	$exitCode = 0
	
	if(($isProductExists -eq $InstalledCheckRegValueData) -and ($versionToInstall -ne $null) -and ($versionInstalled -ne $null) -and ([version]$versionToInstall -le [version]$versionInstalled))
	{
		Write-Verbose -Message ("Test Agent already exists") -verbose
	}
	else
	{
		Write-Verbose -Message ("Installing/Updating Test Agent.") -verbose

		# Invoke the TA installation
		Write-Verbose -Message ("Invoking the command {0} with arguments {1}" -f $SetupPath, $Arguments) -verbose

		try
		{
			$argumentsarr = $Arguments -split " "
			$exitCode = Invoke-Command -ScriptBlock { cmd.exe /c $args[0] $args[1]; $LASTEXITCODE } -ArgumentList $SetupPath,$argumentsarr -ErrorAction Stop
		}
		catch
		{
			Write-Verbose -Verbose "Caught exception while installing Test Agent"
			throw $_.Exception
		}
                 
		if($exitCode -eq -2147185721)
		{
			# pending restart .
			try
			{
				$testAgentFile = "$env:SystemDrive\TestAgent\testagent.txt"
				$testAgentFileExists = Test-Path $testAgentFile
				if($testAgentFileExists)
				{
					# delete the file which indicated that test agent installation failed.
					remove-item $testAgentFile -force | Out-Null
					# we have retried once .Now fail with appropriate message
					Write-Verbose -Verbose "Retried to install Test Agent"
					throw (Get-LocalizedString -Key "The return code {0} was not expected during installation of Test Agent. Check the installation logs for more details." -f $exitCode.ToString())
				}
				else
				{
					#creating testagent file to indicate testagent installation failed.
					New-Item -Path $testAgentFile -type File | Out-Null
					Write-Verbose -Message ("Installation of Test Agent failed with Error code {0}. Retrying once by rebooting machine" -f $exitCode.ToString()) -Verbose
					return 3010;
				}
			}
			catch
			{
				Write-Verbose -Verbose "Error occured while retrying the Test Agent installation"
				throw (Get-LocalizedString -Key "The return code {0} was not expected during installation of Test Agent. Check the installation logs for more details." -f $exitCode.ToString())
			}
		}

		if($exitCode -eq 2147205120)
		{
			# pending windows update.
			throw (Get-LocalizedString -Key "Pending windows update. The return code {0} was not expected during installation of Test Agent. Install windows update and try again." -f $exitCode.ToString())
		}

		if(-not ($exitCode -eq 0 -or $exitCode -eq 3010 -or $exitCode -eq 3015 -or $exitCode -eq 1641))
		{
			throw (Get-LocalizedString -Key "The return code {0} was not expected during installation of Test Agent. Check the installation logs for more details." -f $exitCode.ToString())
		}

		if($exitCode -eq 3010 -or $exitCode -eq 3015 -or $exitCode -eq 1641)
		{
		    # Return the required reboot code 3010
			Write-Verbose "Reboot required post test agent installation , return 3010" -Verbose
			return 3010;
		}

		# Verify the TA registry entry
		$isProductExists = Get-ProductEntry -InstalledCheckRegKey $InstalledCheckRegKey -InstalledCheckRegValueName $InstalledCheckRegValueName

		if($isProductExists -eq $InstalledCheckRegValueData)
		{
			Write-Verbose "Test Agent installed successfully" -Verbose                        
   		}
		else
		{
			throw (Get-LocalizedString -Key "Look up in registry failed. Test agent failed to install.")
		}
	}
	
	return $exitCode
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

        $installValue = $null

	if ($InstalledCheckRegKey -and $InstalledCheckRegValueName -and $InstalledCheckRegValueData)
	{
		#if 64bit OS, check 64bit registry view first
		if ((Get-WmiObject -Class Win32_OperatingSystem -ComputerName "localhost" -ea 0).OSArchitecture -eq '64-bit')
		{
			$installValue = Get-RegistryValue -RegistryHive LocalMachine -Key $InstalledCheckRegKey -Value $InstalledCheckRegValueName -RegistryView Registry64
		}

		if($installValue -eq $null)
		{
			$installValue = Get-RegistryValue -RegistryHive LocalMachine -Key $InstalledCheckRegKey -Value $InstalledCheckRegValueName -RegistryView Registry32
		}
	}

	return $installValue
}

return Install-Product -SetupPath $setupPath -UserName $userName -Password $password -ProductVersion "14.0" -Arguments "/Quiet /NoRestart"