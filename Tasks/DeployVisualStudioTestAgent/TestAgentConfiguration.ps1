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
        [System.Management.Automation.PSCredential] $UserCredential        
    )

    Write-Verbose -Message ("Getting existing configuration") -Verbose
    $configOut = InvokeTestAgentConfigExe -Arguments @( "List" ) -Version $TestAgentVersion -UserCredential $UserCredential
    
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
            elseif($line.StartsWith("PersonalAccessTokenUser"))
            {
                $personalAccessTokenUserName = GetConfigValue($line)
            }
            elseif ($line.StartsWith("Capabilities"))
            {
                $capabilities = GetConfigValue($line)
            }
        }
    }

    Write-Verbose -Message ("Existing Configuration : TfsCollection : {0}" -f $tfsCollection) -Verbose
    Write-Verbose -Message ("Existing Configuration : EnvUrl : {0}" -f $envUrl) -Verbose
    Write-Verbose -Message ("Existing Configuration : MachineName : {0}" -f $machineName) -Verbose
    Write-Verbose -Message ("Existing Configuration : Username : {0}" -f $userName) -Verbose
    Write-Verbose -Message ("Existing Configuration : EnableAutoLogon : {0}" -f $enableAutoLogon) -Verbose
    Write-Verbose -Message ("Existing Configuration : DisableScreenSaver : {0}" -f $disableScreenSaver) -Verbose
    Write-Verbose -Message ("Existing Configuration : RunningAsProcess : {0}" -f $runningAsProcess) -Verbose
    Write-Verbose -Message ("Existing Configuration : PersonalAccessTokenUser : {0}" -f $personalAccessTokenUserName) -Verbose
    Write-Verbose -Message ("Existing Configuration : Capabilities : {0}" -f $capabilities) -Verbose

    @{
        UserName = $userName
        TfsCollection = $tfsCollection
        EnableAutoLogon = $enableAutoLogon
        DisableScreenSaver = $disableScreenSaver
        RunningAsProcess = $runningAsProcess
        EnvironmentUrl = $envUrl
        MachineName = $machineName 
        PersonalAccessTokenUser = $personalAccessTokenUserName
        Capabilities = $capabilities
    }
}

