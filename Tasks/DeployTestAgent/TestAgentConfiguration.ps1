function Locate-TestVersionAndVsRoot([string] $Version)
{
    if ([string]::IsNullOrWhiteSpace($Version))
    {
        #Find the latest version
        $regPath = "HKLM:\SOFTWARE\Microsoft\DevDiv\vstf\Servicing"
        if (-not (Test-Path $regPath))
        {
            $regPath = "HKLM:\SOFTWARE\Wow6432Node\Microsoft\DevDiv\vstf\Servicing"
        }
        $Version = Get-Item $regPath | %{$_.GetSubKeyNames()} | Sort-Object -Descending | Select-Object -First 1
        if ([string]::IsNullOrWhiteSpace($Version))
        {
            return $null
        }
    }

    # Lookup the install location
    $installRegPath = ("SOFTWARE\Microsoft\VisualStudio\{0}\EnterpriseTools\QualityTools" -f $Version)

    $installRoot = Get-RegistryValueIgnoreError CurrentUser "$installRegPath" "InstallDir" Registry32
    if (-not $installRoot)
    {
        $installRoot = Get-RegistryValueIgnoreError CurrentUser "$installRegPath" "InstallDir" Registry64
    }

    if (-not $installRoot)
    {
        $installRoot = Get-RegistryValueIgnoreError LocalMachine "$installRegPath" "InstallDir" Registry32
        if (-not $installRoot)
        {
            $installRoot = Get-RegistryValueIgnoreError LocalMachine "$installRegPath" "InstallDir" Registry64
        }
    }

    if (-not $installRoot)
    {
        # We still got nothing
        throw "Unable to find TestAgent installation path"
    }
    return $installRoot
}

function Get-RegistryValueIgnoreError
{
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
        $subKey =  $baseKey.OpenSubKey($Key)
        if($subKey -ne $null)
        {
            return $subKey.GetValue($Value)
        }
    }
    catch
    {
        #ignore
    }
    return $null
}

function Get-TestAgentConfiguration
{
    param
    (
        [String] $TestAgentVersion,	
        [PSCredential] $UserCredential,
        [String] $AlternateCredUserName,
        [String] $AlternateCredPassword
    )

    Write-Verbose -Message ("Getting existing configuration") -Verbose
    $configOut = InvokeTestAgentConfigExe -Arguments @( "List" ) -Version $TestAgentVersion -UserCredential $UserCredential -AlternateCredUserName $AlternateCredUserName -AlternateCredPassword $AlternateCredPassword
    
    if (-not $configOut.CommandOutput)
    {
        Write-Verbose -Message ("No output received from TestAgentConfig.exe, returning empty test agent configuration") -Verbose
        $enableAutoLogon = $false
        $disableScreenSaver = $false
        $isUserProcess = $false
    }
    else
    {
        Write-Verbose "Parsing configuration output" -Verbose

        # Use -Quiet for simple true/false output
        $runningAsProcess = ($configOut.CommandOutput | Select-String -Quiet -SimpleMatch "This test agent is running as an interactive process.") -eq $True
        $outputLines = $configOut.CommandOutput.Split("`n`r")

        foreach ($line in $outputLines)
        {
            if (-not $line)
            {
                continue
            }
            if ($line.StartsWith("UserName"))
            {
                $userName = GetConfigValue($line)
            }
            elseif ($line.StartsWith("EnableAutoLogon"))
            {
                $enableAutoLogon = [bool](GetConfigValue($line) -eq "Yes")
            }
            elseif ($line.StartsWith("DisableScreenSaver"))
            {
                $disableScreenSaver = [bool](GetConfigValue($line) -eq "Yes")
            }
            elseif ($line.StartsWith("Tfs"))
            {
                $tfsCollection = GetConfigValue($line)
            }
            elseif ($line.StartsWith("DtlEnvUrl"))
            {
                $envUrl = GetConfigValue($line)
            }
            elseif ($line.StartsWith("DtlMachineName"))
            {
                $machineName = GetConfigValue($line)
            }
            elseif ($line.StartsWith("AlternativeCredUserName"))
            {
                $alternateCredUserName = GetConfigValue($line)
            }
        }
    }

    Write-Verbose -Message ("Existing Configuration : TfsCollection : {0}" -f $tfsCollection) -Verbose
    Write-Verbose -Message ("Existing Configuration : EnvUrl : {0}" -f $envUrl) -Verbose
    Write-Verbose -Message ("Existing Configuration : MachineName : {0}" -f $machineName) -Verbose
    Write-Verbose -Message ("Existing Configuration : Username : {0}" -f $userName) -Verbose
    Write-Verbose -Message ("Existing Configuration : AlternateCredUserName : {0}" -f $alternateCredUserName) -Verbose
    Write-Verbose -Message ("Existing Configuration : EnableAutoLogon : {0}" -f $enableAutoLogon) -Verbose
    Write-Verbose -Message ("Existing Configuration : DisableScreenSaver : {0}" -f $disableScreenSaver) -Verbose
    Write-Verbose -Message ("Existing Configuration : RunningAsProcess : {0}" -f $runningAsProcess) -Verbose

    @{
        UserName = $userName
        TfsCollection = $tfsCollection
        EnableAutoLogon = $enableAutoLogon
        DisableScreenSaver = $disableScreenSaver
        RunningAsProcess = $runningAsProcess
        EnvironmentUrl = $envUrl
        MachineName = $machineName 
        AlternateCredUserName = $alternateCredUserName
    }
}

