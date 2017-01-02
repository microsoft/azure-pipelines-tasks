function PrepareSku
{
    param
    (
        [String] $SetupPath,
        [String] $LayoutPath
    )

    if(-not (Test-Path -Path $SetupPath)) {
        throw "Test agent source path '{0}' is not accessible to the test machine. Please check if the file exists and that test machine has access to that machine" -f $SetupPath
    }

    $p = New-Object System.Diagnostics.Process
    $Processinfo = New-Object System.Diagnostics.ProcessStartInfo
    $Processinfo.CreateNoWindow = $true
    $Processinfo.RedirectStandardError = $true
    $Processinfo.RedirectStandardOutput = $true
    $Processinfo.WindowStyle = "Hidden"
	$Processinfo.UseShellExecute = $false
    $Processinfo.FileName = "$SetupPath"
    $Processinfo.Arguments = "--layout $LayoutPath --lang en-US"

    $p.StartInfo = $Processinfo
    if($p.Start()) {
		$p.WaitForExit()
		return $p.ExitCode
    }
    
    return -1
}

function Install-Product($SetupPath, $ProductVersion, $Update)
{
	$exitCode = 0
	
	if(-not (Test-Path $SetupPath)){
        Write-Verbose "Test Agent path is invalid. Skipping the installation"
        return 1801
    }

	if($ProductVersion -eq "15.0") {
		Write-Verbose "Preparing the Test platform SKU"

		$LayoutPath = Join-Path $env:SystemDrive TestAgent2017Setup
		$retCode = PrepareSku -SetupPath $SetupPath -LayoutPath $LayoutPath

		if($retCode -ne 0) {
			throw "Failed to prepare the Test platfrom SKU $retCode"	
		}

		Write-Verbose "Completed preparing the Test platform SKU"	
		$SetupPath = Join-Path $LayoutPath $(Split-Path $SetupPath -Leaf)
	}

	$versionToInstall = ((Get-Item $SetupPath).VersionInfo.ProductVersion) 
	$versionInstalled = Get-TestAgentInstalledVersion -ProductVersion $ProductVersion # Get installed test agent version as per user requested version

	if($versionToInstall -ne $null)	{
		$versionToInstall = $versionToInstall.SubString(0, $versionToInstall.LastIndexOf('.'))
	}

	Write-Verbose "Installed Test Agent version: $versionInstalled"
	Write-Verbose "Requested Test Agent version: $versionToInstall"

	if([version]$versionInstalled -gt ([version]"0.0") -and $Update -ieq "false") {
		# Test Agent installed with major version matching. No update requested
		Write-Verbose -Message ("Test Agent already exists") -verbose
		return $exitCode
	}
	if([version]$versionInstalled -gt ([version]"0.0") -and [version]$versionInstalled -le [version]$versionToInstall)	{
		# Already upto date. Ignore Update flag
		Write-Verbose -Message ("Test Agent is already upto date") -verbose 
		return $exitCode
	} 
	
	if([version]$versionInstalled -eq ([version]"0.0")) {
		# Test Agent is not installed with major version matching. Any other installations are ignored
		Write-Verbose -Message ("Test Agent will be installed") -verbose
	}
	if([version]$versionInstalled -gt ([version]"0.0") -and [version]$versionInstalled -lt [version]$versionToInstall -and $Update -ieq "true")	{
		Write-Verbose -Message ("Test Agent will be updated from: {0} to: {1}" -f $versionInstalled, $versionToInstall) -verbose 
	} 

	try
	{
		if($ProductVersion -eq "15.0") {
			$tpPath = Join-Path $env:SystemDrive TestAgent2017
			$argumentsarr = @("--noRestart","--quiet","--installPath $tpPath")
		} else {
			$argumentsarr = @("/Quiet","/NoRestart")
		}

		# Invoke the TA installation
		Write-Verbose -Message ("Invoking the command {0} with arguments {1}" -f $SetupPath, $Arguments) -verbose
		$retCode = Invoke-Command -ScriptBlock { cmd.exe /c $args[0] $args[1]; $LASTEXITCODE } -ArgumentList $SetupPath,$argumentsarr -ErrorAction Stop
		if($retCode -is [System.Array]) {
			$exitCode = $retCode[$retCode.Length-1]
		} else {
			$exitCode = $retCode
		}
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
				Remove-Item $testAgentFile -force | Out-Null
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

	if($exitCode -eq -2147205120)
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
	
	return $exitCode
}

return Install-Product -SetupPath $setupPath -ProductVersion $productVersion -Update $update