function Set-TestAgentConfiguration
{
    param
    (
        [String] $TfsCollection,
        [ValidateSet("Service", "Process")]
        [String] $AsServiceOrProcess,
        [System.Management.Automation.PSCredential] $MachineUserCredential,
        [Bool] $DisableScreenSaver = $true,
        [Bool] $EnableAutoLogon = $false,
        [String] $TestAgentVersion,
        [String] $PersonalAccessToken,
        [String] $EnvironmentUrl,
        [String] $MachineName,
        [String] $Capabilities,
        [System.Management.Automation.PSCredential] $AgentUserCredential
    )

    switch ($AsServiceOrProcess)
    {
        'Service' { $configArgs = @("configureAsService"); $configAsProcess = $false }
        'Process' { $configArgs = @("configureAsProcess"); $configAsProcess = $true }
    }
    
    $configArgs = $configArgs + ("/tfsTeamProjectCollection:{0}" -f $TfsCollection)

    if ($PSBoundParameters.ContainsKey('AgentUserCredential') -and $AgentUserCredential)
    {
        $configArgs = $configArgs + ("/userName:{0}" -f $AgentUserCredential.UserName)
        $configArgs = $configArgs + ("/password:{0}" -f $AgentUserCredential.GetNetworkCredential().Password)
    }

    if ($PSBoundParameters.ContainsKey('MachineUserCredential') -and $MachineUserCredential)
    {
        $configArgs = $configArgs + ("/adminUserName:{0}" -f $MachineUserCredential.UserName)
        $configArgs = $configArgs + ("/adminPassword:{0}" -f $MachineUserCredential.GetNetworkCredential().Password)
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
  
    if ($PSBoundParameters.ContainsKey('DisableScreenSaver'))
    {
        if (-not $configAsProcess)
        {
            throw "DisableScreenSaver option is not valid for configureAsService."
        }

        $yesno = GetBoolAsYesNo($DisableScreenSaver)
        $configArgs = $configArgs + ("/disableScreenSaver:{0}" -f $yesno)
    }
    
    if (-not [string]::IsNullOrWhiteSpace($EnvironmentUrl))
    {
        $configArgs = $configArgs +  ("/dtlEnvUrl:{0}" -f $EnvironmentUrl)
    }

    if (-not [string]::IsNullOrWhiteSpace($PersonalAccessToken))
    {
        $configArgs = $configArgs +  ("/personalAccessToken:{0}" -f $PersonalAccessToken)        
    }

    if (-not [string]::IsNullOrWhiteSpace($MachineName))
    {
        $configArgs = $configArgs +  ("/dtlMachineName:{0}" -f $MachineName)
    }
	if (-not [string]::IsNullOrWhiteSpace($Capabilities))
    {
        $configArgs = $configArgs +  ("/Capabilities:{0}" -f $Capabilities)
    }
    
    $configOut = InvokeTestAgentConfigExe -Arguments $configArgs -Version $TestAgentVersion -UserCredential $MachineUserCredential

    if ($configOut.ExitCode -eq 0 -and $configAsProcess -eq $true)
    {
        Write-Verbose -Message "Trying to start TestAgent process interactively" -Verbose
        InvokeDTAExecHostExe -Version $TestAgentVersion -MachineCredential $MachineUserCredential
    }

    $doReboot = $false
    # 3010 is exit code to indicate a reboot is required
    if ($configOut.ExitCode -eq 3010)
    {
        Write-Verbose -Message "Marking the machine for reboot as exit code 3010 received" -Verbose
        $doReboot = $true
    }
    elseif ($configOut.ExitCode -eq 0)
    {
        if (-not (IsDtaExecutionHostRunning))
        {
            Write-Verbose -Message "Marking the machine for reboot as exit code 0 received and TestAgent is not running" -Verbose
            $doReboot = $true
        }
    }
	
    if ($doReboot)
    {
        Write-Verbose "Reboot required post test agent configuration, returning 3010" -Verbose
        return 3010; # 3010 is exit code will indicate a reboot is required
    }
    else
    {
        return $configOut.ExitCode
    }
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

function LoadDependentDlls
{
	param
	(		
		[string] $TestAgentVersion
	)

	$vsRoot = Locate-TestVersionAndVsRoot($TestAgentVersion)
	$assemblylist = 
            (Join-Path -Path $vsRoot  -ChildPath "TestAgent\Microsoft.TeamFoundation.Client.dll").ToString(),
            (Join-Path -Path $vsRoot  -ChildPath "TestAgent\Microsoft.TeamFoundation.Common.dll").ToString(),
            (Join-Path -Path $vsRoot  -ChildPath "TestAgent\Microsoft.VisualStudio.Services.Common.dll").ToString(),
            (Join-Path -Path $vsRoot  -ChildPath "PrivateAssemblies\Microsoft.VisualStudio.TestService.Common.dll").ToString()

	foreach ($asm in $assemblylist)
	{
            [Reflection.Assembly]::LoadFrom($asm)
	}
}


function ReadCredentials 
{
    param
    (
        [String] $TFSCollectionUrl,
        [String] $TestAgentVersion
    )
	
    LoadDependentDlls($TestAgentVersion) | Out-Null
    $creds = [Microsoft.VisualStudio.TestService.Common.CredentialStoreHelper]::GetStoredCredential($TFSCollectionUrl)       
  
    return $creds                    
}

function CanSkipTestAgentConfiguration
{
    [OutputType([Bool])]
    param
    (
        [String] $TfsCollection,
        [ValidateSet("Service", "Process")]
        [String] $AsServiceOrProcess,
        [System.Management.Automation.PSCredential] $MachineUserCredential,
        [Bool] $DisableScreenSaver,
        [Bool] $EnableAutoLogon,
        [String] $TestAgentVersion,
        [String] $EnvironmentUrl,
        [String] $MachineName,
        [String] $PersonalAccessToken,
        [String] $Capabilities,
        [System.Management.Automation.PSCredential] $AgentUserCredential
    )

    Write-Verbose -Message "Finding whether TestAgent configuration is required" -Verbose
    $existingConfiguration = Get-TestAgentConfiguration -TestAgentVersion $TestAgentVersion -UserCredential $MachineUserCredential

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

    if ($PSBoundParameters.ContainsKey('AgentUserCredential'))
    {
        if ($AgentUserCredential.UserName -like ".\*" -or ( -not ($AgentUserCredential.UserName.Contains("\")) ) )
        {
            # for azure machines user name is either like .\username or username   
            $existingUserName = $existingConfiguration.UserName.split('\')
            $requiredUserName = $AgentUserCredential.UserName.split('\')
            
            if($existingUserName[$existingUserName.Length -1] -ne $requiredUserName[$requiredUserName.Length -1])
            {
	        Write-Verbose -Message ("UserName mismatch. Expected : {0}, Current {1}. Reconfiguration required." -f $existingUserName[$existingUserName.Length -1], $requiredUserName[$requiredUserName.Length -1]) -Verbose
                return $false
            }
        }
        elseif ($AgentUserCredential.UserName -ne $existingConfiguration.UserName)
        {
            Write-Verbose -Message ("UserName mismatch. Expected : {0}, Current {1}. Reconfiguration required." -f $AgentUserCredential.UserName, $existingConfiguration.UserName) -Verbose
            return $false
        }
    }

    if ($PSBoundParameters.ContainsKey('PersonalAccessToken'))
    {
        $creds = ReadCredentials -TFSCollectionUrl $TfsCollection -TestAgentVersion $TestAgentVersion
        if ($creds -eq $null)
        {
	     Write-Verbose -Message "No personal access token found in the credential store" -Verbose
             return $false
        }

        if($creds.Credentials -eq $null)
        {
	     Write-Verbose -Message "No credentials found in stored identity" -Verbose
             return $false
        }
  
        $storedString = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($creds.Credentials.SecurePassword))
        if ($storedString -cne $PersonalAccessToken)
        {
            Write-Verbose -Message "Stored Personal Access Token doesn't match with supplied value" -Verbose
            return $false
        }
    }

    if ($PSBoundParameters.ContainsKey('Capabilities'))
    {
        #todo: should not do String match but rather break string based on delimiters and compare individual strings
        #but as of now We have only one capability so it is fine
        if ($Capabilities -ne $existingConfiguration.Capabilities)
        {
            Write-Verbose -Message ("Capabilities mismatch. Expected : {0}, Current {1}. Reconfiguration required." -f $Capabilities, $existingConfiguration.Capabilities) -Verbose
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

function InvokeDTAExecHostExe([string] $Version, [System.Management.Automation.PSCredential] $MachineCredential)
{
    if(IsDtaExecutionHostRunning)
    {
        Write-Verbose -Message "Killing any existing instances" -Verbose
        Stop-Process -processname "DTAExecutionHost"
    }

    $ExeName = "DTAExecutionHost.exe"
    $vsRoot = Locate-TestVersionAndVsRoot($Version)
    if ([string]::IsNullOrWhiteSpace($vsRoot))
    {
        throw "Could not locate TestAgent installation directory for `$Version=$Version. Ensure that TestAgent is installed."
    }
    $exePath = Join-Path -Path $vsRoot -ChildPath $ExeName
    $exePath = "'" + $exePath + "'"

    $session = New-PSSession -ComputerName . -Credential $MachineCredential
    Invoke-Command -Session $session -ErrorAction Continue -ErrorVariable err -OutVariable out -scriptBlock { schtasks.exe /create /TN:DTAConfig /TR:$args /F /RL:HIGHEST /SD:01/01/2050 /SC:ONCE /ST:00:00 ; schtasks.exe /run /TN:DTAConfig } -ArgumentList $exePath

    Write-Verbose ("Error : {0} " -f ($err | out-string)) -Verbose
    Write-Verbose ("Output : {0} " -f ($out | out-string)) -Verbose

}


function InvokeTestAgentConfigExe([string[]] $Arguments, [string] $Version, [System.Management.Automation.PSCredential] $UserCredential)
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
        [System.Management.Automation.PSCredential] $MachineUserCredential,
        [Bool] $DisableScreenSaver = $false,
        [Bool] $EnableAutoLogon = $false,
        [String] $TestAgentVersion = "14.0",
        [String] $EnvironmentUrl,
        [String] $PersonalAccessToken,
        [String] $MachineName,
        [String] $Capabilities,
        [System.Management.Automation.PSCredential] $AgentUserCredential
    )

    EnableTracing -TestAgentVersion $TestAgentVersion | Out-Null

    if ($AsServiceOrProcess -eq "Service")
    {
        $ret = Set-TestAgentConfiguration -TfsCollection $TfsCollection -AsServiceOrProcess $AsServiceOrProcess -MachineUserCredential $MachineUserCredential -TestAgentVersion $TestAgentVersion -EnvironmentUrl $EnvironmentUrl -PersonalAccessToken $PersonalAccessToken -MachineName $MachineName -Capabilities $Capabilities -AgentUserCredential $AgentUserCredential
    }
    else
    {
        $ret = Set-TestAgentConfiguration -TfsCollection $TfsCollection -AsServiceOrProcess $AsServiceOrProcess -MachineUserCredential $MachineUserCredential -DisableScreenSaver $DisableScreenSaver -EnableAutoLogon $EnableAutoLogon -TestAgentVersion $TestAgentVersion -EnvironmentUrl $EnvironmentUrl -PersonalAccessToken $PersonalAccessToken -MachineName $MachineName -Capabilities $Capabilities -AgentUserCredential $AgentUserCredential
    }

    $retCode = -1
    if ($ret.Count -gt 0)
    {
        $retCode = $ret[$ret.Count - 1]
    }

    Write-Verbose -Message ("Return code received : {0}" -f $retCode) -Verbose

    if ($retCode -eq 0)
    {
        Write-Verbose -Message ("TestAgent Configured Successfully") -Verbose
    }
    elseif($retCode -eq 3010)
    {
        Write-Verbose -Message ("TestAgent configuration requested for reboot") -Verbose
    }
    else
    {
        throw ("TestAgent Configuration failed with exit code {0}. Error code : {1}" -f $LASTEXITCODE, $retCode)
    }

    return $ret;
}

$disableScreenSaver = [Boolean] $disableScreenSaver
$enableAutoLogon = [Boolean] $enableAutoLogon

$machineCredential = New-Object System.Management.Automation.PSCredential -ArgumentList $userName, (ConvertTo-SecureString -String $password -AsPlainText -Force)
$agentCredential = New-Object System.Management.Automation.PSCredential -ArgumentList $testAgentConfigUserName, (ConvertTo-SecureString -String $testAgentConfigPassword -AsPlainText -Force)

$ret = CanSkipTestAgentConfiguration -TfsCollection $tfsCollectionUrl -AsServiceOrProcess $asServiceOrProcess -EnvironmentUrl $environmentUrl -MachineName $machineName -MachineUserCredential $machineCredential -DisableScreenSaver $disableScreenSaver -EnableAutoLogon $enableAutoLogon -PersonalAccessToken $PersonalAccessToken -Capabilities $capabilities -AgentUserCredential $agentCredential

if ($ret -eq $false)
{
    $returnCode = ConfigureTestAgent -TfsCollection $tfsCollectionUrl -AsServiceOrProcess $asServiceOrProcess -EnvironmentUrl $environmentUrl -MachineName $machineName -MachineUserCredential $machineCredential -DisableScreenSaver $disableScreenSaver -EnableAutoLogon $enableAutoLogon -PersonalAccessToken $PersonalAccessToken -Capabilities $capabilities -AgentUserCredential $agentCredential
    return $returnCode;
}