function Set-TestAgentConfiguration
{
    param
    (
        [String] $TfsCollection,
        [ValidateSet("Service", "Process")]
        [String] $AsServiceOrProcess,
        [PSCredential] $UserCredential,
        [Bool] $DisableScreenSaver = $true,
        [Bool] $EnableAutoLogon = $false,
        [String] $TestAgentVersion,
        [String] $EnvironmentUrl,
        [String] $AlternateCredUserName,
        [String] $AlternateCredPassword,
        [String] $MachineName
    )

    switch ($AsServiceOrProcess)
    {
        'Service' { $configArgs = @("configureAsService"); $configAsProcess = $false }
        'Process' { $configArgs = @("configureAsProcess"); $configAsProcess = $true }
    }
    
    $configArgs = $configArgs + ("/tfsTeamProjectCollection:{0}" -f $TfsCollection)

    if ($PSBoundParameters.ContainsKey('UserCredential') -and $UserCredential)
    {
        $configArgs = $configArgs + ("/userName:{0}" -f $UserCredential.UserName)
        $configArgs = $configArgs + ("/password:{0}" -f $UserCredential.GetNetworkCredential().Password)
    }

    if ($PSBoundParameters.ContainsKey('EnableAutoLogon'))
    {
        if (-not $configAsProcess)
        {
            throw "EnableAutoLogon option is not valid for configureAsService."
        }
        $yesno = GetBoolAsYesNo($EnableAutoLogon)
        $configArgs = $configArgs + ("/enableAutoLogon:{0}" -f $yesno)
    }
    
    if (-not [string]::IsNullOrWhiteSpace($EnvironmentUrl))
    {
        $configArgs = $configArgs +  ("/dtlEnvUrl:{0}" -f $EnvironmentUrl)
    }

    if (-not [string]::IsNullOrWhiteSpace($AlternateCredUserName) -and -not [string]::IsNullOrWhiteSpace($AlternateCredPassword))
    {
        $configArgs = $configArgs +  ("/alternativeCredUserName:{0}" -f $AlternateCredUserName)
        $configArgs = $configArgs +  ("/alternativeCredPassword:{0}" -f $AlternateCredPassword)
    }

    if (-not [string]::IsNullOrWhiteSpace($MachineName))
    {
        $configArgs = $configArgs +  ("/dtlMachineName:{0}" -f $MachineName)
    }

    $configOut = InvokeTestAgentConfigExe -Arguments $configArgs -Version $TestAgentVersion -UserCredential $UserCredential -AlternateCredUserName $AlternateCredUserName -AlternateCredPassword $AlternateCredPassword

    # 3010 is exit code to indicate a reboot is required
    if ($configOut.ExitCode -eq 3010)
    {
		Write-Verbose -Message "Marking the machine for reboot as exit code 3010 received" -Verbose
		SetRebootKey;

        return 0
    }
	# Todo<Bug 227810>. This restart should not be required if DSC doesnt throw a requirement of restart at every step.
	elseif ($configOut.ExitCode -eq 0) 
    {
		if(-not (IsDtaExecutionHostRunning))
		{
			Write-Verbose -Message "Marking the machine for reboot as exit code 0 received and TestAgent is not running" -Verbose
			SetRebootKey;
		}
		# In On Prem scenarios exit code is always 0, because agent is configured as logged in user. But because DSC launches the process as non interactive process
		# we need a restart.
		elseif ($configAsProcess -and [string]::IsNullOrWhiteSpace($AlternateCredUserName))
		{
			Write-Verbose -Message "Restarting the machine as error code 0 received and agent is launched as non interactive prcoess." -verbose
			SetRebootKey;
		}
    }
    return $configOut.ExitCode
}

