function Install-Product($SetupPath, $UserName, $Password, $ProductVersion, $Arguments)
{
	$InstalledCheckRegKey = ("SOFTWARE\Microsoft\DevDiv\vstf\Servicing\{0}\testagentcore" -f $ProductVersion)
	$InstalledCheckRegValueName = "Install"
	$InstalledCheckRegValueData = "1"

	# Check if testagent is present on the machine
	$isProductExists = Get-ProductEntry -InstalledCheckRegKey $InstalledCheckRegKey -InstalledCheckRegValueName $InstalledCheckRegValueName -InstalledCheckRegValueData $InstalledCheckRegValueData
	$testAgentFileExists = Test-Path "$env:SystemDrive\TestAgent\testagent"

	if ($testAgentFileExists -and $isProductExists)
	{
		Write-Verbose -Message ("Test agent already installed.") -verbose
		return
	}

	Write-Verbose -Message ("Installing test agent.") -verbose

	$creds = New-Object System.Management.Automation.PSCredential -ArgumentList $UserName, (ConvertTo-SecureString -String $Password -AsPlainText -Force)

	# Invoke the TA installation
	Write-Verbose -Message ("Invoking the command {0} with arguments {1}" -f $SetupPath, $Arguments) -verbose

	try
	{
		$argumentsarr = $Arguments -split " "
		$exitCode = Invoke-Command -ScriptBlock { cmd.exe /c $args[0] $args[1]; $LASTEXITCODE } -ArgumentList $SetupPath,$argumentsarr -ComputerName . -Credential $creds -ErrorAction Stop
	}
	catch
	{
		Write-Warning -Verbose "Caught exception while installing Test Agent"
		throw $_.Exception
	}

	if(-not ($exitCode -eq 0 -or $exitCode -eq 3010 -or $exitCode -eq 3015 -or $exitCode -eq 1641))
	{
		throw ("The return code {0} was not expected during installation of Test Agent. Please check the installation logs for more details." -f $exitCode.ToString())
	}

	if($exitCode -eq 3010 -or $exitCode -eq 3010 -or $exitCode -eq 3015 -or $exitCode -eq 1641)
	{
		# check if the key is not already present. Else set the key
		if(-not ((Get-ItemProperty 'hklm:\SYSTEM\CurrentControlSet\Control\Session Manager\').PendingFileRenameOperations.Length -gt 0))
		{
			# todo: Check with Pavan if this is ok
			Write-Verbose -Message "Reboot key does not exist. Adding it." -verbose
			Set-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager" -Name "PendingFileRenameOperations" -Value true -EA Ignore
		}
	}

	# Verify the TA registry entry
	$isProductExists = Get-ProductEntry -InstalledCheckRegKey $InstalledCheckRegKey -InstalledCheckRegValueName $InstalledCheckRegValueName -InstalledCheckRegValueData $InstalledCheckRegValueData

	if($isProductExists)
	{
		Write-Verbose "Test Agent installed successfully" -Verbose
		#creating testagent file to indicate testagent installed successfully
		New-Item -Path "$env:SystemDrive\TestAgent\testagent" -type File
	}
	else
	{
		throw "Look up in registry failed. Test agent failed to install."
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

Install-Product -SetupPath $setupPath -UserName $userName -Password $password -ProductVersion "14.0" -Arguments "/Quiet /NoRestart"