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
        [System.Management.Automation.PSCredential] $AgentUserCredential,
        [Bool] $keepConnectionAlive
    )

    switch ($AsServiceOrProcess)
    {
        'Service' { $configArgs = @("configureAsService"); $configAsProcess = $false }
        'Process' { $configArgs = @("configureAsProcess"); $configAsProcess = $true }
    }

    $configArgs = $configArgs + ("/tfsTeamProjectCollection:{0}" -f $TfsCollection)

    if ($PSBoundParameters.ContainsKey('AgentUserCredential') -and $AgentUserCredential)
    {
        $configArgs = $configArgs + ("/userName:`"{0}`"" -f $AgentUserCredential.UserName)
        $configArgs = $configArgs + ("/password:`"{0}`""  -f $AgentUserCredential.GetNetworkCredential().Password)
    }

    if ($PSBoundParameters.ContainsKey('MachineUserCredential') -and $MachineUserCredential)
    {
        $configArgs = $configArgs + ("/adminUserName:`"{0}`""  -f $MachineUserCredential.UserName)
        $configArgs = $configArgs + ("/adminPassword:`"{0}`""  -f $MachineUserCredential.GetNetworkCredential().Password)
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
        $configArgs = $configArgs +  ("/dtlEnvUrl:`"{0}`""  -f $EnvironmentUrl)
    }

    if (-not [string]::IsNullOrWhiteSpace($PersonalAccessToken))
    {
        $configArgs = $configArgs +  ("/personalAccessToken:{0}" -f $PersonalAccessToken)
    }

    if (-not [string]::IsNullOrWhiteSpace($MachineName))
    {
        $configArgs = $configArgs +  ("/dtlMachineName:`"{0}`""  -f $MachineName)
    }
    if (-not [string]::IsNullOrWhiteSpace($Capabilities))
    {
        $configArgs = $configArgs +  ("/Capabilities:{0}" -f $Capabilities)
    }

    $configLogFile = Join-Path $env:temp "testagentconfig.log"
    Remove-Item $configLogFile -ErrorAction SilentlyContinue
    $dtaLogFile = Join-Path $env:SystemDrive "DtaLogs" | Join-Path -ChildPath "DTAExecutionHost.exe.log" #filename also present in testagentunconfiguration.ps1
    Remove-Item $dtaLogFile -ErrorAction SilentlyContinue
    
    DeleteDTAAgentExecutionService -ServiceName "DTAAgentExecutionService" | Out-Null

    $configOut = InvokeTestAgentConfigExe -Arguments $configArgs -Version $TestAgentVersion

    if(Test-path -Path $configLogFile) 
    {
        Write-Verbose -Message "=== Starting to print the testagent configuration log file for [$env:COMPUTERNAME] ===" -Verbose
        Get-Content $configLogFile | foreach { Write-Verbose -Message "[$env:COMPUTERNAME] $_" -Verbose }
        Write-Verbose -Message "=== Done printing the testagent configuration log file for [$env:COMPUTERNAME] ===" -Verbose        
    }

    if ($configOut.ExitCode -ne 0 -and $configOut.ExitCode -ne 3010)
    {
        return $configOut.ExitCode
    }

    if ($configAsProcess -eq $false)
    {
        return $configOut.ExitCode
    }

    if (IsDtaExecutionHostRunning)
    {
        Write-Verbose -Message "Stopping already running instances of DTAExecutionHost" -Verbose
        Stop-Process -processname "DTAExecutionHost"
    }

    Write-Verbose -Message "Trying to configure power options so that the console session stays active" -Verbose
    ConfigurePowerOptions | Out-Null

    Write-Verbose -Message "Trying to see if no active desktop session is present" -Verbose
    $isSessionActive = IsAnySessionActive
    if (-not ($isSessionActive))
    {
        Write-Verbose -Message("Value returned {0}" -f $isSessionActive) -Verbose
        Write-Verbose -Message "No desktop session was found active, marking the machine for reboot" -Verbose
        return 3010
    }

    if ($configOut.ExitCode -eq 0)
    {
        Write-Verbose -Message "Trying to start TestAgent process interactively" -Verbose
        InvokeDTAExecHostExe -Version $TestAgentVersion | Out-Null
    }

    if (-not (IsDtaExecutionHostRunning))
    {
        Write-Verbose -Message "DTAExecutionHost was not running interactively, marking the machine for reboot" -Verbose
        return 3010
    }

    return 0
}

function DeleteDTAAgentExecutionService([String] $ServiceName)
{
    if(Get-Service $ServiceName -ErrorAction SilentlyContinue)
    {
        $service = (Get-WmiObject Win32_Service -filter "name='$ServiceName'")
        Write-Verbose -Message("Trying to delete service {0}" -f $ServiceName) -Verbose
        if($service)
        {
            $service.StopService()
            $deleteServiceCode = $service.Delete()
            if($deleteServiceCode -eq 0)
            {
                Write-Verbose -Message ("Deleting service {0} failed with Error code {1}" -f $ServiceName, $deleteServiceCode) -Verbose
            }
        }
    }
    else
    {
        Write-Verbose -Message("{0} is not present on the machine" -f $ServiceName) -Verbose
    }
}

function IsAnySessionActive()
{
    $wtssig = @'
    namespace mystruct
    {
        using System;
        using System.Runtime.InteropServices;

        [StructLayout(LayoutKind.Sequential)]
        public struct WTS_SESSION_INFO
        {
            public Int32 SessionID;

            [MarshalAs(UnmanagedType.LPStr)]
            public String pWinStationName;

            public WTS_CONNECTSTATE_CLASS State;
        }

        public enum WTS_CONNECTSTATE_CLASS
        {
            WTSActive,
            WTSConnected,
            WTSConnectQuery,
            WTSShadow,
            WTSDisconnected,
            WTSIdle,
            WTSListen,
            WTSReset,
            WTSDown,
            WTSInit
        }
    }
'@

    $wtsenumsig = @'
        [DllImport("wtsapi32.dll", SetLastError = true)]
        public static extern int WTSEnumerateSessions(
            System.IntPtr hServer,
            int Reserved,
            int Version,
            ref System.IntPtr ppSessionInfo,
            ref int pCount);
'@

    $wtsopensig = @'
        [DllImport("wtsapi32.dll", SetLastError = true)]
        public static extern IntPtr WTSOpenServer(string pServerName);
'@

    $wtsSendMessagesig = @'
        [DllImport("wtsapi32.dll", SetLastError = true)]
        public static extern bool WTSSendMessage(
            IntPtr hServer,
            [MarshalAs(UnmanagedType.I4)] int SessionId,
            String pTitle,
            [MarshalAs(UnmanagedType.U4)] int TitleLength,
            String pMessage,
            [MarshalAs(UnmanagedType.U4)] int MessageLength,
            [MarshalAs(UnmanagedType.U4)] int Style,
            [MarshalAs(UnmanagedType.U4)] int Timeout,
            [MarshalAs(UnmanagedType.U4)] out int pResponse,
            bool bWait);
'@

    add-type  $wtssig
    $wtsenum = add-type -MemberDefinition $wtsenumsig -Name PSWTSEnumerateSessions -Namespace GetLoggedOnUsers -PassThru
    $wtsOpen = add-type -MemberDefinition $wtsopensig -name PSWTSOpenServer -Namespace GetLoggedOnUsers -PassThru
    $wtsmessage = Add-Type -MemberDefinition $wtsSendMessagesig -name PSWTSSendMessage -Namespace GetLoggedOnUsers -PassThru

    [long]$count = 0
    [long]$ppSessionInfo = 0

    $server = $wtsOpen::WTSOpenServer("localhost")
    [long]$retval = $wtsenum::WTSEnumerateSessions($server, 0, 1, [ref]$ppSessionInfo,[ref]$count)
    $datasize = [system.runtime.interopservices.marshal]::SizeOf([System.Type][mystruct.WTS_SESSION_INFO])

    [bool]$activeSession = $false

    if ($retval -ne 0)
    {
        for ($i = 0; $i -lt $count; $i++)
        {
            $element = [system.runtime.interopservices.marshal]::PtrToStructure($ppSessionInfo + ($datasize* $i), [System.type][mystruct.WTS_SESSION_INFO])
            Write-Verbose -Message("{0} : {1}" -f $element.pWinStationName, $element.State.ToString()) -Verbose
            if ($element.State.ToString().Equals("WTSActive"))
            {
                $activeSession = $true
            }
        }
    }

    return $activeSession
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

function InvokeDTAExecHostExe([string] $Version)
{
    $ExeName = "DTAExecutionHost.exe"
    $vsRoot = Get-TestAgentVersionAndVsRoot $Version
    if ([string]::IsNullOrWhiteSpace($vsRoot))
    {
        throw "Could not locate TestAgent installation directory for `$Version=$Version. Ensure that TestAgent is installed."
    }
    
    $exePath = Join-Path -Path $vsRoot -ChildPath $ExeName
    $exePath = "'" + $exePath + "'"

    Try
    {
        # Make sure DTA Agent Execution Service starts first before invoking DTA Execution Host
        Restart-Service -Name "DTAAgentExecutionService" -ErrorAction SilentlyContinue -ErrorVariable err -OutVariable out  
        Write-Verbose -Message ("Error : {0} " -f ($err | out-string)) -Verbose
        Write-Verbose -Message ("Output : {0} " -f ($out | out-string)) -Verbose
        
        Invoke-Command -ErrorAction SilentlyContinue -ErrorVariable err -OutVariable out -scriptBlock { schtasks.exe /create /TN:DTAConfig /TR:$args /F /RL:HIGHEST /SC:MONTHLY ; schtasks.exe /run /TN:DTAConfig ; Sleep 10 ; schtasks.exe /change /disable /TN:DTAConfig } -ArgumentList $exePath
        Write-Verbose -Message ("Error : {0} " -f ($err | out-string)) -Verbose
        Write-Verbose -Message ("Output : {0} " -f ($out | out-string)) -Verbose
    }
    Catch [Exception]
    {
        Write-Verbose -Message ("Unable to start Agent process, will be rebooting the machine to complete the configuration {0}" -f  $_.Exception.Message) -Verbose
    }
}

function ConfigurePowerOptions()  
{
    Try
    {
        Write-Verbose -Message ("Executing command : {0} " -f "powercfg.exe /Change monitor-timeout-ac 0 ; powercfg.exe /Change monitor-timeout-dc 0") -Verbose
        Invoke-Command -ErrorAction SilentlyContinue -ErrorVariable err -OutVariable out -scriptBlock { powercfg.exe /Change monitor-timeout-ac 0 ; powercfg.exe /Change monitor-timeout-dc 0 }
        Write-Verbose -Message ("Error : {0} " -f ($err | out-string)) -Verbose
        Write-Verbose -Message ("Output : {0} " -f ($out | out-string)) -Verbose
    }
    Catch [Exception]
    {
        Write-Verbose -Message ("Unable to configure display settings, the session may get inactive due to display settings, continuing. Exception : {0}" -f  $_.Exception.Message) -Verbose
    }
}

function InvokeTestAgentConfigExe([string[]] $Arguments, [string] $Version)
{
    $ExeName = "TestAgentConfig.exe"
    if (-not (Test-IsAdmin))
    {
        throw "You need to be an Administrator to run this tool."
    }

    $exePath = $PSScriptRoot + "\modules\" + $ExeName
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
        Write-Verbose -Message ("Stderr : {0}" -f $stderr) -Verbose
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
        [String] $AdminUserName,
        [String] $AdminPassword,
        [String] $TestUserName,
        [String] $TestUserPassword,
        [String] $TfsCollection,
        [String] $TestAgentVersion = "14.0",
        [String] $EnvironmentUrl,
        [String] $PersonalAccessToken,
        [ValidateSet("Service", "Process")]
        [String] $AsServiceOrProcess
    )

    # Admin Credential for installing test agent
    $MachineCredential = New-Object System.Management.Automation.PSCredential -ArgumentList $AdminUserName, (ConvertTo-SecureString -String $AdminPassword -AsPlainText -Force)
    
    # Test Agent credentials for running test process
    $TestUserCredential = New-Object System.Management.Automation.PSCredential -ArgumentList $TestUserName, (ConvertTo-SecureString -String $TestUserPassword -AsPlainText -Force)

    # Properties for running UI Tests
    $DisableScreenSaver = $AsServiceOrProcess -ieq "Process"
    $EnableAutoLogon = $AsServiceOrProcess -ieq "Process"

    # Capabilties to set if it's running as AUT - DataCollectionOnly
    $Capabilities = ""

    $MachineName = $Env:COMPUTERNAME

    Write-Host "****************************************************************"
    Write-Host "                    Configure Test Agent                      "
    Write-Host "----------------------------------------------------------------"
    Write-Host "AdminUserName                   : ($AdminUserName)"
    Write-Host "TestUserName                    : ($TestUserName)"
    Write-Host "AsServiceOrProcess              : ($AsServiceOrProcess)"
    Write-Host "EnvironmentUrl                  : ($EnvironmentUrl)"
    Write-Host "MachineName                     : ($MachineName)"
    Write-Host "Capabilities                    : ($Capabilities)"
    Write-Host "DisableScreenSaver              : ($DisableScreenSaver)"
    Write-Host "EnableAutoLogon                 : ($EnableAutoLogon)"
    Write-Host "****************************************************************"

    if ($AsServiceOrProcess -eq "Service")
    {
        $ret = Set-TestAgentConfiguration -TfsCollection $TfsCollection -AsServiceOrProcess $AsServiceOrProcess -MachineUserCredential $MachineCredential -TestAgentVersion $TestAgentVersion -EnvironmentUrl $EnvironmentUrl -PersonalAccessToken $PersonalAccessToken -MachineName $MachineName -Capabilities $Capabilities -AgentUserCredential $TestUserCredential -KeepConnectionAlive $False 
    }
    else
    {
        $ret = Set-TestAgentConfiguration -TfsCollection $TfsCollection -AsServiceOrProcess $AsServiceOrProcess -MachineUserCredential $MachineCredential -DisableScreenSaver $DisableScreenSaver -EnableAutoLogon $EnableAutoLogon -TestAgentVersion $TestAgentVersion -EnvironmentUrl $EnvironmentUrl -PersonalAccessToken $PersonalAccessToken -MachineName $MachineName -Capabilities $Capabilities -AgentUserCredential $TestUserCredential -KeepConnectionAlive $False
    }

    $retCode = $ret
    if ($ret.Count -gt 0)
    {
        $retCode = $ret[$ret.Count - 1]
    }
    Write-Verbose "Return code received : $retCode"

    if ($retCode -eq 0)
    {
        Write-Host "TestAgent Configured Successfully"
    }
    elseif($retCode -eq 3010)
    {
        Write-Host "TestAgent configuration requested for reboot"
    }
    else
    {
        Write-Error "TestAgent Configuration failed with exit code {0}" -f $retCode
    }

}