function GetConfigValue([string] $line)
{
    return $line.Substring($line.IndexOf(":") + 1).TrimStart().TrimEnd()
}

function GetBoolAsYesNo([Bool] $boolValue)
{
    if ($boolValue)
    {
        return "Yes"
    }
    return "No"
}

function Test-IsAdmin
{
    $wid = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $prp = New-Object System.Security.Principal.WindowsPrincipal($wid)
    $adm = [System.Security.Principal.WindowsBuiltInRole]::Administrator
    return $prp.IsInRole($adm)
}

function IsDtaExecutionHostRunning
{
    if (Get-Process "DTAExecutionHost" -ErrorAction SilentlyContinue)
    {
        Write-Verbose -Message "DTAExecutionHost.exe is running" -Verbose
        return $true
    }
    Write-Verbose -Message "DTAExecutionHost.exe is not running" -Verbose
    return $false
}

function CanSkipTestAgentConfiguration
{
    [OutputType([Bool])]
    param
    (
        [String] $TfsCollection,
        [ValidateSet("Service", "Process")]
        [String] $AsServiceOrProcess,
        [PSCredential] $UserCredential,
        [Bool] $DisableScreenSaver,
        [Bool] $EnableAutoLogon,
        [String] $TestAgentVersion,
        [String] $EnvironmentUrl,
        [String] $AlternateCredUserName,
        [String] $AlternateCredPassword,
        [String] $MachineName
    )

    Write-Verbose -Message "Finding whether TestAgent configuration is required" -Verbose
    $existingConfiguration = Get-TestAgentConfiguration -TestAgentVersion $TestAgentVersion -UserCredential $UserCredential -AlternateCredUserName $AlternateCredUserName -AlternateCredPassword $AlternateCredPassword

    if (-not (IsDtaExecutionHostRunning)) 
    {
        Write-Verbose -Message ("TestAgent is not running, Configuration required") -Verbose
        return $false
    }

    if ($PSBoundParameters.ContainsKey('AsServiceOrProcess'))
    {
        if ($AsServiceOrProcess -eq "Process")
        {
            if (-not $existingConfiguration.RunningAsProcess)
            {
                Write-Verbose -Message ("RunningAsService mismatch. Expected : RunningAsProcess, Current : RunningAsService. Reconfiguration required.") -Verbose
                return $false
            }
    
            if ($PSBoundParameters.ContainsKey('EnableAutoLogon'))
            {
                if ($EnableAutoLogon -ne $existingConfiguration.EnableAutoLogon)
                {
                    Write-Verbose -Message ("EnableAutoLogon mismatch. Expected : {0}, Current {1}. Reconfiguration required." -f $EnableAutoLogon, $existingConfiguration.EnableAutoLogon) -Verbose
                    return $false
                }
            }

            if ($PSBoundParameters.ContainsKey('DisableScreenSaver'))
            {
                if ($DisableScreenSaver -ne $existingConfiguration.DisableScreenSaver)
                {
                    Write-Verbose -Message ("DisableScreenSaver mismatch. Expected : {0}, Current {1}. Reconfiguration required." -f $DisableScreenSaver, $existingConfiguration.DisableScreenSaver) -Verbose
                    return $false
                }
            }
        }
        elseif ($existingConfiguration.RunningAsProcess)
        {
            Write-Verbose -Message ("RunningAsService mismatch. Expected : RunningAsService, Current : RunningAsProcess. Reconfiguration required.") -Verbose
            return $false
        }
    }

    if ($TfsCollection -ne $existingConfiguration.TfsCollection)
    {
        Write-Verbose -Message ("Tfs Collection Url mismatch. Expected : {0}, Current {1}. Reconfiguration required." -f $TfsCollection, $existingConfiguration.TfsCollection) -Verbose
        return $false
    }

    if ($PSBoundParameters.ContainsKey('EnvironmentUrl'))
    {
        if ($EnvironmentUrl -ne $existingConfiguration.EnvironmentUrl)
        {
            Write-Verbose -Message ("Environment Url mismatch. Expected : {0}, Current {1}. Reconfiguration required." -f $EnvironmentUrl, $existingConfiguration.EnvironmentUrl) -Verbose
            return $false
        }
    }

    if ($PSBoundParameters.ContainsKey('MachineName'))
    {
        if ($MachineName -ne $existingConfiguration.MachineName)
        {
            Write-Verbose -Message ("MachineName mismatch. Expected : {0}, Current {1}. Reconfiguration required." -f $MachineName, $existingConfiguration.MachineName) -Verbose
            return $false
        }
    }

    if ($PSBoundParameters.ContainsKey('AlternateCredUserName'))
    {
        if ($AlternateCredUserName -ne $existingConfiguration.AlternateCredUserName)
        {
            Write-Verbose -Message ("AlternateCredentials UserName mismatch. Expected : {0}, Current {1}. Reconfiguration required." -f $AlternateCredUserName, $existingConfiguration.AlternateCredUserName) -Verbose
            return $false
        }
    }

    if ($PSBoundParameters.ContainsKey('UserCredential'))
    {
        if ($UserCredential.UserName -ne $existingConfiguration.UserName)
        {
            Write-Verbose -Message ("AlternateCredentials UserName mismatch. Expected : {0}, Current {1}. Reconfiguration required." -f $UserCredential.UserName, $existingConfiguration.UserName) -Verbose
            return $false
        }
    }
	
    Write-Verbose -Message ("TestAgent reconfiguration not required.") -Verbose
    return $true
}

