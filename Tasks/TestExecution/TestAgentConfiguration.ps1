function Set-TestAgentConfiguration
{
    param
    (
        [String] $TfsCollection,
        [ValidateSet("Service", "Process")]
        [String] $AsServiceOrProcess,
        [Bool] $DisableScreenSaver = $true,
        [Bool] $EnableAutoLogon = $false,
        [String] $TestAgentVersion,
        [String] $PersonalAccessToken,
        [String] $EnvironmentUrl,
        [String] $MachineName,
        [String] $Capabilities
    )

    switch ($AsServiceOrProcess)
    {
        'Service' { $configArgs = @("ConfigureAsProcess"); $configAsProcess = $false }
        'Process' { $configArgs = @("ConfigureAsInteractiveProcess"); $configAsProcess = $true }
    }

    $configArgs = $configArgs + ("/tfsTeamProjectCollection:{0}" -f $TfsCollection)

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

    $exitCode = InvokeTestAgentConfigExe -Arguments $configArgs -Version $TestAgentVersion

    if(Test-path -Path $configLogFile) 
    {
        Write-Verbose -Message "=== Starting to print the testagent configuration log file for [$env:COMPUTERNAME] ===" -Verbose
        Get-Content $configLogFile | foreach { Write-Verbose -Message "[$env:COMPUTERNAME] $_" -Verbose }
        Write-Verbose -Message "=== Done printing the testagent configuration log file for [$env:COMPUTERNAME] ===" -Verbose        
    }

    return $exitCode
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

function InvokeTestAgentConfigExe([string[]] $Arguments, [string] $Version)
{
    $ExeName = "TestAgentConfig.exe"

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

        Write-Host "Starting DTAExecutionHost process "
        $p.Start() | Out-Null
        $p.WaitForExit()
        Write-Host "Exiting DTAExecutionHost process"        
        return $p.ExitCode
    }

    throw "Did not find TestAgentConfig.exe at : $exePath. Ensure that TestAgent is installed."
}

function ConfigureTestAgent
{
    param
    (
        [String] $TfsCollection,
        [String] $TestAgentVersion = "14.0",
        [String] $EnvironmentUrl,
        [String] $PersonalAccessToken,
        [ValidateSet("Service", "Process")]
        [String] $AsServiceOrProcess
    )

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
        $ret = Set-TestAgentConfiguration -TfsCollection $TfsCollection -AsServiceOrProcess $AsServiceOrProcess -TestAgentVersion $TestAgentVersion -EnvironmentUrl $EnvironmentUrl -PersonalAccessToken $PersonalAccessToken -MachineName $MachineName -Capabilities $Capabilities
    }
    else
    {
        $ret = Set-TestAgentConfiguration -TfsCollection $TfsCollection -AsServiceOrProcess $AsServiceOrProcess -DisableScreenSaver $DisableScreenSaver -EnableAutoLogon $EnableAutoLogon -TestAgentVersion $TestAgentVersion -EnvironmentUrl $EnvironmentUrl -PersonalAccessToken $PersonalAccessToken -MachineName $MachineName -Capabilities $Capabilities
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