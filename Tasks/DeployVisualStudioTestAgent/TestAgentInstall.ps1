function Install-Product($SetupPath, $UserName, $Password, $ProductVersion, $Arguments)
{
	$exitCode = 0
	# Locate the Installed Test Agent
	$testAgentDetails = Locate-TestAgent($ProductVersion)
	
	# If test agent is already installed - probe for update criteria
	if($testAgentDetails -and $testAgentDetails.Path)
	{	
		$agentPath = $testAgentDetails.Path
		$versionToInstall = ((Get-Item $SetupPath).VersionInfo.FileVersion)
		$versionInstalled = (Get-ChildItem $agentPath).GetValue('version')

		Write-Verbose -Message ("Test Agent versionInstalled: $versionInstalled versionToInstall: $versionToInstall") -verbose
		if($versionToInstall -and $versionInstalled -and ($versionInstalled -ge $versionToInstall))
		{
			Write-Verbose -Message ("Test Agent already exists") -verbose
			return $exitCode;
		}

		Write-Verbose -Message ("Installing/Updating Test Agent.") -verbose
	}

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
				throw ("The return code {0} was not expected during installation of Test Agent. Check the installation logs for more details." -f $exitCode.ToString())
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
			Write-Verbose -Verbose "Error occurred while retrying the Test Agent installation"
			throw ("The return code {0} was not expected during installation of Test Agent. Check the installation logs for more details." -f $exitCode.ToString())
		}
	}

	if($exitCode -eq 2147205120)
	{
		# pending windows update.
		throw ("Pending windows update. The return code {0} was not expected during installation of Test Agent. Install windows update and try again." -f $exitCode.ToString())
	}

	if(-not ($exitCode -eq 0 -or $exitCode -eq 3010 -or $exitCode -eq 3015 -or $exitCode -eq 1641))
	{
		throw ("The return code {0} was not expected during installation of Test Agent. Check the installation logs for more details." -f $exitCode.ToString())
	}

	if($exitCode -eq 3010 -or $exitCode -eq 3015 -or $exitCode -eq 1641)
	{
		# Return the required reboot code 3010
		Write-Verbose "Reboot required post test agent installation , return 3010" -Verbose
		return 3010;
	}

	# Verify the TA registry entry
	$isProductExists = Locate-TestAgent

	if($isProductExists)
	{
		Write-Verbose "Test Agent installed successfully" -Verbose                        
	}
	else
	{
		throw "Look up in registry failed. Test agent failed to install."
	}
	
	return $exitCode
}

return Install-Product -SetupPath $setupPath -UserName $userName -Password $password -ProductVersion "14.0" -Arguments "/Quiet /NoRestart"