function EnableTracing 
{
    param
    (
        [Parameter(Mandatory=$true)]
        [String] $TestAgentVersion
    )

    if ($env:processor_architecture -eq "amd64") 
    {
        $programFilesPath =  ${env:ProgramFiles(x86)} 
    } 
    else 
    { 
        $programFilesPath = ${env:ProgramFiles} 
    }

    $configFilePath = "$programFilesPath\Microsoft Visual Studio " + $TestAgentVersion + "\Common7\Ide"
    $logFilePath = "$env:SystemDrive\DtaLogs"
    $dtaExecutable = "DTAExecutionHost"
    $traceLevel = 4

    # Add listener and modify trace level
    $file = "$configFilePath\" + $dtaExecutable + ".exe.config"
    Write-Verbose -Message ("Trying to open the config file : {0}" -f $file) -Verbose

    [xml]$configFile = Get-Content -Path $file

    # Get XML Document Object from String
    [xml]$listenerToAdd = '
            <listeners>
            <add name="autoListener" 
                type="System.Diagnostics.TextWriterTraceListener" 
                initializeData="{0}\{1}.exe.log" />
            </listeners>' -f $logFilePath, $dtaExecutable

    $exists = $false

    if($configFile.SelectSingleNode("configuration/system.diagnostics/trace/listeners"))
    {
        # Get the target config node and the node which is to migrate if there is already a listeners node
        $configTarget = $configFile.selectSingleNode("configuration/system.diagnostics/trace/listeners")
        $newTraces = $listenerToAdd.selectSingleNode("listeners/add")

        foreach ($node in $configTarget.selectNodes("add")) 
        {
            if(($node.type -eq $newTraces.type) -and ($node.initializeData -eq $newTraces.initializeData))
            {
                $exists = $true
                break
            }
        }
    }
    else
    {
        # Get the target config node and the node which is to migrate if there is no listeners node
        $configTarget = $configFile.selectSingleNode("configuration/system.diagnostics/trace")
        $newTraces = $listenerToAdd.selectSingleNode("listeners")
    }

    if (-not $exists)
    {
        $configTarget.appendChild($configFile.ImportNode($newTraces,$true))
    }

    # Update trace level
    Write-Verbose -Message ("Changing trace level...") -Verbose
    $configFile.selectSingleNode("configuration/system.diagnostics/switches/add") | foreach { if ($_.name -eq 'TestAgentTraceLevel') { $_.value = "$traceLevel" } }
    $configFile.Save("$configFilePath\$dtaExecutable.exe.config")

    # Create folder for DTA Execution host logs
    if (-not (test-path -Path $logFilePath))
    {
        Write-Verbose -Message ("Creating log directory as it does not exist") -Verbose
        New-Item -Path $logFilePath -ItemType directory
    }
	
    Write-Verbose -Message ("Logs will now be stored at : {0}" -f $logFilePath) -Verbose
}

function InvokeTestAgentConfigExe([string[]] $Arguments, [string] $Version, [PSCredential] $UserCredential, [String] $AlternateCredUserName, [String] $AlternateCredPassword)
{
    $ExeName = "TestAgentConfig.exe"
    if (-not (Test-IsAdmin))
    {
        throw "You need to be an Administrator to run this tool."
    }

    $vsRoot = Locate-TestVersionAndVsRoot($Version)
    if ([string]::IsNullOrWhiteSpace($vsRoot))
    {
        throw "Could not locate TestAgent installation directory for `$Version=$Version. Ensure that TestAgent is installed."
    }

    $exePath = Join-Path -Path $vsRoot -ChildPath $ExeName
    if (Test-Path $exePath)
    {
        Write-Verbose -Message "Calling TestAgentConfig.exe with arguments: $Arguments" -Verbose

        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = $exePath
        $pinfo.RedirectStandardError = $true
        $pinfo.RedirectStandardOutput = $true
        $pinfo.UseShellExecute = $false
        $pinfo.Arguments = $Arguments

        $p = New-Object System.Diagnostics.Process
        $p.StartInfo = $pinfo

        $p.Start() | Out-Null
        $p.WaitForExit()

        $stdout = $p.StandardOutput.ReadToEnd()
        $stderr = $p.StandardError.ReadToEnd()

        Write-Verbose -Message ("Stdout : {0}" -f $stdout) -Verbose
        Write-Warning -Message ("Stderr : {0}" -f $stderr)
        Write-Verbose -Message ("Exit code : {0}" -f $p.ExitCode) -Verbose

        $out = @{
                    ExitCode = $p.ExitCode
                    CommandOutput = $stdout
                }
					
        return $out
    }

    throw "Did not find TestAgentConfig.exe at : $exePath. Ensure that TestAgent is installed."
}

function ConfigureTestAgent
{
    param
    (
        [String] $TfsCollection,
        [ValidateSet("Service", "Process")]
        [String] $AsServiceOrProcess,
        [PSCredential] $UserCredential,
        [Bool] $DisableScreenSaver = $false,
        [Bool] $EnableAutoLogon = $false,
        [String] $TestAgentVersion = "14.0",
        [String] $EnvironmentUrl,
        [String] $AlternateCredUserName,
        [String] $AlternateCredPassword,
        [String] $MachineName
    )

    EnableTracing -TestAgentVersion $TestAgentVersion

    $ret = -1
    if ($AsServiceOrProcess -eq "Service")
    {
        $ret = Set-TestAgentConfiguration -TfsCollection $TfsCollection -AsServiceOrProcess $AsServiceOrProcess -UserCredential $UserCredential -TestAgentVersion $TestAgentVersion -EnvironmentUrl $EnvironmentUrl -AlternateCredUserName $AlternateCredUserName -AlternateCredPassword $AlternateCredPassword -MachineName $MachineName
    }
    else
    {
        $ret = Set-TestAgentConfiguration -TfsCollection $TfsCollection -AsServiceOrProcess $AsServiceOrProcess -UserCredential $UserCredential -DisableScreenSaver $DisableScreenSaver -EnableAutoLogon $EnableAutoLogon -TestAgentVersion $TestAgentVersion -EnvironmentUrl $EnvironmentUrl -AlternateCredUserName $AlternateCredUserName -AlternateCredPassword $AlternateCredPassword -MachineName $MachineName 
    }
    
    if ($ret -eq 0)
    {
        Write-Verbose("TestAgent Configured Successfully")
    }
    else
    {
        throw ("TestAgent Configuration failed with exit code {0}" -f $LASTEXITCODE)
    }
}

function SetRebootKey
{
	# check if the key is not already present. Else set the key
	if(-not ((Get-ItemProperty 'hklm:\SYSTEM\CurrentControlSet\Control\Session Manager\').PendingFileRenameOperations.Length -gt 0))
	{
		# todo: Check with Pavan if this is ok
	    Write-Verbose -Message "Reboot key does not exist. Adding it." -verbose
	    Set-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager" -Name "PendingFileRenameOperations" -Value true -EA Ignore
	}
}

$disableScreenSaver = [Boolean] $disableScreenSaver
$enableAutoLogon = [Boolean] $enableAutoLogon

$Credential = New-Object System.Management.Automation.PSCredential -ArgumentList $userName, (ConvertTo-SecureString -String $password -AsPlainText -Force)

$ret = CanSkipTestAgentConfiguration -TfsCollection $tfsCollectionUrl -AsServiceOrProcess $asServiceOrProcess -EnvironmentUrl $environmentUrl -MachineName $machineName -UserCredential $Credential -DisableScreenSaver $disableScreenSaver -EnableAutoLogon $enableAutoLogon -AlternateCredUserName $alternateCredUserName -AlternateCredPassword $alternateCredPassword
if ($ret -eq $false)
{
    ConfigureTestAgent -TfsCollection $tfsCollectionUrl -AsServiceOrProcess $asServiceOrProcess -EnvironmentUrl $environmentUrl -MachineName $machineName -UserCredential $Credential -DisableScreenSaver $disableScreenSaver -EnableAutoLogon $enableAutoLogon -AlternateCredUserName $alternateCredUserName -AlternateCredPassword $alternateCredPassword
}